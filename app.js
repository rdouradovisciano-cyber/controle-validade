(() => {
"use strict";
const C = window.VALIDA_CONFIG || {}, V = window.V || {}, fb = C.firebase || {};
const CATS = ["Ovos","FLV","Padaria","Laticínios","Mercearia","Bebidas","Congelados","Higiene e limpeza","Outros"];
const $ = id => document.getElementById(id);
const LK = "validamais-produtos-v1", LC = "validamais-ultima-categoria";
let products = [], db = null, scanner = null, toastTimer;
const cloud = !!fb.apiKey && !/COLE_|SEU_/.test(fb.apiKey + fb.projectId);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- datas e status ----------
const today = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const iso = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysLeft = e => /^\d{4}-\d\d-\d\d$/.test(e || "") ? Math.round((new Date(e + "T00:00:00") - today()) / 864e5) : null;
const limit = c => (C.alertaDias && (C.alertaDias[c] ?? C.alertaDias.padrao)) ?? 3;
const status = p => { const d = daysLeft(p.expiry); return d === null ? "ok" : d < 0 ? "expired" : d <= limit(p.category) ? "soon" : "ok"; };
const when = d => d === null ? "Sem validade" : d < 0 ? `Vencido há ${-d} dia${d < -1 ? "s" : ""}` : d === 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : `Vence em ${d} dias`;
const fmt = e => daysLeft(e) === null ? "Sem validade" : new Date(e + "T00:00:00").toLocaleDateString("pt-BR");
const stLabel = p => daysLeft(p.expiry) === null ? "Sem validade" : ({ expired: "Vencido", soon: "A vencer", ok: "No prazo" })[status(p)];

function toast(msg, action, fn) {
  const t = $("toast"); t.textContent = msg + " ";
  if (action) { const b = document.createElement("button"); b.textContent = action; b.onclick = () => { fn(); t.classList.add("hidden"); }; t.append(b); }
  t.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), 6000);
}
const persist = () => { if (!db) store.set(LK, products); };

// ---------- lista ----------
function fillCategories() {
  const opt = (id, first) => { const el = $(id); el.innerHTML = ""; el.add(new Option(first, "")); CATS.forEach(c => el.add(new Option(c, c))); };
  opt("category", "Selecione"); opt("categoryFilter", "Todas as categorias"); opt("exportCategory", "Selecione a categoria");
}
function render() {
  const q = $("search").value.trim().toLowerCase(), cat = $("categoryFilter").value, st = $("statusFilter").value;
  const ex = products.filter(p => status(p) === "expired").length, so = products.filter(p => status(p) === "soon").length;
  $("countAll").textContent = products.length; $("countSoon").textContent = so; $("countExpired").textContent = ex;
  $("topAlert").classList.toggle("hidden", !(ex || so));
  $("topAlert").textContent = `Atenção: ${ex} vencido(s) e ${so} vencendo em breve.`;
  try { buildAtalhos(); } catch {}
  const cnt = {}; products.forEach(p => { if (p.barcode) cnt[p.barcode] = (cnt[p.barcode] || 0) + 1; });
  const hoje = products.filter(p => daysLeft(p.expiry) === 0 && (!cat || p.category === cat));
  $("todayBanner").classList.toggle("hidden", !hoje.length);
  $("todayBanner").textContent = `⚠ VENCEM HOJE (${hoje.length}): ` + hoje.slice(0, 5).map(p => p.name).join(", ") + (hoje.length > 5 ? "…" : "");
  if (!hoje.length) alarmed = false; else if (!alarmed && actx) { alarmed = true; alarm(); }
  const rows = products.filter(p => (!cat || p.category === cat) && (!st || status(p) === st) &&
    (!q || (p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q)))
    .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  $("list").innerHTML = rows.length ? rows.map(p => { const s = status(p);
    return `<article class="product ${s}"><h3>${esc(p.name)}</h3><p>${esc(p.category)} · Qtd: ${esc(p.quantity)} · Validade: <b>${fmt(p.expiry)}</b>${cnt[p.barcode] > 1 ? ` · <b>${cnt[p.barcode]} lotes</b> deste código` : ""}</p><p>Código: ${esc(p.barcode || "não informado")}</p><span class="pill">${when(daysLeft(p.expiry))}</span><div class="actions"><button class="secondary" data-edit="${esc(p.id)}">Editar</button><button class="danger" data-del="${esc(p.id)}">Excluir</button></div></article>`;
  }).join("") : '<p class="muted">Nenhum produto encontrado. Use "Bipar código" ou "Cadastro manual".</p>';
}

// ---------- modal e formulário ----------
function show(title, scan) {
  $("modalTitle").textContent = title; $("modal").classList.remove("hidden");
  $("scannerArea").classList.toggle("hidden", !scan); $("productForm").classList.toggle("hidden", !!scan);
}
function resetForm() {
  $("productForm").reset(); $("docId").value = ""; $("quantity").value = 1;
  $("category").value = store.get(LC, "") || ""; $("saveNext").classList.remove("hidden"); toggleCodes();
}
function toggleCodes() {
  const flv = $("category").value === "FLV"; $("expiry").required = !flv; $("expLabel").textContent = flv ? "Data de validade (opcional)" : "Data de validade *"; $("semCodigo").classList.toggle("hidden", !!$("barcode").value.trim() && !["FLV", "Padaria"].includes($("category").value)); }
async function stopScanner() {
  const s = scanner; scanner = null;
  if (s) { try { await s.stop(); } catch {} try { s.clear(); } catch {} }
  $("torchBtn").classList.add("hidden");
}
function closeModal() { stopScanner(); $("modal").classList.add("hidden"); resetForm(); }
function openForm(code = "") { resetForm(); show("Cadastrar produto"); $("barcode").value = code; fillKnown(code); $("name").focus(); }
function fillKnown(code) {
  const k = code && products.find(p => p.barcode === code);
  if (k && !$("docId").value) { if (!$("name").value) $("name").value = k.name || ""; if (k.category) $("category").value = k.category;
    $("cBalanca").value = k.codigo_balanca || ""; $("cDoacao").value = k.codigo_doacao || ""; }
  toggleCodes();
}
function edit(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  resetForm(); show("Editar produto"); $("saveNext").classList.add("hidden");
  $("docId").value = id; $("barcode").value = p.barcode || ""; $("name").value = p.name || "";
  $("category").value = p.category || ""; $("quantity").value = p.quantity; $("expiry").value = p.expiry || "";
  $("cBalanca").value = p.codigo_balanca || ""; $("cDoacao").value = p.codigo_doacao || ""; toggleCodes();
}
function save(next) {
  const id = $("docId").value, q = Number(String($("quantity").value).replace(",", "."));
  const data = { barcode: $("barcode").value.trim().slice(0, 32), name: $("name").value.trim().slice(0, 120),
    category: $("category").value, expiry: $("expiry").value, quantity: q, por: myName(), codigo_balanca: $("cBalanca").value.trim().slice(0, 12), codigo_doacao: $("cDoacao").value.trim().slice(0, 12) };
  if (!data.name || !CATS.includes(data.category) || (!data.expiry && data.category !== "FLV") || !(q > 0)) { toast(data.category === "FLV" ? "Preencha nome e categoria." : "Preencha nome, categoria, validade e quantidade."); return; }
  store.set(LC, data.category);
  if (db) {
    const ts = V.serverTimestamp();
    const p = id ? V.updateDoc(V.doc(db, "products", id), { ...data, updatedAt: ts })
                 : V.addDoc(V.collection(db, "products"), { ...data, createdAt: ts, updatedAt: ts });
    p.catch(e => { console.error(e); toast("Erro ao salvar na nuvem. Confira as regras do Firestore."); });
  } else {
    if (id) products = products.map(x => x.id === id ? { ...x, ...data } : x); else products.push({ ...data, id: uid() });
    persist(); render();
  }
  closeModal(); toast("Produto salvo."); if (next) openScan();
}
function remove(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  const { id: _i, createdAt, updatedAt, ...data } = p;
  if (db) V.deleteDoc(V.doc(db, "products", id)).catch(() => toast("Não foi possível excluir."));
  else { products = products.filter(x => x.id !== id); persist(); render(); }
  toast("Produto excluído.", "Desfazer", () => {
    if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...data, createdAt: ts, updatedAt: ts }); }
    else { products.push(p); persist(); render(); }
  });
}

// ---------- scanner ----------
let actx, alarmed = false, sector = "";
const audio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} };
function tone(f, t, d) { if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = .25; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + d); }
function beep() { audio(); tone(1000, 0, .09); }
function alarm() { [0, .4, .8].forEach(t => { tone(880, t, .17); tone(660, t + .18, .17); }); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
async function onCode(code) {
  if (scanMode === "doacao") return donationScan(code);
  if (scanMode === "etiqueta") return labelScan(code);
  if (navigator.vibrate) navigator.vibrate(100);
  beep(); await stopScanner(); resetForm();
  const known = products.find(p => p.barcode === code); logScan(code, known);
  show(known ? `Novo lote de «${known.name}» (já há ${products.filter(p => p.barcode === code).length} validade(s))` : "Produto identificado");
  $("barcode").value = code; fillKnown(code); (known ? $("expiry") : $("name")).focus();
}
let scanMode = "loja";
async function openScan(mode = "loja") {
  scanMode = ["doacao", "etiqueta"].includes(mode) ? mode : "loja";
  resetForm(); show({ doacao: "Bipar itens da doação", etiqueta: "Bipar para etiqueta" }[scanMode] || "Ler código de barras", true);
  $("scanManual").textContent = scanMode === "loja" ? "Digitar código" : "Cancelar";
  ["retryScan", "torchBtn"].forEach(i => $(i).classList.add("hidden"));
  $("scanMsg").textContent = "Aponte a câmera traseira para o código de barras.";
  await stopScanner();
  const F = V.Html5QrcodeSupportedFormats, s = new V.Html5Qrcode("reader", { verbose: false,
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF] });
  scanner = s;
  try {
    await s.start({ facingMode: "environment" }, {
      fps: 10,
      qrbox: (w, h) => ({ width: Math.floor(w * .85), height: Math.floor(Math.min(w, h) * .4) }),
      videoConstraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] }
    }, onCode, () => {});
    if (scanner !== s) { try { await s.stop(); s.clear(); } catch {} return; }  // modal fechado durante a abertura
    try { const t = s.getRunningTrackCameraCapabilities().torchFeature();
      if (t.isSupported()) { let on = false; $("torchBtn").classList.remove("hidden");
        $("torchBtn").onclick = async () => { on = !on; try { await t.apply(on); } catch { on = !on; } }; } } catch {}
  } catch (e) {
    console.error(e); scanner = null;
    $("scanMsg").textContent = "Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador (cadeado ao lado do endereço) e tente novamente, ou digite o código.";
    $("retryScan").classList.remove("hidden");
  }
}

// ---------- exportação ----------
function exportRows() {
  const s = $("exportScope").value, c = $("exportCategory").value; let r = [...products];
  if (s === "soon" || s === "expired") r = r.filter(p => status(p) === s);
  if (s === "category") { if (!c) { toast("Escolha a categoria para exportar."); return null; } r = r.filter(p => p.category === c); }
  if (!r.length) { toast("Nenhum produto neste filtro."); return null; }
  return r.sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999")).map(p => ({
    "Produto": p.name, "Categoria": p.category, "Código de barras": p.barcode || "", "Validade": fmt(p.expiry),
    "Quantidade": String(p.quantity).replace(".", ","), "Status": stLabel(p) }));
}
function csvCell(k, v) {
  v = String(v ?? "");
  if (k === "Código de barras" && /^\d+$/.test(v)) return `="${v}"`;      // evita notação científica no Excel
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;                                // evita injeção de fórmula
  return '"' + v.replace(/"/g, '""') + '"';
}
function csvContent(rows) {
  const keys = Object.keys(rows[0]);
  return "\ufeff" + [keys.map(k => `"${k}"`).join(";"), ...rows.map(r => keys.map(k => csvCell(k, r[k])).join(";"))].join("\r\n");
}
function download(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
}
function makePdf(rows) {
  const pdf = new V.jsPDF();
  pdf.setFontSize(16); pdf.text("Relatório de validade", 14, 16);
  pdf.setFontSize(9); pdf.text(`${C.loja || "Valida+"} · Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} produto(s)`, 14, 22);
  const col = t => t === "Vencido" ? [185, 28, 28] : t === "A vencer" ? [161, 98, 7] : [22, 101, 52];
  V.autoTable(pdf, { startY: 27, styles: { fontSize: 8 }, headStyles: { fillColor: [22, 101, 52] },
    head: [["Produto", "Categoria", "Código", "Validade", "Qtd", "Status"]],
    body: rows.map(r => [r["Produto"], r["Categoria"], r["Código de barras"], r["Validade"], r["Quantidade"], r["Status"]]),
    didParseCell: h => { if (h.section === "body" && h.column.index === 5) { h.cell.styles.textColor = col(h.cell.raw); h.cell.styles.fontStyle = "bold"; } },
    didDrawPage: () => { pdf.setFontSize(8); pdf.text(`Página ${pdf.internal.getCurrentPageInfo().pageNumber}`, 196, 290, { align: "right" }); } });
  return pdf.output("blob");
}
const stamp = () => iso(new Date());

// ---------- eventos ----------
fillCategories();
["search"].forEach(i => $(i).oninput = render);
$("categoryFilter").onchange = render; $("statusFilter").onchange = render;
$("list").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.edit) edit(b.dataset.edit); if (b.dataset.del) remove(b.dataset.del); };
$("manualOpen").onclick = () => openForm(); $("scanOpen").onclick = () => openScan(); $("retryScan").onclick = () => openScan(scanMode);
$("scanManual").onclick = async () => { await stopScanner(); if (scanMode !== "loja") closeModal(); else openForm(); };
$("closeModal").onclick = closeModal; $("cancelForm").onclick = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal(); });
$("productForm").onsubmit = e => { e.preventDefault(); save(false); };
$("saveNext").onclick = () => { if ($("productForm").reportValidity()) save(true); };
$("barcode").oninput = toggleCodes; $("category").onchange = toggleCodes; $("barcode").onchange = () => fillKnown($("barcode").value.trim());
$("qMinus").onclick = () => { const q = Number($("quantity").value) || 1; $("quantity").value = Math.max(1, Math.round(q) - 1); };
$("qPlus").onclick = () => { $("quantity").value = Math.round(Number($("quantity").value) || 0) + 1; };
$("exportScope").onchange = () => $("exportCategory").classList.toggle("hidden", $("exportScope").value !== "category");
$("csvBtn").onclick = () => { const r = exportRows(); if (r) download(new Blob([csvContent(r)], { type: "text/csv;charset=utf-8" }), `controle-validade-${stamp()}.csv`); };
$("pdfBtn").onclick = () => { const r = exportRows(); if (!r) return; try { download(makePdf(r), `controle-validade-${stamp()}.pdf`); } catch (e) { console.error(e); toast("Não foi possível gerar o PDF."); } };
$("shareBtn").onclick = async () => {
  const r = exportRows(); if (!r) return;
  try {
    const blob = makePdf(r), file = new File([blob], `controle-validade-${stamp()}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Relatório de validade", files: [file] });
    else { download(blob, file.name); toast("Compartilhamento indisponível neste navegador. O PDF foi baixado."); }
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível compartilhar."); } }
};

// ---------- dados: Firebase ou local ----------
const setSync = t => $("syncState").textContent = t;
if (cloud && V.initializeApp) {
  try {
    const app = V.initializeApp(fb);
    db = V.initializeFirestore(app, { localCache: V.persistentLocalCache({ tabManager: V.persistentMultipleTabManager() }) });
    V.onSnapshot(V.collection(db, "products"), { includeMetadataChanges: true }, snap => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() })); render();
      setSync(snap.metadata.hasPendingWrites ? "alterações aguardando envio…" : snap.metadata.fromCache ? (navigator.onLine ? "conectando…" : "offline (dados salvos no aparelho)") : "sincronizado");
    }, err => { console.error(err); setSync("erro de sincronização (confira as regras do Firestore)"); toast("Erro ao ler os dados da nuvem."); });
  } catch (e) { console.error(e); db = null; setSync("falha ao iniciar o Firebase"); }
} else { products = store.get(LK, []); setSync("modo local neste aparelho (configure o Firebase para sincronizar)"); render(); }

// ---------- aparelho, contadores (visitas/online) e histórico de leituras ----------
const myId = store.get("validamais-device", null) || (() => { const i = uid().slice(0, 8); store.set("validamais-device", i); return i; })();
const myName = () => "Aparelho " + myId.slice(0, 4);
const ms = t => t && t.toMillis ? t.toMillis() : (t ? Number(t) : Date.now());
const ONLINE_MS = 5 * 60 * 1000;
let scans = [], unsubScan = null;
function renderScans() {
  $("scanList").innerHTML = scans.length ? scans.map(s => `<p><b>${esc(s.barcode)}</b> · ${s.cadastrado ? esc(s.nome) : "não cadastrado"}<br><span class="muted">${new Date(ms(s.em)).toLocaleString("pt-BR")}</span></p>`).join("") : '<p class="muted">Nenhuma leitura ainda.</p>';
}
function logScan(code, known) {
  const rec = { barcode: String(code).slice(0, 32), nome: ((known && known.name) || "").slice(0, 120), por: myName(), cadastrado: !!known };
  if (db) V.addDoc(V.collection(db, "scans"), { ...rec, em: V.serverTimestamp() }).catch(console.error);
  else { const l = store.get("validamais-scans", []); l.unshift({ ...rec, em: Date.now() }); store.set("validamais-scans", l.slice(0, 200)); }
}
async function pollStats() {          // contagem agregada: 1 leitura por consulta (barato na cota gratuita)
  if (document.visibilityState !== "visible") return;
  try { const col = V.collection(db, "devices");
    const on = await V.getAggregateFromServer(V.query(col, V.where("lastSeen", ">", V.Timestamp.fromMillis(Date.now() - ONLINE_MS))), { n: V.count() });
    const all = await V.getAggregateFromServer(col, { v: V.sum("visitas") });
    $("nOnline").textContent = on.data().n; $("nVisitas").textContent = all.data().v || 0; $("dotO").classList.toggle("on", on.data().n > 0);
  } catch (e) { console.warn(e); }
}
function startPresence() {
  const ref = V.doc(db, "devices", myId), ua = navigator.userAgent;
  const first = store.get("validamais-first", null) || (() => { const f = new Date().toISOString(); store.set("validamais-first", f); return f; })();
  const beat = () => { if (document.visibilityState === "visible") V.setDoc(ref, { nome: myName(), lastSeen: V.serverTimestamp() }, { merge: true }).catch(() => {}); };
  V.setDoc(ref, { nome: myName(), firstSeen: first, lastSeen: V.serverTimestamp(), visitas: V.increment(1), ua: /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Computador" }, { merge: true })
    .catch(console.error).finally(() => setTimeout(pollStats, 1500));
  setInterval(beat, 120000); setInterval(pollStats, 60000); document.addEventListener("visibilitychange", beat);
}
function localStats() { const v = store.get("validamais-visitas", 0) + 1; store.set("validamais-visitas", v); $("nVisitas").textContent = v; $("nOnline").textContent = 1; $("dotO").classList.add("on"); }
$("scansBox").ontoggle = () => {
  if ($("scansBox").open) { if (db) { if (!unsubScan) unsubScan = V.onSnapshot(V.query(V.collection(db, "scans"), V.orderBy("em", "desc"), V.limit(30)), s => { scans = s.docs.map(d => d.data()); renderScans(); }); }
    else { scans = store.get("validamais-scans", []).slice(0, 30); renderScans(); } }
  else if (unsubScan) { unsubScan(); unsubScan = null; }
};

// ---------- setor, menu lateral, voz e foto da validade ----------
const SECTORS = ["Padaria", "FLV", "Ovos", "Laticínios", "Mercearia"];
$("sectorBtns").innerHTML = SECTORS.map(s => `<button data-s="${s}">${s}</button>`).join("") + '<button class="secondary" data-s="">Todos os setores</button>';
$("sectorBtns").onclick = e => { const b = e.target.closest("button"); if (!b) return; sector = b.dataset.s; $("categoryFilter").value = sector;
  if (sector) store.set(LC, sector); $("sectorBox").classList.add("hidden"); audio(); render(); };
const side = o => { $("side").classList.toggle("open", o); $("sideBg").classList.toggle("hidden", !o); };
$("menuBtn").onclick = () => side(true); $("sideBg").onclick = () => side(false); $("sideClose").onclick = () => side(false);
$("micBtn").onclick = () => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return toast("Ditado por voz não é suportado neste navegador.");
  const r = new R(); r.lang = "pt-BR"; r.interimResults = false;
  r.onresult = e => { const t = e.results[0][0].transcript.trim(); $("name").value = (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 120); };
  r.onerror = e => toast(e.error === "not-allowed" ? "Permita o microfone para ditar." : "Não entendi, tente de novo.");
  r.onend = () => $("micBtn").classList.remove("on"); $("micBtn").classList.add("on"); toast("Fale o nome do produto…"); try { r.start(); } catch {} };
const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
function parseDate(txt) {
  const f = [], add = (d, m, y) => { y = y < 100 ? 2000 + y : y; m = +m; d = +d;
    if (m >= 1 && m <= 12 && y >= 2024 && y <= 2040) { d = d || new Date(y, m, 0).getDate(); if (d >= 1 && d <= 31) f.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`); } };
  let t = String(txt).toLowerCase();
  t = t.replace(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})(?!\d)/g, (_, d, m, y) => { add(d, m, +y); return " "; });
  t = t.replace(/(\d{1,2})?\s*([a-zç]{3})[a-z]*\.?\s*[\/.\-]?\s*(\d{4}|\d{2})(?!\d)/g, (s, d, mo, y) => { if (!MES[mo]) return s; add(d, MES[mo], +y); return " "; });
  t.replace(/(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})(?!\d)/g, (_, m, y) => { add(0, m, +y); return " "; });
  return f.sort().pop() || "";
}
const loadTess = () => window.Tesseract ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"; s.onload = ok; s.onerror = () => no(new Error("offline")); document.head.append(s); });
async function shrink(file) { try { const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = bmp.width * k; c.height = bmp.height * k; c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, "image/jpeg", .9)); } catch { return file; } }
$("ocrBtn").onclick = () => $("ocrFile").click();
$("ocrFile").onchange = async () => {
  const f = $("ocrFile").files[0]; if (!f) return; toast("Lendo a data… (precisa de internet)");
  try { await loadTess(); const r = await Tesseract.recognize(await shrink(f), "por"), d = parseDate(r.data.text);
    if (d) { $("expiry").value = d; toast("Validade lida: " + fmt(d) + ". Confira antes de salvar."); } else toast("Não achei a data. Tente uma foto mais perto e com luz.");
  } catch (e) { console.error(e); toast("Não foi possível ler a foto (verifique a internet)."); }
  $("ocrFile").value = ""; };
document.addEventListener("keydown", e => { if (e.key === "Escape") side(false); });

// ---------- códigos internos editáveis (balança / doação) ----------
const sameProd = (a, b) => (b.barcode && a.barcode === b.barcode) || (!b.barcode && !a.barcode && norm(a.name) === norm(b.name));
const newRec = (p, field, v, ts) => ({ name: p.name, barcode: p.barcode || "", category: p.category || "FLV", expiry: "", quantity: 1, por: myName(), codigo_balanca: "", codigo_doacao: "", [field]: v, ...(ts ? { createdAt: ts, updatedAt: ts } : {}) });
function saveCode(p, field, raw) {                 // grava o código em todos os lotes do produto (ou cria um item FLV sem validade)
  const v = String(raw || "").trim().toUpperCase(), re = field === "codigo_balanca" ? /^\d{1,6}$/ : /^[A-Z0-9]{1,12}$/;
  if (v && !re.test(v)) { toast(field === "codigo_balanca" ? "O código de balança deve ter só números (até 6)." : "Use só letras e números (até 12)."); return null; }
  const dup = v && products.find(x => x[field] === v && !sameProd(x, p)); if (dup) { toast(`Esse código já pertence a «${dup.name}».`); return null; }
  const mine = products.filter(x => sameProd(x, p)), fail = e => { console.error(e); toast("Erro ao salvar na nuvem."); };
  if (db) { const ts = V.serverTimestamp();
    if (mine.length) mine.forEach(x => V.updateDoc(V.doc(db, "products", x.id), { [field]: v, updatedAt: ts }).catch(fail));
    else V.addDoc(V.collection(db, "products"), newRec(p, field, v, ts)).catch(fail);
  } else { if (mine.length) mine.forEach(x => { x[field] = v; }); else products.push({ ...newRec(p, field, v), id: uid() }); persist(); render(); }
  toast(v ? "Código salvo." : "Código removido."); return v;
}

// ---------- aba Doação ----------
const DK = "validamais-doacao", HK = "validamais-doacoes", NK = "validamais-dnomes";
let don = store.get(DK, null) || { itens: [], inicio: new Date().toISOString() }, dSel = "", dVal = "", curRom = null, histList = [], unsubHist = null, lastScan = { c: "", t: 0 };
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const fq = q => (Math.round(q * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sumU = u => don.itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0);
const dataBR = d => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
function tab(t) {
  ["Loja", "Doacao", "Etiquetas"].forEach(n => { $("tab" + n).classList.toggle("hidden", n !== t); $("nav" + n).classList.toggle("active", n === t); });
}
function renderDon() {
  $("dKg").textContent = fq(sumU("kg")); $("dUn").textContent = fq(sumU("un")); $("dItens").textContent = don.itens.length;
  $("dLista").innerHTML = don.itens.length ? don.itens.map((i, x) => `<div class="drow"><div><b>${esc(i.nome)}</b><small>${i.lanc} lançamento(s)</small></div><b>${fq(i.qtd)} ${esc(i.unidade)}</b><button class="danger" data-drop="${x}" aria-label="Remover ${esc(i.nome)}">✕</button></div>`).join("") : '<p class="muted">Nada lançado ainda. Bipe um item ou use a pesagem.</p>';
}
function addDon(nome, unidade, qtd) {
  qtd = Math.round(qtd * 1000) / 1000; if (!(qtd > 0)) return 0;
  const key = norm(nome) + "|" + unidade; let it = don.itens.find(i => i.key === key);
  if (it) { it.qtd = Math.round((it.qtd + qtd) * 1000) / 1000; it.lanc++; } else { it = { key, nome: nome.trim().slice(0, 60), unidade, qtd, lanc: 1 }; don.itens.push(it); }
  store.set(DK, don); renderDon(); return it.qtd;
}
function parseScale(code) {                       // EAN-13 de balança: 2 + código do item + peso (g) + dígito verificador
  const b = C.balanca || {}, cd = b.codigoDigitos ?? 6, vd = b.valorDigitos ?? 5, div = b.divisor ?? 1000;
  return { item: code.slice(1, 1 + cd), kg: Number(code.slice(1 + cd, 1 + cd + vd)) / div };
}
function donationScan(code) {
  const now = Date.now(); if (code === lastScan.c && now - lastScan.t < 2500) return;   // ignora leitura repetida do mesmo código
  lastScan = { c: code, t: now };
  if (navigator.vibrate) navigator.vibrate(100); beep();
  const names = store.get(NK, {}); let key, unidade, qtd;
  if (/^2\d{12}$/.test(code)) { const s = parseScale(code); key = "B" + s.item; unidade = "kg"; qtd = s.kg;
    if (!(qtd > 0)) { toast("Etiqueta de balança sem peso legível. Ajuste a configuração 'balanca' no config.js."); return; } }
  else { key = code; unidade = "un"; qtd = 1; }
  let nome = (unidade === "un" && (products.find(p => p.barcode === code) || {}).name) || (unidade === "kg" && (products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(key.slice(1))) || {}).name) || names[key];
  if (!nome) { nome = (prompt(unidade === "kg" ? `Item de balança ${key.slice(1)} (${fq(qtd)} kg). Qual o nome do produto?` : `Código ${code}. Qual o nome do produto?`) || "").trim();
    if (!nome) { lastScan.t = Date.now(); return; } names[key] = nome; store.set(NK, names); }
  const total = addDon(nome, unidade, qtd);
  toast(`${nome}: +${fq(qtd)} ${unidade} → total ${fq(total)} ${unidade}`); lastScan.t = Date.now();
}
// pesagem manual
function renderKey() { $("dNome").textContent = dSel || "Toque num produto"; $("dValor").textContent = dVal || "0"; document.querySelectorAll("#dAtalhos button[data-n]").forEach(b => b.classList.toggle("sel", b.dataset.n === dSel)); }
let atalhosKey = "";
function buildAtalhos() {
  const all = [...new Set([...(C.doacaoAtalhos || ["Mamão", "Banana", "Tomate", "Pão Francês", "Laranja", "Batata", "Cebola", "Maçã", "Cenoura", "Alface"]), ...products.filter(p => p.codigo_doacao).map(p => p.name)])], k = all.join("|");
  if (k === atalhosKey) return; atalhosKey = k;
  $("dAtalhos").innerHTML = all.map(n => `<button type="button" data-n="${esc(n)}">${esc(n)}</button>`).join("") + '<button type="button" id="dOutro">＋ Outro</button>'; renderKey();
}
$("dCodOk").onclick = () => { const v = $("dCod").value.trim(), pr = v && products.find(p => String(p.codigo_doacao) === v);
  if (!pr) return toast("Código de doação não encontrado."); selectProd(pr.name); };
function selectProd(n) { dSel = n; $("dCod").value = (products.find(x => norm(x.name) === norm(n)) || {}).codigo_doacao || ""; renderKey(); }
$("dCodSave").onclick = () => { if (!dSel) return toast("Escolha o produto primeiro."); const pr = products.find(x => norm(x.name) === norm(dSel)) || { name: dSel };
  const v = saveCode(pr, "codigo_doacao", $("dCod").value); if (v !== null) $("dCod").value = v; };
$("keypad").innerHTML = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"].map(k => `<button type="button" data-k="${k}">${k}</button>`).join("") + '<button type="button" class="add" id="dAdd">Adicionar</button>';
$("dAtalhos").onclick = e => { const b = e.target.closest("button"); if (!b) return;
  if (b.id === "dOutro") { const n = (prompt("Nome do produto:") || "").trim(); if (n) selectProd(n.slice(0, 60)); } else selectProd(b.dataset.n); };
$("keypad").onclick = e => { const b = e.target.closest("button"); if (!b) return;
  if (b.id === "dAdd") { const q = Number(dVal.replace(",", "."));
    if (!dSel) return toast("Escolha o produto."); if (!(q > 0)) return toast("Digite o peso em kg.");
    const total = addDon(dSel, "kg", q); toast(`${dSel}: +${fq(q)} kg → total ${fq(total)} kg`); dVal = ""; return renderKey(); }
  const k = b.dataset.k;
  if (k === "⌫") dVal = dVal.slice(0, -1);
  else if (k === ",") { if (!dVal.includes(",")) dVal = (dVal || "0") + ","; }
  else if (!/,\d{3}$/.test(dVal) && dVal.replace(",", "").length < 7) dVal = dVal === "0" ? k : dVal + k;
  renderKey(); };
$("dLista").onclick = e => { const b = e.target.closest("[data-drop]"); if (!b) return; const x = Number(b.dataset.drop), it = don.itens.splice(x, 1)[0];
  store.set(DK, don); renderDon(); toast(`${it.nome} removido.`, "Desfazer", () => { don.itens.splice(x, 0, it); store.set(DK, don); renderDon(); }); };
$("dLimpar").onclick = () => { if (don.itens.length && confirm("Apagar toda a lista da doação atual?")) { don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon(); } };
// romaneio
function romText(d) {
  return [`ROMANEIO DE DOAÇÃO - ${C.loja || "Valida+"}`, `Data: ${dataBR(d.data)}`, "------------------------",
    ...d.itens.map(i => `${i.nome}: ${fq(i.qtd)} ${i.unidade}`), "------------------------",
    `TOTAL: ${fq(d.totalKg)} kg · ${fq(d.totalUn)} un (${d.itens.length} itens)`].join("\n");
}
function romPdf(d) {
  const pdf = new V.jsPDF(); pdf.setFontSize(16); pdf.text("Romaneio de doação", 14, 16);
  pdf.setFontSize(9); pdf.text(`${C.loja || "Valida+"} · ${dataBR(d.data)}`, 14, 22);
  V.autoTable(pdf, { startY: 27, styles: { fontSize: 9 }, headStyles: { fillColor: [22, 101, 52] }, footStyles: { fillColor: [226, 238, 229], textColor: [20, 83, 45] },
    head: [["Item", "Quantidade", "Lançamentos"]], body: d.itens.map(i => [i.nome, `${fq(i.qtd)} ${i.unidade}`, i.lanc]),
    foot: [["TOTAL", `${fq(d.totalKg)} kg · ${fq(d.totalUn)} un`, ""]] });
  return pdf.output("blob");
}
function showRomaneio(d) {
  curRom = d; $("donaEntrada").classList.add("hidden"); $("donaRomaneio").classList.remove("hidden");
  $("romBody").innerHTML = `<p class="note">${dataBR(d.data)}</p><div class="stats"><div class="stat"><b>${fq(d.totalKg)}</b><span>kg doados</span></div><div class="stat"><b>${fq(d.totalUn)}</b><span>unidades</span></div><div class="stat"><b>${d.itens.length}</b><span>itens</span></div></div>` +
    d.itens.map(i => `<div class="drow"><div><b>${esc(i.nome)}</b></div><b>${fq(i.qtd)} ${esc(i.unidade)}</b></div>`).join("");
}
$("rZap").onclick = async () => { const t = romText(curRom);
  if (navigator.share) { try { await navigator.share({ title: "Romaneio de doação", text: t }); } catch (e) { if (e.name !== "AbortError") toast("Não foi possível compartilhar."); } }
  else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank"); };
$("rPdf").onclick = async () => { try { const blob = romPdf(curRom), file = new File([blob], `romaneio-doacao-${curRom.data}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Romaneio de doação", files: [file] }); else download(blob, file.name);
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível gerar o PDF."); } } };
$("rNova").onclick = () => { $("donaRomaneio").classList.add("hidden"); $("donaEntrada").classList.remove("hidden"); };
$("dFinalizar").onclick = () => {
  if (!don.itens.length) return toast("A lista está vazia.");
  const rec = { data: iso(new Date()), por: myName().slice(0, 40), totalKg: Math.round(sumU("kg") * 1000) / 1000, totalUn: Math.round(sumU("un") * 1000) / 1000,
    itens: don.itens.map(({ nome, unidade, qtd, lanc }) => ({ nome, unidade, qtd, lanc })) };
  if (!confirm(`Finalizar a doação: ${fq(rec.totalKg)} kg e ${fq(rec.totalUn)} un?`)) return;
  if (db) V.addDoc(V.collection(db, "doacoes"), { ...rec, em: V.serverTimestamp() }).catch(e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras). O romaneio foi gerado."); });
  else { const h = store.get(HK, []); h.unshift({ ...rec, em: Date.now() }); store.set(HK, h.slice(0, 50)); }
  don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon(); showRomaneio(rec);
};
function renderHist(l) { histList = l;
  $("dHist").innerHTML = l.length ? l.map((h, i) => `<p><b>${dataBR(h.data)}</b> · ${fq(h.totalKg)} kg · ${fq(h.totalUn)} un <button class="secondary" data-hist="${i}">Abrir</button></p>`).join("") : '<p class="muted">Nenhuma doação finalizada.</p>'; }
$("dHist").onclick = e => { const b = e.target.closest("[data-hist]"); if (b) showRomaneio(histList[Number(b.dataset.hist)]); };
$("histBox").ontoggle = () => {
  if ($("histBox").open) { if (db) { if (!unsubHist) unsubHist = V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(10)), s => renderHist(s.docs.map(d => d.data()))); } else renderHist(store.get(HK, []).slice(0, 10)); }
  else if (unsubHist) { unsubHist(); unsubHist = null; } };
const go = t => { tab(t); side(false); }; $("navLoja").onclick = () => go("Loja"); $("navDoacao").onclick = () => go("Doacao"); $("navEtiquetas").onclick = () => go("Etiquetas"); $("dScan").onclick = () => openScan("doacao");
renderDon(); buildAtalhos(); renderKey();

// ---------- aba Etiquetas ----------
const EK = "validamais-etiquetas", PK = "validamais-precos";
const SZ = { P: { w: 63, h: 30, cols: 3, rows: 9, nome: 8, preco: 15, cod: 6, bar: 6 }, M: { w: 95, h: 50, cols: 2, rows: 5, nome: 12, preco: 26, cod: 8, bar: 12 }, G: { w: 190, h: 90, cols: 1, rows: 3, nome: 20, preco: 52, cod: 11, bar: 24 } };
let labels = store.get(EK, []), pend = null, eHits = [];
const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
const parsePrice = v => { const s = String(v).trim(); return s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s); };
// itens pesados (FLV/Padaria) usam o código de balança; os demais usam o EAN
const codeText = c => c.code ? `${c.kg ? "Código de balança" : "EAN"}: ${c.code}` : "⚠ Sem código cadastrado: a etiqueta sai só com nome e preço.";
const labelCode = p => (p.codigo_balanca && (["FLV", "Padaria"].includes(p.category) || !p.barcode)) ? { code: String(p.codigo_balanca), kg: true } : { code: p.barcode || "", kg: false };
function renderLabels() {
  $("eLista").innerHTML = labels.length ? labels.map((l, i) => `<div class="drow"><div><b>${esc(l.nome)}</b><small>Tamanho ${esc(l.tam)} · ${brl(l.preco)}${l.kg ? "/kg" : ""} · ${l.code ? esc(l.code) : "sem código"}</small></div><b>×${l.qtd}</b><button class="danger" data-ldrop="${i}" aria-label="Remover">✕</button></div>`).join("") : '<p class="muted">Nenhuma etiqueta na lista.</p>';
}
function labelPick(p) {
  const c = labelCode(p); pend = { nome: p.name, code: c.code, kg: c.kg, tam: "", src: p }; $("eCodBal").value = p.codigo_balanca || "";
  $("ePend").classList.remove("hidden"); $("eNome").textContent = p.name;
  $("eCod").textContent = codeText(c);
  $("ePreco").value = String(store.get(PK, {})[norm(p.name)] || "").replace(".", ","); $("eQtd").value = 1;
  document.querySelectorAll("#eTam button").forEach(b => b.classList.remove("sel")); $("ePend").scrollIntoView({ behavior: "smooth" });
}
async function labelScan(code) {
  if (navigator.vibrate) navigator.vibrate(100); beep(); await stopScanner(); closeModal();
  const scale = /^2\d{12}$/.test(code), item = scale ? Number(parseScale(code).item) : 0;
  let p = scale ? products.find(x => x.codigo_balanca && Number(x.codigo_balanca) === item) : products.find(x => x.barcode === code);
  if (!p) { const nome = (prompt(`Código ${code} não cadastrado. Nome do produto:`) || "").trim(); if (!nome) return;
    p = { name: nome, barcode: scale ? "" : code, codigo_balanca: scale ? String(item) : "", category: scale ? "FLV" : "" }; }
  labelPick(p);
}
$("eScan").onclick = () => openScan("etiqueta");
$("eBusca").oninput = () => { const q = norm($("eBusca").value); if (q.length < 2) { $("eRes").innerHTML = ""; return; }
  const seen = new Set();
  eHits = products.filter(p => norm(p.name || "").includes(q) || (p.barcode || "").includes(q)).filter(p => { const k = p.barcode || p.codigo_balanca || norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  $("eRes").innerHTML = eHits.length ? eHits.map((p, i) => `<p><b>${esc(p.name)}</b> <small class="muted">${esc(p.category)}</small> <button class="secondary" data-pick="${i}">Escolher</button></p>`).join("") : '<p class="muted">Nada encontrado.</p>'; };
$("eRes").onclick = e => { const b = e.target.closest("[data-pick]"); if (b) labelPick(eHits[Number(b.dataset.pick)]); };
$("eTam").onclick = e => { const b = e.target.closest("button"); if (!b || !pend) return; pend.tam = b.dataset.t; document.querySelectorAll("#eTam button").forEach(x => x.classList.toggle("sel", x === b)); };
$("eMenos").onclick = () => { $("eQtd").value = Math.max(1, (Number($("eQtd").value) || 1) - 1); }; $("eMais").onclick = () => { $("eQtd").value = (Number($("eQtd").value) || 0) + 1; };
$("eCodSave").onclick = () => { if (!pend) return; const v = saveCode(pend.src, "codigo_balanca", $("eCodBal").value); if (v === null) return;
  pend.src = { ...pend.src, codigo_balanca: v }; const c = labelCode(pend.src); pend.code = c.code; pend.kg = c.kg; $("eCod").textContent = codeText(c); $("eCodBal").value = v; };
$("eCancela").onclick = () => { pend = null; $("ePend").classList.add("hidden"); };
$("eAdd").onclick = () => {
  if (!pend) return; if (!pend.tam) return toast("Escolha o tamanho: P, M ou G.");
  const preco = parsePrice($("ePreco").value); if (!(preco > 0)) return toast("Digite o preço.");
  labels.push({ nome: pend.nome, code: pend.code, kg: pend.kg, tam: pend.tam, preco, qtd: Math.max(1, Math.round(Number($("eQtd").value) || 1)) }); store.set(EK, labels);
  const pr = store.get(PK, {}); pr[norm(pend.nome)] = preco; store.set(PK, pr);
  pend = null; $("ePend").classList.add("hidden"); $("eBusca").value = ""; $("eRes").innerHTML = ""; renderLabels(); toast("Etiqueta adicionada à lista.");
};
$("eLista").onclick = e => { const b = e.target.closest("[data-ldrop]"); if (!b) return; const x = Number(b.dataset.ldrop), it = labels.splice(x, 1)[0];
  store.set(EK, labels); renderLabels(); toast("Etiqueta removida.", "Desfazer", () => { labels.splice(x, 0, it); store.set(EK, labels); renderLabels(); }); };
$("eLimpa").onclick = () => { if (labels.length && confirm("Apagar toda a lista de impressão?")) { labels = []; store.set(EK, labels); renderLabels(); } };
function barcodeImg(code) { try { const c = document.createElement("canvas"); V.JsBarcode(c, code, { format: "CODE128", displayValue: false, margin: 0, height: 60, width: 2 }); return c.toDataURL("image/png"); } catch { return null; } }
function labelsPdf() {
  const pdf = new V.jsPDF(); let first = true;
  for (const t of ["P", "M", "G"]) {
    const items = labels.filter(l => l.tam === t).flatMap(l => Array(l.qtd).fill(l)); if (!items.length) continue;
    const s = SZ[t], per = s.cols * s.rows, x0 = (210 - s.cols * s.w) / 2;
    items.forEach((l, n) => {
      if (n % per === 0) { if (!first) pdf.addPage(); first = false; }
      const k = n % per, x = x0 + (k % s.cols) * s.w, y = 10 + Math.floor(k / s.cols) * s.h, cx = x + s.w / 2;
      pdf.setDrawColor(170); pdf.setLineWidth(.2); pdf.rect(x, y, s.w, s.h);
      pdf.setTextColor(0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(s.nome);
      pdf.text(pdf.splitTextToSize(l.nome, s.w - 6).slice(0, 2), cx, y + 2 + s.nome * .36, { align: "center" });
      pdf.setFontSize(s.preco); pdf.text(brl(l.preco) + (l.kg ? "/kg" : ""), cx, y + s.h * .62, { align: "center" });
      if (l.code) { const img = barcodeImg(l.code); if (img) pdf.addImage(img, "PNG", x + 6, y + s.h - 2.5 - s.cod * .36 - s.bar, s.w - 12, s.bar);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(s.cod); pdf.text(l.code, cx, y + s.h - 1.5, { align: "center" }); }
    });
  }
  return first ? null : pdf.output("blob");
}
$("ePdf").onclick = async () => {
  if (!labels.length) return toast("A lista de impressão está vazia.");
  try { const blob = labelsPdf(), file = new File([blob], `etiquetas-${iso(new Date())}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Etiquetas", files: [file] }); else download(blob, file.name);
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível gerar o PDF."); } }
};
renderLabels();

if (db) startPresence(); else localStats();

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
let deferred; const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; } };
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("iosHint").classList.remove("hidden");
})();
