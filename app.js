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
const when = d => d === null ? "Sem data" : d < 0 ? `Vencido há ${-d} dia${d < -1 ? "s" : ""}` : d === 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : `Vence em ${d} dias`;
const fmt = e => daysLeft(e) === null ? "—" : new Date(e + "T00:00:00").toLocaleDateString("pt-BR");
const stLabel = p => ({ expired: "Vencido", soon: "A vencer", ok: "No prazo" })[status(p)];

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
  $("category").value = store.get(LC, "") || ""; $("saveNext").classList.remove("hidden");
}
async function stopScanner() {
  const s = scanner; scanner = null;
  if (s) { try { await s.stop(); } catch {} try { s.clear(); } catch {} }
  $("torchBtn").classList.add("hidden");
}
function closeModal() { stopScanner(); $("modal").classList.add("hidden"); resetForm(); }
function openForm(code = "") { resetForm(); show("Cadastrar produto"); $("barcode").value = code; fillKnown(code); $("name").focus(); }
function fillKnown(code) {
  const k = code && products.find(p => p.barcode === code);
  if (k && !$("docId").value) { if (!$("name").value) $("name").value = k.name || ""; if (k.category) $("category").value = k.category; }
}
function edit(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  resetForm(); show("Editar produto"); $("saveNext").classList.add("hidden");
  $("docId").value = id; $("barcode").value = p.barcode || ""; $("name").value = p.name || "";
  $("category").value = p.category || ""; $("quantity").value = p.quantity; $("expiry").value = p.expiry || "";
}
function save(next) {
  const id = $("docId").value, q = Number(String($("quantity").value).replace(",", "."));
  const data = { barcode: $("barcode").value.trim().slice(0, 32), name: $("name").value.trim().slice(0, 120),
    category: $("category").value, expiry: $("expiry").value, quantity: q, por: myName() };
  if (!data.name || !CATS.includes(data.category) || !data.expiry || !(q > 0)) { toast("Preencha nome, categoria, validade e quantidade."); return; }
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
  if (navigator.vibrate) navigator.vibrate(100);
  beep(); await stopScanner(); resetForm();
  const known = products.find(p => p.barcode === code); logScan(code, known);
  show(known ? `Novo lote de «${known.name}» (já há ${products.filter(p => p.barcode === code).length} validade(s))` : "Produto identificado");
  $("barcode").value = code; fillKnown(code); (known ? $("expiry") : $("name")).focus();
}
let scanMode = "estoque";
async function openScan(mode = "estoque") {
  scanMode = mode === "doacao" ? "doacao" : "estoque";
  resetForm(); show(scanMode === "doacao" ? "Bipar itens da doação" : "Ler código de barras", true);
  $("scanManual").textContent = scanMode === "doacao" ? "Concluir" : "Digitar código";
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
$("scanManual").onclick = async () => { await stopScanner(); if (scanMode === "doacao") closeModal(); else openForm(); };
$("closeModal").onclick = closeModal; $("cancelForm").onclick = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal(); });
$("productForm").onsubmit = e => { e.preventDefault(); save(false); };
$("saveNext").onclick = () => { if ($("productForm").reportValidity()) save(true); };
$("barcode").onchange = () => fillKnown($("barcode").value.trim());
$("qMinus").onclick = () => { const q = Number($("quantity").value) || 1; $("quantity").value = Math.max(1, Math.round(q) - 1); };
$("qPlus").onclick = () => { $("quantity").value = Math.round(Number($("quantity").value) || 0) + 1; };
document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const d = today(); d.setDate(d.getDate() + Number(b.dataset.add)); $("expiry").value = iso(d); });
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

// ---------- identificação do aparelho, presença e histórico de leituras ----------
const myId = store.get("validamais-device", null) || (() => { const i = uid().slice(0, 8); store.set("validamais-device", i); return i; })();
const myName = () => store.get("validamais-nome", "") || ("Aparelho " + myId.slice(0, 4));
const ms = t => t && t.toMillis ? t.toMillis() : (t ? Number(t) : Date.now());
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dia(s)`; };
const ONLINE_MS = 3 * 60 * 1000;
let devices = [], scans = [], unsubDev = null, unsubScan = null;
function renderPresence() {
  const now = Date.now(), list = [...devices].sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen));
  const on = list.filter(d => now - ms(d.lastSeen) < ONLINE_MS);
  $("onlineCount").textContent = on.length; $("deviceCount").textContent = list.length;
  $("deviceList").innerHTML = db ? (list.map(d => { const o = now - ms(d.lastSeen) < ONLINE_MS;
    return `<p>${o ? "🟢" : "⚪"} <b>${esc(d.nome || d.id)}</b> (${esc(d.ua || "")}) · ${o ? "online agora" : "visto " + ago(ms(d.lastSeen))} · ${esc(d.visitas || 1)} acesso(s)</p>`; }).join("") || '<p class="muted">Carregando…</p>')
    : '<p class="muted">Disponível quando o Firebase estiver configurado.</p>';
}
function renderScans() {
  $("scanList").innerHTML = scans.length ? scans.map(s => `<p><b>${esc(s.barcode)}</b> · ${s.cadastrado ? esc(s.nome) : "não cadastrado"}<br><span class="muted">${new Date(ms(s.em)).toLocaleString("pt-BR")} · ${esc(s.por || "")}</span></p>`).join("") : '<p class="muted">Nenhuma leitura ainda.</p>';
}
function logScan(code, known) {
  const rec = { barcode: String(code).slice(0, 32), nome: ((known && known.name) || "").slice(0, 120), por: myName().slice(0, 40), cadastrado: !!known };
  if (db) V.addDoc(V.collection(db, "scans"), { ...rec, em: V.serverTimestamp() }).catch(console.error);
  else { const l = store.get("validamais-scans", []); l.unshift({ ...rec, em: Date.now() }); store.set("validamais-scans", l.slice(0, 200)); }
}
function startPresence() {
  const ref = V.doc(db, "devices", myId), ua = navigator.userAgent;
  const first = store.get("validamais-first", null) || (() => { const f = new Date().toISOString(); store.set("validamais-first", f); return f; })();
  const beat = () => { if (document.visibilityState === "visible") V.setDoc(ref, { nome: myName().slice(0, 40), lastSeen: V.serverTimestamp() }, { merge: true }).catch(() => {}); };
  V.setDoc(ref, { nome: myName().slice(0, 40), firstSeen: first, lastSeen: V.serverTimestamp(), visitas: V.increment(1), ua: /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Computador" }, { merge: true }).catch(console.error);
  setInterval(beat, 120000); document.addEventListener("visibilitychange", beat); $("meuNome").onchange = beat;
}
$("meuNome").value = store.get("validamais-nome", "");
$("meuNome").oninput = () => store.set("validamais-nome", $("meuNome").value.trim().slice(0, 40));
// Só escuta a nuvem enquanto o painel está aberto (economiza a cota gratuita)
$("usersBox").ontoggle = () => {
  if ($("usersBox").open) { renderPresence(); if (db && !unsubDev) unsubDev = V.onSnapshot(V.collection(db, "devices"), s => { devices = s.docs.map(d => ({ id: d.id, ...d.data() })); renderPresence(); }); }
  else if (unsubDev) { unsubDev(); unsubDev = null; }
};
$("scansBox").ontoggle = () => {
  if ($("scansBox").open) { if (db) { if (!unsubScan) unsubScan = V.onSnapshot(V.query(V.collection(db, "scans"), V.orderBy("em", "desc"), V.limit(30)), s => { scans = s.docs.map(d => d.data()); renderScans(); }); }
    else { scans = store.get("validamais-scans", []).slice(0, 30); renderScans(); } }
  else if (unsubScan) { unsubScan(); unsubScan = null; }
};
setInterval(() => { if ($("usersBox").open) renderPresence(); }, 30000);


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

// ---------- aba Doação ----------
const DK = "validamais-doacao", HK = "validamais-doacoes", NK = "validamais-dnomes";
let don = store.get(DK, null) || { itens: [], inicio: new Date().toISOString() }, dSel = "", dVal = "", curRom = null, histList = [], unsubHist = null, lastScan = { c: "", t: 0 };
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const fq = q => (Math.round(q * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sumU = u => don.itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0);
const dataBR = d => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
function tab(t) {
  ["Estoque", "Doacao"].forEach(n => { $("tab" + n).classList.toggle("hidden", n !== t); $("nav" + n).classList.toggle("active", n === t); });
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
  let nome = (unidade === "un" && (products.find(p => p.barcode === code) || {}).name) || names[key];
  if (!nome) { nome = (prompt(unidade === "kg" ? `Item de balança ${key.slice(1)} (${fq(qtd)} kg). Qual o nome do produto?` : `Código ${code}. Qual o nome do produto?`) || "").trim();
    if (!nome) { lastScan.t = Date.now(); return; } names[key] = nome; store.set(NK, names); }
  const total = addDon(nome, unidade, qtd);
  toast(`${nome}: +${fq(qtd)} ${unidade} → total ${fq(total)} ${unidade}`); lastScan.t = Date.now();
}
// pesagem manual
function renderKey() { $("dNome").textContent = dSel || "Toque num produto"; $("dValor").textContent = dVal || "0"; document.querySelectorAll("#dAtalhos button[data-n]").forEach(b => b.classList.toggle("sel", b.dataset.n === dSel)); }
const atalhos = C.doacaoAtalhos || ["Mamão", "Banana", "Tomate", "Pão Francês", "Laranja", "Batata", "Cebola", "Maçã", "Cenoura", "Alface"];
$("dAtalhos").innerHTML = atalhos.map(n => `<button type="button" data-n="${esc(n)}">${esc(n)}</button>`).join("") + '<button type="button" id="dOutro">＋ Outro</button>';
$("keypad").innerHTML = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"].map(k => `<button type="button" data-k="${k}">${k}</button>`).join("") + '<button type="button" class="add" id="dAdd">Adicionar</button>';
$("dAtalhos").onclick = e => { const b = e.target.closest("button"); if (!b) return;
  if (b.id === "dOutro") { const n = (prompt("Nome do produto:") || "").trim(); if (n) dSel = n.slice(0, 60); } else dSel = b.dataset.n; renderKey(); };
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
  return [`ROMANEIO DE DOAÇÃO - ${C.loja || "Valida+"}`, `Data: ${dataBR(d.data)}`, `Responsável: ${d.por}`, "------------------------",
    ...d.itens.map(i => `${i.nome}: ${fq(i.qtd)} ${i.unidade}`), "------------------------",
    `TOTAL: ${fq(d.totalKg)} kg · ${fq(d.totalUn)} un (${d.itens.length} itens)`].join("\n");
}
function romPdf(d) {
  const pdf = new V.jsPDF(); pdf.setFontSize(16); pdf.text("Romaneio de doação", 14, 16);
  pdf.setFontSize(9); pdf.text(`${C.loja || "Valida+"} · ${dataBR(d.data)} · Responsável: ${d.por}`, 14, 22);
  V.autoTable(pdf, { startY: 27, styles: { fontSize: 9 }, headStyles: { fillColor: [22, 101, 52] }, footStyles: { fillColor: [226, 238, 229], textColor: [20, 83, 45] },
    head: [["Item", "Quantidade", "Lançamentos"]], body: d.itens.map(i => [i.nome, `${fq(i.qtd)} ${i.unidade}`, i.lanc]),
    foot: [["TOTAL", `${fq(d.totalKg)} kg · ${fq(d.totalUn)} un`, ""]] });
  return pdf.output("blob");
}
function showRomaneio(d) {
  curRom = d; $("donaEntrada").classList.add("hidden"); $("donaRomaneio").classList.remove("hidden");
  $("romBody").innerHTML = `<p class="note">${dataBR(d.data)} · ${esc(d.por)}</p><div class="stats"><div class="stat"><b>${fq(d.totalKg)}</b><span>kg doados</span></div><div class="stat"><b>${fq(d.totalUn)}</b><span>unidades</span></div><div class="stat"><b>${d.itens.length}</b><span>itens</span></div></div>` +
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
  $("dHist").innerHTML = l.length ? l.map((h, i) => `<p><b>${dataBR(h.data)}</b> · ${fq(h.totalKg)} kg · ${fq(h.totalUn)} un · ${esc(h.por)} <button class="secondary" data-hist="${i}">Abrir</button></p>`).join("") : '<p class="muted">Nenhuma doação finalizada.</p>'; }
$("dHist").onclick = e => { const b = e.target.closest("[data-hist]"); if (b) showRomaneio(histList[Number(b.dataset.hist)]); };
$("histBox").ontoggle = () => {
  if ($("histBox").open) { if (db) { if (!unsubHist) unsubHist = V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(10)), s => renderHist(s.docs.map(d => d.data()))); } else renderHist(store.get(HK, []).slice(0, 10)); }
  else if (unsubHist) { unsubHist(); unsubHist = null; } };
$("navEstoque").onclick = () => tab("Estoque"); $("navDoacao").onclick = () => tab("Doacao"); $("dScan").onclick = () => openScan("doacao");
renderDon(); renderKey();

if (db) startPresence();

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
let deferred; const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; } };
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("iosHint").classList.remove("hidden");
})();
