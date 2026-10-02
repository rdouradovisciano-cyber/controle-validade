(() => {
"use strict";
const C = window.VALIDA_CONFIG || {}, V = window.V || {}, fb = C.firebase || {};
const CATS = ["Ovos","FLV","Padaria","Laticínios","Mercearia","Bebidas","Congelados","Higiene e limpeza","Outros"];
const $ = id => document.getElementById(id);
const LK = "validamais-produtos-v1", LC = "validamais-ultima-categoria", TK = "validamais-tam";
let curTab = "Loja";
const LOJA = C.loja || "Sam's Club Radial Leste";
const EMPTY_FLV = '<div class="empty"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#9db8a4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 28h44l-5 22a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3z"/><path d="M22 28c0-9 4-16 10-16s10 7 10 16"/><path d="M32 12c0-4 3-7 8-7 0 5-3 8-8 7z"/></svg><p>Nenhum produto do FLV com validade para vencer no momento.</p></div>';
let products = [], db = null, scanner = null, toastTimer;
const cloud = !!fb.apiKey && !/COLE_|SEU_/.test(fb.apiKey + fb.projectId);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- tela de conferência (abre pelo link enviado no WhatsApp; não usa Firebase) ----------
function b64e(o) { let s = ""; new TextEncoder().encode(JSON.stringify(o)).forEach(c => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0)))); }
const hashStr = s => { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const nBR = n => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
function confUrl(d) {
  const o = { c: d.codigo || "", d: d.data, l: LOJA, k: d.totalKg, u: d.totalUn, i: d.itens.map(i => [i.cod || "-", i.nome, nBR(i.qtd) + " " + i.unidade]) };
  return location.origin + location.pathname.replace(/index\.html$/, "") + "#conf=" + b64e(o);
}
function confMode() {
  if (!location.hash.startsWith("#conf=")) return false;
  ["main.app", "#sectorBox", "#fab", "#side", "#sideBg", "#modal", "#impModal", "#toast"].forEach(q => { const el = document.querySelector(q); if (el) el.classList.add("hidden"); });
  const view = $("confView"); view.classList.remove("hidden"); let d;
  try { d = b64d(location.hash.slice(6)); } catch { view.innerHTML = '<p class="note">Link inválido ou incompleto. Peça para reenviar.</p>'; return true; }
  const KEY = "validamais-cv-" + hashStr(location.hash); let on = store.get(KEY, []);
  const day = new Date(d.d + "T00:00:00").toLocaleDateString("pt-BR"), title = `DOAÇÃO FLV ${d.c || ""}`.trim();
  const draw = () => { const n = on.filter(Boolean).length;
    view.innerHTML = `<h1 class="romtitle">${esc(title)}</h1><p class="note">Data: ${day} · Loja: ${esc(d.l)}</p><div class="prog"><div style="width:${d.i.length ? Math.round(n / d.i.length * 100) : 0}%"></div></div><p class="note"><b>${n} de ${d.i.length}</b> conferidos · toque no item para riscar</p>` +
      d.i.map((r, x) => `<label class="crow ${on[x] ? "done" : ""}" data-x="${x}"><input type="checkbox" ${on[x] ? "checked" : ""}><span class="ct"><b>${esc(r[0])}</b> · ${esc(r[1])}</span><span class="cq">${esc(r[2])}</span></label>`).join("") +
      `<p class="romtotal">TOTAL: ${nBR(d.k)} kg · ${nBR(d.u)} un · ${d.i.length} itens</p><div class="toolbar" style="margin-top:12px"><button class="primary big" id="cvSend">Enviar conferência no WhatsApp</button><button class="secondary" id="cvReset">Desmarcar tudo</button></div><p class="note" style="text-align:center"><a href="./">Abrir o Valida+</a></p>`; };
  view.onchange = e => { const l = e.target.closest("[data-x]"); if (!l) return; on[Number(l.dataset.x)] = e.target.checked; store.set(KEY, on); draw(); };
  view.onclick = async e => {
    if (e.target.id === "cvReset" && confirm("Desmarcar todos os itens?")) { on = []; store.set(KEY, on); draw(); }
    if (e.target.id !== "cvSend") return;
    const n = on.filter(Boolean).length, t = [`CONFERÊNCIA - ${title}`, `Data: ${day}`, `Loja: ${d.l}`, `Conferidos: ${n} de ${d.i.length}`, "------------------------",
      ...d.i.map((r, x) => on[x] ? `[x] ~${r[0]} | ${r[1]} | ${r[2]}~` : `[ ] ${r[0]} | ${r[1]} | ${r[2]}`), "------------------------", `TOTAL: ${nBR(d.k)} kg · ${nBR(d.u)} un · ${d.i.length} itens`].join("\n");
    if (navigator.share) { try { await navigator.share({ title: "Conferência", text: t }); } catch {} } else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
  };
  draw(); return true;
}
if (confMode()) return;

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
  const cnt = {}; products.forEach(p => { if (p.barcode) cnt[p.barcode] = (cnt[p.barcode] || 0) + 1; });
  const hoje = products.filter(p => daysLeft(p.expiry) === 0 && (!cat || p.category === cat));
  $("todayBanner").classList.toggle("hidden", !hoje.length);
  $("todayBanner").textContent = `⚠ VENCEM HOJE (${hoje.length}): ` + hoje.slice(0, 5).map(p => p.name).join(", ") + (hoje.length > 5 ? "…" : "");
  if (!hoje.length) alarmed = false; else if (!alarmed && actx) { alarmed = true; alarm(); }
  const rows = products.filter(p => (!cat || p.category === cat) && !(cat === "FLV" && daysLeft(p.expiry) === null) && (!st || status(p) === st) &&
    (!q || (p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q)))
    .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  $("list").innerHTML = rows.length ? rows.map(p => { const dl = daysLeft(p.expiry), cls = dl === null ? "none" : dl <= 0 ? "expired" : status(p);
    return `<article class="product ${cls}"><div class="ctop"><h3>${esc(p.name)}</h3><span class="upd">Última atualização: ${dayOf(p)}</span></div><p class="meta">Cód.: ${esc(p.barcode || (p.codigo_balanca ? "PLU " + p.codigo_balanca : "—"))} · ${esc(p.category)} · Qtd: ${esc(p.quantity)}</p><p class="meta">Validade: <b>${fmt(p.expiry)}</b>${cnt[p.barcode] > 1 ? ` · ${cnt[p.barcode]} lotes` : ""}</p><div class="pills"><span class="pill">${when(dl)}</span></div><div class="actions"><button class="secondary" data-edit="${esc(p.id)}">Editar</button><button class="danger" data-del="${esc(p.id)}">Excluir</button></div></article>`;
  }).join("") : (cat === "FLV" && !q && !st ? EMPTY_FLV : '<p class="muted">Nenhum produto encontrado. Use "Bipar código" ou "Cadastro manual".</p>');
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
    if (id) products = products.map(x => x.id === id ? { ...x, ...data, updatedAt: Date.now() } : x); else products.push({ ...data, id: uid(), updatedAt: Date.now() });
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
  pdf.setFontSize(9); pdf.text(`${LOJA} · Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} produto(s)`, 14, 22);
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
$("manualOpen").onclick = () => openForm(); $("fab").onclick = () => openScan(curTab === "Doacao" ? "doacao" : curTab === "Etiquetas" ? "etiqueta" : "loja"); $("retryScan").onclick = () => openScan(scanMode);
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
function norm(s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function pkey(p) { return p.barcode || norm(p.name); }
function tamOf(p) { return (p && store.get(TK, {})[pkey(p)]) || "M"; }
function dayOf(p) { const t = p.updatedAt, v = t && t.toMillis ? t.toMillis() : (t ? Number(t) : Date.now()); return new Date(v).toLocaleDateString("pt-BR"); }
const fq = q => (Math.round(q * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sumU = u => don.itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0);
const dataBR = d => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
function tab(t) {
  curTab = t;
  ["Loja", "Doacao", "Etiquetas"].forEach(n => { $("tab" + n).classList.toggle("hidden", n !== t); $("nav" + n).classList.toggle("active", n === t); });
}
function renderDon() {
  $("dKg").textContent = fq(sumU("kg")); $("dUn").textContent = fq(sumU("un")); $("dItens").textContent = don.itens.length;
  $("dLista").innerHTML = don.itens.length ? don.itens.map((i, x) => `<div class="drow"><div><b>${esc(i.nome)}</b><small>${i.lanc} lançamento(s)</small></div><b>${fq(i.qtd)} ${esc(i.unidade)}</b><button class="danger" data-drop="${x}" aria-label="Remover ${esc(i.nome)}">✕</button></div>`).join("") : '<p class="muted">Nada lançado ainda. Bipe um item ou use a pesagem.</p>';
}
function addDon(nome, unidade, qtd, cod = "") {
  qtd = Math.round(qtd * 1000) / 1000; if (!(qtd > 0)) return 0;
  const key = norm(nome) + "|" + unidade; let it = don.itens.find(i => i.key === key);
  if (it) { it.qtd = Math.round((it.qtd + qtd) * 1000) / 1000; it.lanc++; } else { it = { key, nome: nome.trim().slice(0, 60), unidade, qtd, lanc: 1 }; don.itens.push(it); }
  const pr = products.find(x => norm(x.name) === norm(nome)); it.cod = it.cod || cod || (pr && (pr.codigo_doacao || pr.barcode || pr.codigo_balanca)) || "";
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
  const total = addDon(nome, unidade, qtd, unidade === "un" ? code : "");
  toast(`${nome}: +${fq(qtd)} ${unidade} → total ${fq(total)} ${unidade}`); lastScan.t = Date.now();
}
// pesagem manual
function renderKey() { $("dNome").textContent = dSel || "Busque um produto acima"; $("dValor").textContent = dVal || "0"; }
const DEFN = ["Mamão", "Banana", "Tomate", "Pão Francês", "Laranja", "Batata", "Cebola", "Maçã", "Cenoura", "Alface"];
function dSuggest() {
  const raw = $("dBusca").value.trim(), q = norm(raw); if (!q) { $("dSug").innerHTML = ""; return; }
  const byCode = products.filter(p => p.codigo_doacao && String(p.codigo_doacao).toLowerCase() === q).map(p => p.name);
  const names = [...new Set([...products.map(p => p.name), ...(C.doacaoAtalhos || DEFN)])].filter(n => norm(n).includes(q) && !byCode.includes(n)).slice(0, 6);
  const list = [...new Set([...byCode, ...names])], exact = list.some(n => norm(n) === q);
  $("dSug").innerHTML = list.map(n => `<button type="button" data-sel="${esc(n)}">${esc(n)}</button>`).join("") +
    (exact ? "" : `<button type="button" data-sel="${esc(raw.slice(0, 60))}">＋ Usar «${esc(raw.slice(0, 60))}» como novo produto</button>`);
}
$("dBusca").oninput = dSuggest;
$("dBusca").onkeydown = e => { if (e.key === "Enter") { const b = $("dSug").querySelector("[data-sel]"); if (b) b.click(); } };
$("dSug").onclick = e => { const b = e.target.closest("[data-sel]"); if (b) selectProd(b.dataset.sel); };
function selectProd(n) { dSel = n; $("dCod").value = (products.find(x => norm(x.name) === norm(n)) || {}).codigo_doacao || ""; $("dBusca").value = ""; $("dSug").innerHTML = ""; renderKey(); }
$("dCodSave").onclick = () => { if (!dSel) return toast("Escolha o produto primeiro."); const pr = products.find(x => norm(x.name) === norm(dSel)) || { name: dSel };
  const v = saveCode(pr, "codigo_doacao", $("dCod").value); if (v !== null) $("dCod").value = v; };
$("keypad").innerHTML = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"].map(k => `<button type="button" data-k="${k}">${k}</button>`).join("") + '<button type="button" class="add" id="dAdd">Adicionar</button>';
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
$("dLimpar").onclick = () => { if (don.itens.length && confirm("Apagar toda a lista da doação atual?")) { don = { itens: [], inicio: new Date().toISOString(), codigo: "" }; $("dNum").value = ""; store.set(DK, don); renderDon(); } };
// romaneio
function romText(d) {   // texto para o WhatsApp + link da tela de conferência (toque risca o item)
  return [`DOAÇÃO FLV ${d.codigo || ""}`.trim(), `Data: ${dataBR(d.data)}`, `Loja: ${LOJA}`, "------------------------",
    ...d.itens.map(i => `[ ] ${i.cod || "-"} | ${i.nome} | ${fq(i.qtd)} ${i.unidade}`), "------------------------",
    `TOTAL: ${fq(d.totalKg)} kg · ${fq(d.totalUn)} un · ${d.itens.length} itens`, "",
    "👉 Toque no link para conferir e riscar os itens:", confUrl(d)].join("\n");
}
function romPdf(d) {    // PDF com coluna CONFERIDO (caixinhas vazias para marcar)
  const pdf = new V.jsPDF(); pdf.setFontSize(18); pdf.setFont("helvetica", "bold"); pdf.text(`DOAÇÃO FLV ${d.codigo || ""}`.trim(), 14, 16);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`Data: ${dataBR(d.data)}   Loja: ${LOJA}`, 14, 23);
  pdf.setTextColor(22, 101, 52); pdf.textWithLink("Toque aqui para conferir e riscar os itens no celular", 14, 29, { url: confUrl(d) }); pdf.setTextColor(0);
  V.autoTable(pdf, { startY: 34, styles: { fontSize: 10, cellPadding: 2.5 }, headStyles: { fillColor: [22, 101, 52] }, footStyles: { fillColor: [226, 238, 229], textColor: [20, 83, 45] }, columnStyles: { 0: { cellWidth: 26 } },
    head: [["CONFERIDO", "CÓDIGO", "NOME", "QUANTIDADES"]], body: d.itens.map(i => ["", i.cod || "-", i.nome, `${fq(i.qtd)} ${i.unidade}`]),
    foot: [["", "TOTAL", `${fq(d.totalKg)} kg · ${fq(d.totalUn)} un`, `${d.itens.length} itens`]],
    didDrawCell: h => { if (h.section === "body" && h.column.index === 0) { const c = h.cell; pdf.setDrawColor(60); pdf.setLineWidth(.3); pdf.rect(c.x + 9, c.y + c.height / 2 - 2, 4, 4); } } });
  return pdf.output("blob");
}
function showRomaneio(d) {
  curRom = d; $("donaEntrada").classList.add("hidden"); $("donaRomaneio").classList.remove("hidden");
  $("romHead").innerHTML = `<h3 class="romtitle">DOAÇÃO FLV ${esc(d.codigo || "")}</h3><p class="note">Data: ${dataBR(d.data)} · Loja: ${esc(LOJA)}</p>`;
  $("romBody").innerHTML = `<div class="rwrap"><table class="rom"><thead><tr><th>CÓDIGO</th><th>NOME</th><th>QUANTIDADES</th></tr></thead><tbody>` +
    d.itens.map(i => `<tr><td>${esc(i.cod || "—")}</td><td>${esc(i.nome)}</td><td>${fq(i.qtd)} ${esc(i.unidade)}</td></tr>`).join("") +
    `</tbody></table></div><p class="romtotal">TOTAL: ${fq(d.totalKg)} kg · ${fq(d.totalUn)} un · ${d.itens.length} itens</p>`;
}
$("rZap").onclick = async () => { const t = romText(curRom);
  if (navigator.share) { try { await navigator.share({ title: "Romaneio de doação", text: t }); } catch (e) { if (e.name !== "AbortError") toast("Não foi possível compartilhar."); } }
  else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank"); };
$("rPdf").onclick = async () => { try { const blob = romPdf(curRom), file = new File([blob], `romaneio-doacao-${curRom.data}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Romaneio de doação", files: [file] }); else download(blob, file.name);
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível gerar o PDF."); } } };
$("rConf").onclick = () => { location.hash = confUrl(curRom).split("#")[1]; location.reload(); };
$("rNova").onclick = () => { $("donaRomaneio").classList.add("hidden"); $("donaEntrada").classList.remove("hidden"); };
function finalizeDon() {
  const rec = { data: iso(new Date()), por: myName().slice(0, 40), codigo: String(don.codigo || "").slice(0, 12), totalKg: Math.round(sumU("kg") * 1000) / 1000, totalUn: Math.round(sumU("un") * 1000) / 1000,
    itens: don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc, cod: cod || "" })) };
  if (db) V.addDoc(V.collection(db, "doacoes"), { ...rec, em: V.serverTimestamp() }).catch(e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras). O romaneio foi gerado."); });
  else { const h = store.get(HK, []); h.unshift({ ...rec, em: Date.now() }); store.set(HK, h.slice(0, 50)); }
  don = { itens: [], inicio: new Date().toISOString(), codigo: "" }; $("dNum").value = ""; store.set(DK, don); renderDon(); showRomaneio(rec);
}
$("dFinalizar").onclick = () => {      // pede o número da nota fiscal antes de finalizar
  if (!don.itens.length) return toast("A lista está vazia.");
  $("nfInfo").textContent = `Total: ${fq(sumU("kg"))} kg · ${fq(sumU("un"))} un · ${don.itens.length} itens. O número aparece no romaneio como «DOAÇÃO FLV número».`;
  $("nfNum").value = don.codigo || ""; $("nfModal").classList.remove("hidden"); $("nfNum").focus();
};
$("nfOk").onclick = () => { const v = $("nfNum").value.replace(/\D/g, "").slice(0, 12); if (!v) return toast("Digite o número da nota fiscal.");
  don.codigo = v; store.set(DK, don); $("nfModal").classList.add("hidden"); finalizeDon(); };
$("nfCancel").onclick = () => $("nfModal").classList.add("hidden");
$("nfNum").onkeydown = e => { if (e.key === "Enter") $("nfOk").click(); };
function renderHist(l) { histList = l;
  $("dHist").innerHTML = l.length ? l.map((h, i) => `<p><b>${dataBR(h.data)}</b> · ${fq(h.totalKg)} kg · ${fq(h.totalUn)} un <button class="secondary" data-hist="${i}">Abrir</button></p>`).join("") : '<p class="muted">Nenhuma doação finalizada.</p>'; }
$("dHist").onclick = e => { const b = e.target.closest("[data-hist]"); if (b) showRomaneio(histList[Number(b.dataset.hist)]); };
$("histBox").ontoggle = () => {
  if ($("histBox").open) { if (db) { if (!unsubHist) unsubHist = V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(10)), s => renderHist(s.docs.map(d => d.data()))); } else renderHist(store.get(HK, []).slice(0, 10)); }
  else if (unsubHist) { unsubHist(); unsubHist = null; } };
const go = t => { tab(t); side(false); }; $("navLoja").onclick = () => go("Loja"); $("navDoacao").onclick = () => go("Doacao"); $("navEtiquetas").onclick = () => go("Etiquetas"); $("dScan").onclick = () => openScan("doacao");
$("dNum").value = don.codigo || ""; $("dNum").oninput = () => { don.codigo = $("dNum").value.trim().slice(0, 12); store.set(DK, don); };
renderDon(); renderKey();

// ---------- aba Etiquetas ----------
const EK = "validamais-etiquetas";
const SZ = { P: { w: 63, h: 30, cols: 3, rows: 9, nome: 8, preco: 15, cod: 6, bar: 6 }, M: { w: 95, h: 50, cols: 2, rows: 5, nome: 12, preco: 26, cod: 8, bar: 12 }, G: { w: 190, h: 90, cols: 1, rows: 3, nome: 20, preco: 52, cod: 11, bar: 24 } };
let labels = store.get(EK, []), pend = null, eHits = [];
// itens pesados (FLV/Padaria) usam o código de balança; os demais usam o EAN
const codeText = c => c.code ? `${c.kg ? "Código de balança" : "EAN"}: ${c.code}` : "⚠ Sem código cadastrado para este produto.";
const labelCode = p => (p.codigo_balanca && (["FLV", "Padaria"].includes(p.category) || !p.barcode)) ? { code: String(p.codigo_balanca), kg: true } : { code: p.barcode || "", kg: false };
function renderLabels() {
  $("eLista").innerHTML = labels.length ? labels.map((l, i) => `<div class="lcard"><div class="lcode">${l.code ? esc(l.code) : "SEM CÓDIGO"}</div><div class="lname">${esc(l.nome)}</div><div class="lrow"><div class="ltam" data-i="${i}">${["P", "M", "G"].map(t => `<button type="button" data-t="${t}" class="${(l.tam || "M") === t ? "sel" : ""}">${t}</button>`).join("")}</div><b class="lqtd">x${l.qtd}</b><button class="danger" data-ldrop="${i}" aria-label="Remover ${esc(l.nome)}">✕</button></div></div>`).join("") : '<p class="muted">Nenhuma etiqueta na lista.</p>';
}
function labelPick(p) {
  const c = labelCode(p); pend = { nome: p.name, code: c.code, kg: c.kg, tam: tamOf(p), src: p }; $("eCodBal").value = p.codigo_balanca || "";
  $("ePend").classList.remove("hidden"); $("eNome").textContent = p.name;
  $("eCod").textContent = codeText(c);
  $("eQtd").value = 1;
  document.querySelectorAll("#eTam button").forEach(b => b.classList.toggle("sel", b.dataset.t === pend.tam)); $("ePend").scrollIntoView({ behavior: "smooth" });
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
$("eTam").onclick = e => { const b = e.target.closest("button"); if (!b || !pend) return; pend.tam = b.dataset.t; { const m = store.get(TK, {}); m[pkey(pend.src)] = pend.tam; store.set(TK, m); } document.querySelectorAll("#eTam button").forEach(x => x.classList.toggle("sel", x === b)); };
$("eMenos").onclick = () => { $("eQtd").value = Math.max(1, (Number($("eQtd").value) || 1) - 1); }; $("eMais").onclick = () => { $("eQtd").value = (Number($("eQtd").value) || 0) + 1; };
$("eCodSave").onclick = () => { if (!pend) return; const v = saveCode(pend.src, "codigo_balanca", $("eCodBal").value); if (v === null) return;
  pend.src = { ...pend.src, codigo_balanca: v }; const c = labelCode(pend.src); pend.code = c.code; pend.kg = c.kg; $("eCod").textContent = codeText(c); $("eCodBal").value = v; };
$("eCancela").onclick = () => { pend = null; $("ePend").classList.add("hidden"); };
$("eAdd").onclick = () => {
  if (!pend) return; if (!pend.tam) return toast("Escolha o tamanho: P, M ou G.");
  labels.push({ nome: pend.nome, code: pend.code, kg: pend.kg, tam: pend.tam || "M", key: pkey(pend.src), qtd: Math.max(1, Math.round(Number($("eQtd").value) || 1)) }); store.set(EK, labels);
  pend = null; $("ePend").classList.add("hidden"); $("eBusca").value = ""; $("eRes").innerHTML = ""; renderLabels(); toast("Item adicionado à lista.");
};
$("eLista").onclick = e => { const b = e.target.closest("[data-ldrop]"); if (!b) return; const x = Number(b.dataset.ldrop), it = labels.splice(x, 1)[0];
  store.set(EK, labels); renderLabels(); toast("Etiqueta removida.", "Desfazer", () => { labels.splice(x, 0, it); store.set(EK, labels); renderLabels(); }); };
$("eLista").addEventListener("click", ev => { const b = ev.target.closest(".ltam button"); if (!b) return; const i = Number(b.parentElement.dataset.i), l = labels[i]; if (!l || l.tam === b.dataset.t) return;
  l.tam = b.dataset.t; store.set(EK, labels); const m = store.get(TK, {}); if (l.key) { m[l.key] = l.tam; store.set(TK, m); } renderLabels(); });
renderLabels();

// ---------- importar lista de produtos (nome + códigos) ----------
const HDR = { nome: /^(nome|produto|descri)/, bal: /(balan|plu)/, doa: /doa/, ean: /(ean|barra|gtin)/, cat: /(categ|setor)/ };
const catOf = s => { const n = norm(s); return CATS.find(c => norm(c) === n) || (/^(hortifruti|fruta|legume|verdura)/.test(n) ? "FLV" : null); };
const cleanNum = s => String(s || "").trim().replace(/\.0+$/, "");
function parseRows(text) {
  const lines = String(text).replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean); if (!lines.length) return [];
  const sample = lines.slice(0, 5).join("\n"), d = ["\t", ";", "|"].find(c => sample.includes(c)) || ",";
  let cols = { nome: 0, bal: 1, doa: 2, ean: 3, cat: 4 }, start = 0;
  const head = lines[0].split(d).map(c => norm(c));
  if (head.some(c => HDR.nome.test(c))) { cols = {}; head.forEach((c, i) => { for (const k in HDR) if (!(k in cols) && HDR[k].test(c)) { cols[k] = i; break; } }); start = 1; }
  return lines.slice(start).map((l, i) => { const c = l.split(d).map(x => x.trim().replace(/^"|"$/g, "").trim()), g = k => cols[k] === undefined ? "" : (c[cols[k]] || "");
    return { linha: start + i + 1, nome: g("nome").slice(0, 120), bal: cleanNum(g("bal")), doa: g("doa").replace(/\s+/g, "").toUpperCase(), ean: cleanNum(g("ean")), cat: g("cat") }; });
}
function analyzeList(text) {
  const out = [], seen = new Set(), claims = { codigo_balanca: {}, codigo_doacao: {} };
  products.forEach(x => { const k = x.barcode || norm(x.name); ["codigo_balanca", "codigo_doacao"].forEach(f => { if (x[f]) claims[f][String(x[f]).toUpperCase()] = { k, nome: x.name }; }); });
  for (const r of parseRows(text).slice(0, 500)) {
    const bad = msg => out.push({ ...r, st: "erro", msg });
    if (!r.nome) { bad("sem nome"); continue; }
    if (r.bal && !/^\d{1,6}$/.test(r.bal)) { bad("código de balança inválido (só números, até 6)"); continue; }
    if (r.doa && !/^[A-Z0-9]{1,12}$/.test(r.doa)) { bad("código de doação inválido (letras/números, até 12)"); continue; }
    if (r.ean && !/^\d{6,14}$/.test(r.ean)) { bad("EAN inválido"); continue; }
    let cat = ""; if (r.cat) { cat = catOf(r.cat); if (!cat) { bad("categoria desconhecida: " + r.cat); continue; } }
    const matched = products.filter(x => r.ean ? (x.barcode === r.ean || (!x.barcode && norm(x.name) === norm(r.nome))) : norm(x.name) === norm(r.nome));
    const key = matched.length ? (matched[0].barcode || norm(matched[0].name)) : (r.ean || norm(r.nome));
    if (seen.has(key)) { bad("produto repetido na lista"); continue; }
    const pairs = [["codigo_balanca", r.bal], ["codigo_doacao", r.doa]].filter(([, v]) => v);
    const clash = pairs.map(([f, v]) => ({ v, c: claims[f][v] })).find(x => x.c && x.c.k !== key);
    if (clash) { bad(`código ${clash.v} já pertence a «${clash.c.nome}»`); continue; }
    seen.add(key); pairs.forEach(([f, v]) => { claims[f][v] = { k: key, nome: r.nome }; });
    out.push({ ...r, cat, matched, st: matched.length ? "atualiza" : "novo" });
  }
  return out;
}
function applyImport(rows) {
  const ts = db ? V.serverTimestamp() : null, fail = e => { console.error(e); toast("Erro ao salvar na nuvem."); }; let n = 0, u = 0;
  for (const r of rows.filter(x => x.st !== "erro")) {
    const f = {}; if (r.bal) f.codigo_balanca = r.bal; if (r.doa) f.codigo_doacao = r.doa; if (r.ean) f.barcode = r.ean; if (r.cat) f.category = r.cat;
    if (r.matched.length) { u++; r.matched.forEach(x => db ? V.updateDoc(V.doc(db, "products", x.id), { ...f, updatedAt: ts }).catch(fail) : Object.assign(x, f)); }
    else { n++; const rec = { name: r.nome, barcode: "", category: "FLV", expiry: "", quantity: 1, por: myName(), codigo_balanca: "", codigo_doacao: "", ...f };
      if (db) V.addDoc(V.collection(db, "products"), { ...rec, createdAt: ts, updatedAt: ts }).catch(fail); else products.push({ ...rec, id: uid() }); }
  }
  if (!db) { persist(); render(); } return { n, u };
}
let impRows = [];
function impCheck() {
  impRows = analyzeList($("impText").value); const ok = impRows.filter(r => r.st !== "erro").length, er = impRows.length - ok;
  $("impGo").disabled = !ok; $("impGo").textContent = ok ? `Cadastrar ${ok} produto(s)` : "Cadastrar";
  $("impPrev").innerHTML = impRows.length ? `<p><b>${impRows.filter(r => r.st === "novo").length} novos · ${impRows.filter(r => r.st === "atualiza").length} atualizações · ${er} com erro</b></p><div class="impl">` +
    impRows.map(r => r.st === "erro" ? `<p class="bad">✖ Linha ${r.linha}: ${esc(r.msg)}</p>` : `<p>${r.st === "novo" ? "＋" : "↻"} <b>${esc(r.nome)}</b> <span class="muted">${[r.bal && "Balança " + r.bal, r.doa && "Doação " + r.doa, r.ean && "EAN " + r.ean, r.cat && esc(r.cat)].filter(Boolean).join(" · ") || "sem códigos"}</span></p>`).join("") + "</div>" : '<p class="muted">Nenhuma linha encontrada.</p>';
}
const impOpen = o => $("impModal").classList.toggle("hidden", !o);
$("navImport").onclick = () => { side(false); impOpen(true); };
$("impClose").onclick = () => impOpen(false);
$("impCheck").onclick = impCheck;
$("impGo").onclick = () => { const { n, u } = applyImport(impRows); impRows = []; $("impText").value = ""; $("impPrev").innerHTML = ""; $("impGo").disabled = true; impOpen(false); toast(`Importação concluída: ${n} novo(s), ${u} atualizado(s).`); };
$("impFileBtn").onclick = () => $("impFile").click();
$("impFile").onchange = async () => { const f = $("impFile").files[0]; if (!f) return; const buf = await f.arrayBuffer();
  let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("windows-1252").decode(buf); }
  $("impText").value = t.replace(/^\ufeff/, ""); $("impFile").value = ""; impCheck(); };
$("impModel").onclick = () => download(new Blob(["\ufeffnome;codigo_balanca;codigo_doacao;ean;categoria\r\nMamão Papaya;123;45;;FLV\r\nBanana Prata;124;46;;FLV\r\nPão Francês;200;B1;;Padaria\r\n"], { type: "text/csv;charset=utf-8" }), "modelo-importacao-valida.csv");

if (db) startPresence(); else localStats();

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
let deferred; const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; } };
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("iosHint").classList.remove("hidden");
})();
