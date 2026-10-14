/* app.js */
(() => {
"use strict";
if (window.__LOGIN_WAIT) return;
const C = window.VALIDA_CONFIG || {}, V = window.V || {}, fb = C.firebase || {};
const CATS = ["Ovos","FLV","Padaria","Laticínios","Mercearia","Bebidas","Congelados","Higiene e limpeza","Outros"];
const $ = id => document.getElementById(id);
const LK = "validamais-produtos-v1", LC = "validamais-ultima-categoria", TK = "validamais-tam";
let curTab = "Loja";
const LOJA = C.loja || "Sam's Club Radial Leste";
const EMPTY_FLV = '<div class="empty"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#9db8a4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 28h44l-5 22a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3z"/><path d="M22 28c0-9 4-16 10-16s10 7 10 16"/><path d="M32 12c0-4 3-7 8-7 0 5-3 8-8 7z"/></svg><p>Nenhum produto do FLV com validade para vencer no momento.</p></div>';
let products = [], db = null, scanner = null, toastTimer;
window.vmProducts = () => products;
window.vmRegister = o => registerProduct(o);
window.vmDb = () => db;
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
const totTxt = (k, u, n) => [k > 0 ? nBR(k) + " kg" : "", u > 0 ? nBR(u) + " un" : "", n + (n === 1 ? " item" : " itens")].filter(Boolean).join(" · ");
function confUrl(d) {
  const o = { d: d.data, l: LOJA, k: d.totalKg, u: d.totalUn, i: d.itens.map(i => [i.cod || "-", i.nome, nBR(i.qtd) + " " + i.unidade]) };
  return location.origin + location.pathname.replace(/index\.html$/, "") + "#conf=" + b64e(o);
}
function confMode() {
  if (!location.hash.startsWith("#conf=")) return false;
  ["main.app", "#sectorBox", "#fabWrap", "#fabScrim", "#side", "#sideBg", "#modal", "#impModal", "#toast"].forEach(q => { const el = document.querySelector(q); if (el) el.classList.add("hidden"); });
  const view = $("confView"); view.classList.remove("hidden"); let d;
  try { d = b64d(location.hash.slice(6)); } catch { view.innerHTML = '<p class="note">Link inválido ou incompleto. Peça para reenviar.</p>'; return true; }
  const KEY = "validamais-cv-" + hashStr(location.hash); let on = store.get(KEY, []);
  const day = new Date(d.d + "T00:00:00").toLocaleDateString("pt-BR"), title = "DOAÇÃO FLV";
  const draw = () => { const n = on.filter(Boolean).length;
    view.innerHTML = `<h1 class="romtitle">${esc(title)}</h1><p class="note">Data: ${day} · Loja: ${esc(d.l)}</p><div class="prog"><div style="width:${d.i.length ? Math.round(n / d.i.length * 100) : 0}%"></div></div><p class="note"><b>${n} de ${d.i.length}</b> conferidos · toque no item para riscar</p>` +
      d.i.map((r, x) => `<label class="crow ${on[x] ? "done" : ""}" data-x="${x}"><input type="checkbox" ${on[x] ? "checked" : ""}><span class="ct"><b>${esc(r[0])}</b> · ${esc(r[1])}</span><span class="cq">${esc(r[2])}</span></label>`).join("") +
      `<p class="romtotal">TOTAL: ${totTxt(d.k, d.u, d.i.length)}</p><div class="toolbar" style="margin-top:12px"><button class="primary big" id="cvSend">Enviar conferência no WhatsApp</button><button class="secondary" id="cvReset">Desmarcar tudo</button></div><p class="note" style="text-align:center"><a href="./">Abrir o Valida+</a></p>`; };
  view.onchange = e => { const l = e.target.closest("[data-x]"); if (!l) return; on[Number(l.dataset.x)] = e.target.checked; store.set(KEY, on); draw(); };
  view.onclick = async e => {
    if (e.target.id === "cvReset" && confirm("Desmarcar todos os itens?")) { on = []; store.set(KEY, on); draw(); }
    if (e.target.id !== "cvSend") return;
    const n = on.filter(Boolean).length, t = [`CONFERÊNCIA - ${title}`, `Data: ${day}`, `Loja: ${d.l}`, `Conferidos: ${n} de ${d.i.length}`, "------------------------",
      ...d.i.map((r, x) => on[x] ? `[x] ~${r[0]} | ${r[1]} | ${r[2]}~` : `[ ] ${r[0]} | ${r[1]} | ${r[2]}`), "------------------------", `TOTAL: ${totTxt(d.k, d.u, d.i.length)}`].join("\n");
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

function vmOk(find) {   // feedback curto: vibra e dá um "pulo" dourado na linha confirmada
  try { if (navigator.vibrate) navigator.vibrate([16, 30, 16]); } catch (_) {}
  let k = 0; const go = () => { k++; let el = null; try { el = typeof find === "function" ? find() : null; } catch (_) {}
    if (el) { el.classList.remove("vmok"); void el.offsetWidth; el.classList.add("vmok"); setTimeout(() => el.classList.remove("vmok"), 800); }
    else if (k < 6) setTimeout(go, 250); };
  setTimeout(go, 60);
}
window.vmOk = vmOk;
function toast(msg, action, fn) {
  const t = $("toast"); t.textContent = msg + " "; t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop");
  if (action) { const b = document.createElement("button"); b.textContent = action; b.onclick = () => { fn(); t.classList.add("hidden"); }; t.append(b); }
  t.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), 6000);
}
const persist = () => { if (!db) store.set(LK, products); };

// ---------- lista ----------
function fillCategories() {
  const opt = (id, first) => { const el = $(id); el.innerHTML = ""; el.add(new Option(first, "")); CATS.forEach(c => el.add(new Option(c, c))); };
  opt("category", "Selecione"); opt("categoryFilter", "Todas as categorias"); opt("exportCategory", "Selecione a categoria");
}
function sirene() {   // aba Validades pisca em branco, sem som, só quando há produto que vence hoje (os já vencidos não contam)
  const n = products.filter(p => { const d = daysLeft(p.expiry); return !p.retirado && d !== null && d === 0; }).length, b = $("tbLoja");
  b.classList.toggle("siren", n > 0); $("sirN").textContent = n > 99 ? "99+" : n; b.title = n ? n + " produto(s) vencendo hoje" : "";
}
setInterval(() => { if (typeof sirene === "function") sirene(); }, 60000);
// ---------- histórico de produtos (o que entrou, mudou ou saiu — e quem) ----------
const PHK = "validamais-phbase", PLK = "validamais-phlog", PHF = ["name", "expiry", "quantity", "category", "barcode", "codigo_balanca", "codigo_doacao", "retirado"];
const HIST_MS = 3 * 864e5;   // históricos (produtos e etiquetas) guardam no máximo 3 dias
let phBase = store.get(PHK, null), phLog = (store.get(PLK, []) || []).filter(e => Date.now() - (e.t || 0) < HIST_MS), lastAct = 0;
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); }, true));
const phLite = p => { const r = {}; Object.keys(p).forEach(k => { if (k === "foto" || k === "createdAt" || k === "updatedAt") return; r[k] = p[k]; }); return r; };
function phDiff() {
  if (db && !window.__hReady) return;
  const cur = {}; products.forEach(p => { cur[p.id] = phLite(p); });
  if (!phBase) { phBase = cur; store.set(PHK, cur); return; }
  const t = Date.now(), who = (t - lastAct < 8000) ? myName() : "outro aparelho (ou com o app fechado)", ev = [];
  const add = Object.keys(cur).filter(i => !phBase[i]), del = Object.keys(phBase).filter(i => !cur[i]), chg = [];
  Object.keys(cur).forEach(i => { const a = phBase[i], b = cur[i]; if (!a) return;
    const d = []; PHF.forEach(f => { if (String(a[f] ?? "") !== String(b[f] ?? "")) d.push(f === "expiry" ? `validade ${fmt(a.expiry)} → ${fmt(b.expiry)}` : f === "quantity" ? `qtd ${a.quantity} → ${b.quantity}` : f === "retirado" ? (b.retirado ? "retirado da loja" : "voltou para a loja") : `${f === "name" ? "nome" : f === "category" ? "setor" : f}: ${a[f] || "—"} → ${b[f] || "—"}`); });
    if (d.length) chg.push({ n: b.name, d: d.join("; ") }); });
  if (add.length) ev.push({ t, who, k: "add", n: add.length, it: add.slice(0, 40).map(i => ({ n: cur[i].name, d: cur[i].expiry ? "validade " + fmt(cur[i].expiry) : "" })) });
  if (del.length) ev.push({ t, who, k: "del", n: del.length, it: del.slice(0, 300).map(i => phBase[i]) });
  if (chg.length) ev.push({ t, who, k: "chg", n: chg.length, it: chg.slice(0, 40) });
  phLog = phLog.filter(e => Date.now() - (e.t || 0) < HIST_MS); store.set(PLK, phLog);
  if (ev.length) { phLog = ev.concat(phLog).slice(0, 300); while (phLog.length > 1 && JSON.stringify(phLog).length > 900000) phLog.pop(); store.set(PLK, phLog); phBase = cur; store.set(PHK, cur); if (!$("phModal").classList.contains("hidden")) phDraw(); }
}
const phWhen = t => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function phDraw() {
  const q = norm($("phBusca").value || "");
  const rows = phLog.map((e, i) => ({ e, i })).filter(({ e }) => !q || e.it.some(x => norm(x.n || x.name || "").includes(q)));
  $("phList").innerHTML = rows.length ? rows.map(({ e, i }) => {
    const nm = x => esc(x.n || x.name || "?"), tit = e.k === "add" ? `＋ Entrou · ${e.n} produto(s)` : e.k === "del" ? `🗑 Saiu · ${e.n} produto(s)` : `✎ Alterado · ${e.n} produto(s)`;
    const lines = e.it.slice(0, 8).map(x => `<div>• ${nm(x)}${x.d ? " <small class='muted'>" + esc(x.d) + "</small>" : x.expiry ? " <small class='muted'>validade " + fmt(x.expiry) + "</small>" : ""}</div>`).join("") + (e.n > 8 ? `<div class="muted">… e mais ${e.n - 8}</div>` : "");
    return `<div class="phe ${e.k}"><b>${tit}</b><small class="muted">${phWhen(e.t)} · ${esc(e.who)}</small>${lines}${e.k === "del" ? (e.rest ? '<small class="muted">✓ já restaurado</small>' : `<button type="button" class="secondary" data-phr="${i}">↩ Restaurar ${e.it.length > 1 ? "estes " + e.it.length : "este"}</button>`) : ""}</div>`;
  }).join("") : '<p class="muted">Nada registrado ainda. A partir de agora, o que entrar, mudar ou sair aparece aqui.</p>';
}
window.phOpen = () => { phLog = phLog.filter(e => Date.now() - (e.t || 0) < HIST_MS); store.set(PLK, phLog); $("phBusca").value = ""; phDraw(); $("phModal").classList.remove("hidden"); };
async function phRestore(i) {
  const e = phLog[i]; if (!e || e.rest) return;
  const ok = await askConfirm({ icon: "↩", title: "Restaurar produtos?", text: e.it.length + " produto(s)", sub: "Eles voltam para a lista com os dados de antes.", ok: "Restaurar", cancel: "Cancelar" });
  if (!ok) return; const ts = db ? V.serverTimestamp() : null;
  e.it.forEach(d => { const data = { ...d }; delete data.id;
    if (db) V.addDoc(V.collection(db, "products"), { ...data, createdAt: ts, updatedAt: ts }).catch(() => toast("Não foi possível restaurar na nuvem."));
    else products.push({ ...data, id: uid(), updatedAt: Date.now() }); });
  e.rest = true; store.set(PLK, phLog); if (!db) { persist(); render(); } phDraw(); toast(e.it.length + " produto(s) restaurado(s).");
}
function render() {
  retOverlay(); phDiff();
  { const cf = $("categoryFilter"), oth = [...new Set(products.map(p => p.category).filter(c => c && c !== "FLV"))].sort(), sig = oth.join("|");
    if (cf.dataset.sig !== sig) { const cur = cf.value; cf.innerHTML = ""; cf.add(new Option("Todos os setores", "")); ["FLV", ...oth].forEach(c => cf.add(new Option(c, c)));
      cf.value = [...cf.options].some(o => o.value === cur) ? cur : "FLV"; cf.dataset.sig = sig; }
    cf.classList.toggle("hidden", !oth.length); document.querySelector("#tabLoja .filters").classList.toggle("hidden", !oth.length); $("verTodos").classList.toggle("hidden", !!oth.length); }
  const q = $("search").value.trim().toLowerCase(), cat = $("categoryFilter").value, st = $("statusFilter").value;
  const base = products.filter(p => !p.retirado && (!cat || p.category === cat)), ex = base.filter(p => status(p) === "expired").length, so = base.filter(p => status(p) === "soon").length;
  $("countAll").textContent = products.length;
  { const nr = products.filter(p => p.retirado).length; $("verRet").classList.toggle("hidden", !nr && !retView); $("verRet").textContent = retView ? "← Voltar às validades" : `📦 Ver retirados da loja (${nr})`; }
  { const vt = $("verTodos"); if (vt) vt.textContent = cat ? `Ver todos os ${products.length} cadastrados` : "Voltar ao FLV"; }
  document.querySelectorAll("#tabLoja .stats .stat").forEach((e, i) => e.classList.toggle("on", (i === 1 && st === "soon") || (i === 2 && st === "expired"))); $("countSoon").textContent = so; $("countExpired").textContent = ex;
  { const fora = cat ? products.filter(p => !p.retirado && p.category !== cat && daysLeft(p.expiry) !== null && daysLeft(p.expiry) >= 0 && daysLeft(p.expiry) <= 1).length : 0;
    $("outAlert").classList.toggle("hidden", !fora); $("outAlert").textContent = `⚠ ${fora} produto(s) de OUTROS setores vencem em até 1 dia — toque para ver todos`; }
  $("topAlert").classList.toggle("hidden", !(ex || so));
  $("topAlert").textContent = `Atenção: ${ex} vencido(s) e ${so} vencendo em breve.`;
  sirene();
  const cnt = {}; products.forEach(p => { if (p.barcode) cnt[p.barcode] = (cnt[p.barcode] || 0) + 1; });
  const hoje = products.filter(p => !p.retirado && daysLeft(p.expiry) === 0 && (!cat || p.category === cat));
  $("todayBanner").classList.toggle("hidden", !hoje.length);
  $("todayBanner").textContent = `⚠ VENCEM HOJE (${hoje.length}): ` + hoje.slice(0, 5).map(p => p.name).join(", ") + (hoje.length > 5 ? "…" : "");
  if (!hoje.length) alarmed = false; else if (!alarmed && actx) { alarmed = true; alarm(); }
  const rows = retView ? products.filter(p => p.retirado).sort((a, b) => (Number(b.retEm) || 0) - (Number(a.retEm) || 0)) : products.filter(p => q ? ((p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q) || String(p.codigo_balanca || "") === q || String(p.codigo_doacao || "").toLowerCase() === q)   // buscando: procura em TODOS os setores, com ou sem validade
      : (!p.retirado && (!cat || p.category === cat) && !(cat === "FLV" && daysLeft(p.expiry) === null) && (!st || status(p) === st)))
    .sort((a, b) => cat ? (a.expiry || "9999").localeCompare(b.expiry || "9999")
      : (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }) || (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  $("list").innerHTML = rows.length ? rows.map(p => { const dl = daysLeft(p.expiry), cls = dl === null ? "none" : dl <= 0 ? "expired" : status(p);
    if (p.retirado) return `<article class="product retirado"><div class="ctop"><h3>${esc(p.name)}</h3><span class="upd">${esc(p.category)}</span></div><div class="vbox"><div class="vd"><small>RETIRADO DA LOJA</small><b>${p.retEm ? new Date(Number(p.retEm)).toLocaleDateString("pt-BR") : "—"}</b></div><div class="vr"><span class="pill">${p.retPor ? "por " + esc(p.retPor) : ""}</span><small>validade era ${fmt(p.expiry)}</small></div></div><div class="actions"><button class="secondary" data-volta="${esc(p.id)}">↩ Voltar para a loja</button></div></article>`;
    return `<article class="product ${cls}"><div class="ctop"><h3>${esc(p.name)}</h3><span class="upd">Última atualização: ${dayOf(p)}</span></div><p class="meta">Cód.: ${esc(p.barcode || (p.codigo_balanca ? "PLU " + p.codigo_balanca : "—"))} · ${esc(p.category)} · Qtd: ${esc(p.quantity)}</p><div class="vbox"><div class="vd"><small>VALIDADE</small><b>${fmt(p.expiry)}</b></div><div class="vr"><span class="pill">${when(dl)}</span>${cnt[p.barcode] > 1 ? `<small>${cnt[p.barcode]} lotes</small>` : ""}</div></div><div class="actions"><button class="secondary" data-edit="${esc(p.id)}">Editar</button><button class="primary" data-ret="${esc(p.id)}">Retirar da loja</button></div></article>`;
  }).join("") : (cat === "FLV" && !q && !st ? EMPTY_FLV : '<p class="muted">Nenhum produto encontrado. Use "Bipar código" ou "Cadastro manual".</p>');
}

// ---------- modal e formulário ----------
function show(title, scan) {
  $("modalTitle").textContent = title; $("modal").classList.remove("hidden");
  $("scannerArea").classList.toggle("hidden", !scan); $("productForm").classList.toggle("hidden", !!scan);
}
// ----- fotos de produto: recurso removido. Limpeza única das que já estavam salvas (cadastros ficam) -----
const FOTO_LIMPA = "validamais-fotos-limpas";
let fotosLimpando = false;
function limparFotosLocal() { try { localStorage.removeItem("validamais-fotos"); } catch (e) {} }
limparFotosLocal();   // cópia de fotos guardada neste aparelho
function limparFotosNuvem() {   // coleção "fotos" + campo foto dentro dos cadastros; conclui 1 vez por aparelho
  if (!db || fotosLimpando || store.get(FOTO_LIMPA, false)) return; fotosLimpando = true;
  const legados = products.filter(p => typeof p.foto === "string" && p.foto !== "");
  let falhou = false, lido = false;
  Promise.all(legados.map(p => V.updateDoc(V.doc(db, "products", p.id), { foto: V.deleteField() }).catch(e => { falhou = true; console.warn("foto do cadastro", e); })))
    .then(() => new Promise(res => { let fim = false, un = null;
      const encerra = () => { if (fim) return; fim = true; try { un && un(); } catch (e) {} res(); };
      un = V.onSnapshot(V.collection(db, "fotos"), snap => {
        if (snap.metadata.fromCache) return;   // só vale a resposta da nuvem (o cache pode estar vazio)
        lido = true;
        Promise.all(snap.docs.map(d => V.deleteDoc(V.doc(db, "fotos", d.id)).catch(e => { falhou = true; console.warn("foto", e); }))).then(encerra);
      }, () => { lido = true; encerra(); });   // sem permissão de leitura: o app nunca enxergou essas fotos
      setTimeout(encerra, 15000); }))
    .then(() => {
      if (falhou) toast("Não consegui apagar todas as fotos da nuvem. Confira as regras do Firestore (coleção «fotos»).");
      else if (lido) store.set(FOTO_LIMPA, true);   // sem internet: tenta de novo na próxima abertura
      fotosLimpando = false; });
}
function resetForm() {
  $("productForm").reset(); $("docId").value = ""; $("quantity").value = 1;
  $("category").value = "FLV"; $("saveNext").classList.remove("hidden"); toggleCodes();
  $("productForm").classList.remove("lote"); $("loteInfo").classList.add("hidden"); $("loteEdit").classList.add("hidden");
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
// ----- nomes parecidos / duplicados -----
const nameKey = n => norm(n || "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !/^(kg|un|und|unid|unidade|unidades|g|gr|grs|kilo|quilo)$/.test(w)).map(w => w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w).sort().join(" ");
function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 3; let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
function similarKeys(a, b) { if (!a || !b) return false; if (a === b) return true; const L = Math.min(a.length, b.length); return L >= 8 && lev(a, b) <= (L >= 14 ? 2 : 1); }
function similarNames(name, ignoreName = "") {   // nomes já cadastrados parecidos (mas não idênticos) com este
  const k = nameKey(name), me = norm(name), out = new Map();
  products.forEach(p => { const nm = (p.name || "").trim(), nn = norm(nm); if (!nm || nn === me || nn === norm(ignoreName)) return; if (similarKeys(k, nameKey(nm))) out.set(nn, nm); });
  return [...out.values()];
}
function dupGroups() {   // grupos de nomes parecidos entre si
  const cnt = new Map(); products.forEach(p => { const nm = (p.name || "").trim(); if (!nm) return; const nn = norm(nm), o = cnt.get(nn) || { nome: nm, n: 0 }; o.n++; cnt.set(nn, o); });
  const items = [...cnt.values()], par = items.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (similarKeys(nameKey(items[i].nome), nameKey(items[j].nome))) par[find(j)] = find(i);
  const g = new Map(); items.forEach((it, i) => { const r = find(i); (g.get(r) || g.set(r, []).get(r)).push(it); });
  return [...g.values()].filter(a => a.length > 1);
}
function dupReview() {
  const bg = document.createElement("div"); bg.className = "askbg";
  const paint = () => { const gs = dupGroups(); bg.dataset.g = JSON.stringify(gs.map(a => a.map(x => x.nome)));
    bg.innerHTML = `<div class="ask" style="max-height:86dvh;overflow:auto;text-align:left"><div class="ai" style="text-align:center">🔍</div><h3 style="text-align:center">Cadastros parecidos</h3>` +
      (gs.length ? `<p style="text-align:center">Escolha o nome certo de cada grupo. Os outros serão renomeados.</p>` + gs.map((a, gi) => `<div class="dupg">${a.map((x, ni) => `<div class="dupr"><span><b>${esc(x.nome)}</b> <small>${x.n} cadastro(s)</small></span><button type="button" data-g="${gi}" data-n="${ni}">Usar este</button></div>`).join("")}</div>`).join("")
        : `<p style="text-align:center"><b>Nenhum nome parecido encontrado ✓</b></p>`) +
      `<div class="arow"><button type="button" class="ok" data-x="1">Fechar</button></div></div>`; };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return bg.remove();
    const b = e.target.closest("[data-g]"); if (!b) return; const gs = JSON.parse(bg.dataset.g), alvo = gs[b.dataset.g][b.dataset.n], set = new Set(gs[b.dataset.g].map(norm)); let n = 0;
    products.forEach(p => { if (set.has(norm(p.name || "")) && (p.name || "").trim() !== alvo) { n++;
      if (db) V.updateDoc(V.doc(db, "products", p.id), { name: alvo, updatedAt: V.serverTimestamp() }).catch(err => console.error(err)); else p.name = alvo; } });
    persist(); if (!db) render(); toast(`${n} cadastro(s) renomeado(s) para «${alvo}».`); paint(); };
  paint(); document.body.appendChild(bg);
}
window.dupReview = dupReview;
async function save(next) {
  const id = $("docId").value, q = Number(String($("quantity").value).replace(",", "."));
  const data = { barcode: $("barcode").value.trim().slice(0, 32), name: $("name").value.trim().slice(0, 120),
    category: $("category").value, expiry: $("expiry").value, quantity: q, por: myName(), codigo_balanca: $("cBalanca").value.trim().slice(0, 12), codigo_doacao: $("cDoacao").value.trim().slice(0, 12) };
  if (!data.name || !CATS.includes(data.category) || (!data.expiry && data.category !== "FLV") || !(q > 0)) { toast(data.category === "FLV" ? "Preencha nome e categoria." : "Preencha nome, categoria, validade e quantidade."); return; }
  const antes = id ? ((products.find(x => x.id === id) || {}).name || "") : "";
  if (!id || norm(antes) !== norm(data.name)) {
    const sim = similarNames(data.name, antes);
    if (sim.length) {
      const r = await askConfirm({ icon: "🔍", title: "Já existe um nome parecido", text: `«${data.name}»`, sub: `Já cadastrado: ${sim.slice(0, 3).map(s => "«" + s + "»").join(" · ")}`, ok: "Manter o meu", cancel: "Usar o existente" });
      if (r === null) return;
      if (r === false) { data.name = sim[0].slice(0, 120); $("name").value = data.name; }
    }
  }
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
  closeModal(); toast("Produto salvo."); { const nm = norm(data.name || ""); vmOk(() => [...document.querySelectorAll("#list article.product")].find(a => norm((a.querySelector("h3") || {}).textContent || "") === nm)); } if (next) openScan();
}
let retView = false;
const RLK = "validamais-retlocal"; let retLoc = store.get(RLK, {});
// dados que a nuvem recusou ficam marcados só neste aparelho
function retOverlay() { products.forEach(p => { if (p.retirado == null && retLoc[p.id]) { p.retirado = true; p.retEm = retLoc[p.id].em; p.retPor = retLoc[p.id].por; } }); }
async function retirar(id, sai, semPerguntar) {
  const p = products.find(x => x.id === id); if (!p) return;
  if (sai && !semPerguntar) { const ok = await askConfirm({ icon: "📦", title: "Retirar da loja?", text: p.name + " · validade " + fmt(p.expiry), sub: "Sai da lista de vencimentos e do alerta, mas fica guardado em «Ver retirados da loja», com a data e quem retirou. O cadastro continua.", ok: "Retirar da loja", cancel: "Cancelar" }); if (!ok) return; }
  const em = Date.now(), por = myName(), campos = sai ? { retirado: true, retEm: em, retPor: por } : { retirado: false };
  const salvarLocal = () => { if (sai) retLoc[id] = { em, por }; else delete retLoc[id]; store.set(RLK, retLoc); Object.assign(p, campos); render(); };
  const fim = (nuvem, motivo) => toast((sai ? "✓ " + p.name + " retirado da loja" : p.name + " voltou para a loja") + (nuvem ? "." : " (só neste aparelho: a nuvem recusou" + (motivo ? " — " + motivo : "") + ")."), "Desfazer", () => retirar(id, !sai, true));
  if (db && !(!sai && retLoc[id])) {
    try { await V.updateDoc(V.doc(db, "products", id), { ...campos, updatedAt: V.serverTimestamp() }); if (!sai) { delete retLoc[id]; store.set(RLK, retLoc); } fim(true); }
    catch (e) { console.error(e); salvarLocal(); fim(false, e && (e.code || e.message)); }
  } else { salvarLocal(); fim(true); }
}
$("verRet").onclick = () => { retView = !retView; render(); window.scrollTo(0, 0); };

// ---------- scanner ----------
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(50); } catch {} }; // pulso tátil de 50 ms
let actx, alarmed = false, sector = "";
const audio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} };
function tone(f, t, d) { if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = .25; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + d); }
function beep() { audio(); tone(1000, 0, .09); }
function alarm() { /* sem som nem vibração: o aviso de vencimento agora é só a aba piscando */ }
function loteMode(k) {          // produto já cadastrado: só pede validade e quantidade deste lote
  if (!k || !k.name) return;
  $("productForm").classList.add("lote");
  $("loteInfo").textContent = `Produto já cadastrado: ${k.name}${k.barcode ? " · cód. " + k.barcode : ""}. Informe só a validade e a quantidade deste lote.`;
  $("loteInfo").classList.remove("hidden"); $("loteEdit").classList.remove("hidden");
}
$("loteEdit").onclick = () => { $("productForm").classList.remove("lote"); $("loteInfo").classList.add("hidden"); $("loteEdit").classList.add("hidden"); };
async function onCode(code) {
  if (scanMode === "doacao") return donationScan(code);
  if (scanMode === "etiqueta") return labelScan(code);
  if (scanMode === "cadastro") return cadScan(code);
  if (navigator.vibrate) navigator.vibrate(100);
  beep(); await stopScanner(); resetForm();
  if (isScale(code)) {                                   // etiqueta de balança: o código de balança identifica o produto
    const plu = String(Number(parseScale(code).item)), k = products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(plu));
    logScan(code, k); show(k ? `Novo lote de «${k.name}»` : "Produto novo: cadastre agora");
    $("barcode").value = (k && k.barcode) || ""; $("name").value = (k && k.name) || ""; $("category").value = (k && k.category) || "FLV";
    $("cBalanca").value = plu; $("cDoacao").value = (k && k.codigo_doacao) || ""; toggleCodes(); loteMode(k); (k ? $("expiry") : $("name")).focus(); return;
  }
  const known = products.find(p => p.barcode === code); logScan(code, known);
  show(known ? `Novo lote de «${known.name}» (já há ${products.filter(p => p.barcode === code).length} validade(s))` : "Produto novo: cadastre agora");
  $("barcode").value = code; fillKnown(code); loteMode(known); (known ? $("expiry") : $("name")).focus();
}
let scanMode = "loja";
function manualCodeGo() {            // código digitado: segue o mesmo caminho da leitura pela câmera
  const v = $("manualCode").value.replace(/\D/g, "");
  if (!/^\d{6,14}$/.test(v)) { toast("Digite o código de barras só com números (6 a 14 dígitos)."); return $("manualCode").focus(); }
  $("manualCode").value = ""; $("manualCode").blur(); onCode(v);
}
$("manualGo").onclick = manualCodeGo;
$("manualCode").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); manualCodeGo(); } };
async function openScan(mode = "loja") {
  scanMode = ["doacao", "etiqueta", "cadastro"].includes(mode) ? mode : "loja";
  resetForm(); show({ doacao: "Bipar itens da doação", etiqueta: "Bipar para etiqueta", cadastro: "Bipar para o cadastro" }[scanMode] || "Ler código de barras", true);
  $("scanManual").textContent = scanMode === "loja" ? "Digitar código" : "Cancelar";
  ["retryScan", "torchBtn"].forEach(i => $(i).classList.add("hidden"));
  $("scanMsg").textContent = "Aponte a câmera traseira para o código de barras. Se não ler, digite o código abaixo."; $("manualCode").value = "";
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
  const s = $("exportScope").value, c = $("exportCategory").value; let r = products.filter(p => !p.retirado);
  if (s === "products") {                 // um registro por produto, com todos os códigos (mesmo formato da importação)
    const m = new Map();
    products.forEach(p => { const k = p.barcode || norm(p.name || ""); if (!k) return; const o = m.get(k) || { n: "", b: "", d: "", e: "", c: "" };
      o.n = o.n || p.name || ""; o.b = o.b || p.codigo_balanca || ""; o.d = o.d || p.codigo_doacao || ""; o.e = o.e || p.barcode || ""; o.c = o.c || p.category || ""; m.set(k, o); });
    if (!m.size) { toast("Nenhum produto cadastrado."); return null; }
    return [...m.values()].sort((a, b) => a.n.localeCompare(b.n, "pt-BR", { sensitivity: "base" }))
      .map(o => ({ "Nome": o.n, "Código de balança": String(o.b), "Código de doação": String(o.d), "EAN": o.e, "Categoria": o.c }));
  }
  if (s === "soon" || s === "expired") r = r.filter(p => status(p) === s);
  if (s === "category") { if (!c) { toast("Escolha a categoria para exportar."); return null; } r = r.filter(p => p.category === c); }
  if (!r.length) { toast("Nenhum produto neste filtro."); return null; }
  return r.sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999")).map(p => ({
    "Produto": p.name, "Categoria": p.category, "Código de barras": p.barcode || "", "Validade": fmt(p.expiry),
    "Quantidade": String(p.quantity).replace(".", ","), "Status": stLabel(p) }));
}
function csvCell(k, v) {
  v = String(v ?? "");
  if ((k === "Código de barras" || k === "EAN") && /^\d+$/.test(v)) return `="${v}"`;      // evita notação científica no Excel
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
  if (rows[0] && "Nome" in rows[0]) {
    pdf.setFontSize(16); pdf.text("Produtos cadastrados", 14, 16);
    pdf.setFontSize(9); pdf.text(`${LOJA} · Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} produto(s)`, 14, 22);
    V.autoTable(pdf, { startY: 27, styles: { fontSize: 8 }, headStyles: { fillColor: [22, 101, 52] },
      head: [["Nome", "Balança", "Doação", "EAN", "Categoria"]], body: rows.map(r => [r["Nome"], r["Código de balança"], r["Código de doação"], r["EAN"], r["Categoria"]]),
      didDrawPage: () => { pdf.setFontSize(8); pdf.text(`Página ${pdf.internal.getCurrentPageInfo().pageNumber}`, 196, 290, { align: "right" }); } });
    return pdf.output("blob");
  }
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
const fname = () => ($("exportScope").value === "products" ? "produtos-cadastrados-" : "controle-validade-") + stamp();

// ---------- eventos ----------
fillCategories();
["search"].forEach(i => $(i).oninput = render);
$("categoryFilter").onchange = render; $("statusFilter").onchange = render;
$("list").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.edit) edit(b.dataset.edit); if (b.dataset.ret) retirar(b.dataset.ret, true); if (b.dataset.volta) retirar(b.dataset.volta, false); };
$("manualOpen").onclick = () => openForm(); $("fab").onclick = () => openScan(curTab === "Doacao" ? "doacao" : curTab === "Etiquetas" ? "etiqueta" : curTab === "Cadastros" ? "cadastro" : "loja"); $("retryScan").onclick = () => openScan(scanMode);
$("scanManual").onclick = async () => { await stopScanner(); if (scanMode !== "loja") closeModal(); else openForm(); };
$("closeModal").onclick = closeModal; $("cancelForm").onclick = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal(); });
$("productForm").onsubmit = e => { e.preventDefault(); save(false); };
$("saveNext").onclick = () => { if ($("productForm").reportValidity()) save(true); };
$("barcode").oninput = toggleCodes; $("category").onchange = toggleCodes; $("barcode").onchange = () => fillKnown($("barcode").value.trim());
$("qMinus").onclick = () => { const q = Number(String($("quantity").value).replace(",", ".")) || 1; $("quantity").value = Math.max(1, Math.round(q) - 1); };
$("qPlus").onclick = () => { $("quantity").value = Math.round(Number(String($("quantity").value).replace(",", ".")) || 0) + 1; };
$("exportScope").onchange = () => $("exportCategory").classList.toggle("hidden", $("exportScope").value !== "category");
$("csvBtn").onclick = () => { const r = exportRows(); if (r) download(new Blob([csvContent(r)], { type: "text/csv;charset=utf-8" }), `${fname()}.csv`); };
$("pdfBtn").onclick = () => { const r = exportRows(); if (!r) return; try { download(makePdf(r), `${fname()}.pdf`); } catch (e) { console.error(e); toast("Não foi possível gerar o PDF."); } };
$("shareBtn").onclick = async () => {
  const r = exportRows(); if (!r) return;
  try {
    const blob = makePdf(r), file = new File([blob], `${fname()}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: $("exportScope").value === "products" ? "Produtos cadastrados" : "Relatório de validade", files: [file] });
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
      products = snap.docs.map(d => ({ id: d.id, ...d.data() })); window.__hReady = !snap.metadata.fromCache; render(); if (window.__hReady) setTimeout(() => { try { limparFotosNuvem(); } catch (e) { console.warn(e); } }, 2000);
      setSync(snap.metadata.hasPendingWrites ? "alterações aguardando envio…" : snap.metadata.fromCache ? (navigator.onLine ? "conectando…" : "offline (dados salvos no aparelho)") : "sincronizado");
    }, err => { console.error(err); setSync("erro de sincronização (confira as regras do Firestore)"); toast("Erro ao ler os dados da nuvem."); });
  } catch (e) { console.error(e); db = null; setSync("falha ao iniciar o Firebase"); }
} else { products = store.get(LK, []); if (products.some(p => p.foto)) { products = products.map(({ foto, ...r }) => r); store.set(LK, products); } setSync("modo local neste aparelho (configure o Firebase para sincronizar)"); render(); }

// ---------- aparelho, contadores (visitas/online) e histórico de leituras ----------
const myId = store.get("validamais-device", null) || (() => { const i = uid().slice(0, 8); store.set("validamais-device", i); return i; })();
const myName = () => { try { return JSON.parse(localStorage.getItem("validamais-operador")) || ("Aparelho " + myId.slice(0, 4)); } catch { return "Aparelho " + myId.slice(0, 4); } };
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
    $("nOnline").textContent = on.data().n; $("nVisitas").textContent = all.data().v || 0; $("dotO").classList.toggle("on", on.data().n > 0); chipOnline(on.data().n);
  } catch (e) { console.warn(e); }
}
function chipOnline(n) { const c = $("onChip"); c.classList.remove("hidden"); c.textContent = "● " + n + " online"; c.classList.toggle("on", n > 0); }
$("onChip").onclick = () => {
  if (!db) return toast("Modo local: só este aparelho está em uso.");
  const bg = document.createElement("div"); bg.className = "askbg"; document.body.appendChild(bg);
  const pinta = lista => { bg.innerHTML = `<div class="ask" style="text-align:left;max-height:80dvh;overflow:auto"><div class="ai" style="text-align:center">🟢</div><h3 style="text-align:center">${lista ? lista.length + " online agora" : "Verificando…"}</h3>` +
    (lista ? (lista.length ? lista.map(d => `<div class="dupr"><span><b>${esc(d.nome || "Aparelho")}</b>${d.id === myId ? " <small>(você)</small>" : ""}</span><small>${d.min < 1 ? "agora" : "há " + d.min + " min"} · ${esc(d.ua || "")}</small></div>`).join("") : '<p style="text-align:center">Ninguém online.</p>') : "") +
    `<p style="text-align:center;font-size:12px">Online = ativo nos últimos 5 minutos.</p><div class="arow"><button type="button" class="ok" data-x="1">Fechar</button></div></div>`; };
  pinta(null); bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) { try { un && un(); } catch (x) {} bg.remove(); } };
  let un = null; try {
    un = V.onSnapshot(V.query(V.collection(db, "devices"), V.where("lastSeen", ">", V.Timestamp.fromMillis(Date.now() - ONLINE_MS))), s => {
      const l = s.docs.map(d => ({ id: d.id, ...d.data() })).map(d => ({ ...d, min: Math.floor((Date.now() - ms(d.lastSeen)) / 60000) })).sort((a, b) => a.min - b.min);
      pinta(l); }, () => { bg.remove(); toast("Não foi possível ver quem está online."); });
  } catch (e) { bg.remove(); toast("Não foi possível ver quem está online."); }
};
function startPresence() {
  const ref = V.doc(db, "devices", myId), ua = navigator.userAgent;
  const first = store.get("validamais-first", null) || (() => { const f = new Date().toISOString(); store.set("validamais-first", f); return f; })();
  const beat = () => { if (document.visibilityState === "visible") V.setDoc(ref, { nome: myName(), lastSeen: V.serverTimestamp() }, { merge: true }).catch(() => {}); };
  V.setDoc(ref, { nome: myName(), firstSeen: first, lastSeen: V.serverTimestamp(), visitas: V.increment(1), ua: /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Computador" }, { merge: true })
    .catch(console.error).finally(() => setTimeout(pollStats, 1500));
  setInterval(beat, 120000); setInterval(pollStats, 60000); document.addEventListener("visibilitychange", beat);
}
function localStats() { const v = store.get("validamais-visitas", 0) + 1; store.set("validamais-visitas", v); $("nVisitas").textContent = v; $("nOnline").textContent = 1; $("dotO").classList.add("on"); chipOnline(1); }
$("scansBox").ontoggle = () => {
  if ($("scansBox").open) { if (db) { if (!unsubScan) unsubScan = V.onSnapshot(V.query(V.collection(db, "scans"), V.orderBy("em", "desc"), V.limit(30)), s => { scans = s.docs.map(d => d.data()); renderScans(); }); }
    else { scans = store.get("validamais-scans", []).slice(0, 30); renderScans(); } }
  else if (unsubScan) { unsubScan(); unsubScan = null; }
};

// ---------- setor, menu lateral e voz ----------
const SETOR = "FLV"; $("categoryFilter").value = SETOR; store.set(LC, SETOR); render();
{ const sf = $("statusFilter"), stt = document.querySelectorAll("#tabLoja .stats .stat");
  stt[0].onclick = () => { sf.value = ""; render(); }; stt[1].onclick = () => { sf.value = sf.value === "soon" ? "" : "soon"; render(); }; stt[2].onclick = () => { sf.value = sf.value === "expired" ? "" : "expired"; render(); }; }
$("phClose").onclick = () => $("phModal").classList.add("hidden"); $("phBusca").oninput = phDraw;
$("phList").onclick = e => { const b = e.target.closest("[data-phr]"); if (b) phRestore(Number(b.dataset.phr)); };
$("outAlert").onclick = () => { $("categoryFilter").value = ""; render(); window.scrollTo(0, 0); };
$("verTodos").onclick = () => { $("categoryFilter").value = $("categoryFilter").value ? "" : "FLV"; render(); };
document.addEventListener("pointerdown", () => { audio(); render(); }, { once: true }); // libera o som do alerta no primeiro toque
const side = o => { $("side").classList.toggle("open", o); $("sideBg").classList.toggle("hidden", !o); };
$("sideBg").onclick = () => side(false); $("sideClose").onclick = () => side(false);
$("micBtn").onclick = () => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return toast("Ditado por voz não é suportado neste navegador.");
  const r = new R(); r.lang = "pt-BR"; r.interimResults = false;
  r.onresult = e => { const t = e.results[0][0].transcript.trim(); $("name").value = (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 120); };
  r.onerror = e => toast(e.error === "not-allowed" ? "Permita o microfone para ditar." : "Não entendi, tente de novo.");
  r.onend = () => $("micBtn").classList.remove("on"); $("micBtn").classList.add("on"); toast("Fale o nome do produto…"); try { r.start(); } catch {} };
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

// ---------- cadastro rápido ao bipar produto não cadastrado (vale para qualquer usuário) ----------
let nrResolve = null, qtResolve = null; const adopted = new Set();
let qtProd = null, qtCode = "", qtOrig = "";
function askQty(nome, prod, code) {                  // devolve { q, cod } (quantidade e código de doação), ou null se cancelar
  return new Promise(res => {
    if (qtResolve) return res(null);
    qtResolve = res; qtProd = prod || null; qtCode = code || ""; qtOrig = (prod && prod.codigo_doacao) || "";
    const it = don.itens.find(i => i.key === norm(nome) + "|un");
    $("qtNome").textContent = nome; $("qtCod").value = qtOrig;
    $("qtInfo").textContent = it ? `Já coletado: ${fq(it.qtd)} un em ${it.lanc} lançamento${it.lanc > 1 ? "s" : ""}.` : "Ainda não coletado nesta doação.";
    $("qtQtd").value = "1"; $("qtModal").classList.remove("hidden"); setTimeout(() => $("qtQtd").focus(), 80);   // o foco abre o teclado numérico
  });
}
function qtDone(v) { $("qtModal").classList.add("hidden"); const r = qtResolve; qtResolve = null; if (r) r(v); }
$("qtOk").onclick = () => {
  const q = Math.round(Number($("qtQtd").value)); if (!(q > 0)) return toast("Digite a quantidade.");
  const cod = $("qtCod").value.replace(/\s+/g, "").toUpperCase();
  if (cod !== qtOrig) { const v = saveCode(qtProd || { name: $("qtNome").textContent, barcode: qtCode }, "codigo_doacao", cod); if (v === null) return; }   // grava no cadastro compartilhado
  qtDone({ q, cod });
};
$("qtCancel").onclick = $("qtClose").onclick = () => qtDone(null);
$("qtMenos").onclick = () => { $("qtQtd").value = Math.max(1, (Number($("qtQtd").value) || 1) - 1); };
$("qtMais").onclick = () => { $("qtQtd").value = (Number($("qtQtd").value) || 0) + 1; };
document.addEventListener("keydown", e => { if (e.key === "Escape" && qtResolve) qtDone(null); });
function askNewProduct(code, scale, item, withDon) {          // abre a janela e devolve {nome} ou null se cancelar
  return new Promise(res => {
    if (nrResolve) return res(null);
    nrResolve = res;
    $("nrCod").textContent = (scale ? `Etiqueta de balança, item ${item}` : `Código de barras ${code}`) + " ainda não está cadastrado. Informe o nome para cadastrar.";
    $("nrNome").value = ""; $("nrDon").value = ""; $("nrDonBox").classList.toggle("hidden", !withDon); $("nrModal").classList.remove("hidden"); setTimeout(() => $("nrNome").focus(), 60);
  });
}
function nrDone(v) { $("nrModal").classList.add("hidden"); const r = nrResolve; nrResolve = null; if (r) r(v); }
$("nrClose").onclick = $("nrCancel").onclick = () => nrDone(null);
$("nrSave").onclick = () => { const nome = $("nrNome").value.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!nome) { toast("Digite o nome do produto."); return $("nrNome").focus(); }
  const don = $("nrDon").value.replace(/\s+/g, "").toUpperCase();
  if (don) {
    if (!/^[A-Z0-9]{1,12}$/.test(don)) { toast("Código de doação: só letras e números (até 12)."); return $("nrDon").focus(); }
    const dup = products.find(x => String(x.codigo_doacao || "").toUpperCase() === don && norm(x.name || "") !== norm(nome));
    if (dup) { toast(`Esse código já pertence a «${dup.name}».`); return $("nrDon").focus(); } }
  nrDone({ nome, don }); };
$("nrNome").onkeydown = e => { if (e.key === "Enter") $("nrSave").click(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && nrResolve) nrDone(null); });
function registerProduct({ name, category = "FLV", barcode = "", codigo_balanca = "", codigo_doacao = "" }) {   // grava no cadastro compartilhado
  const fail = e => { console.error(e); toast("Não salvou no cadastro compartilhado (confira as regras do Firebase). Por isso o app pede o cadastro de novo."); }, f = {}, field = barcode ? "barcode" : "codigo_balanca";
  if (barcode) f.barcode = barcode; if (codigo_balanca) f.codigo_balanca = codigo_balanca; if (codigo_doacao) f.codigo_doacao = codigo_doacao;
  const free = products.filter(x => norm(x.name || "") === norm(name) && !x[field]);   // mesmo nome ainda sem esse código: só acrescenta o código
  if (free.length) {
    if (db) { const ts = V.serverTimestamp(); free.forEach(x => V.updateDoc(V.doc(db, "products", x.id), { ...f, updatedAt: ts }).catch(fail)); }
    else { free.forEach(x => Object.assign(x, f)); persist(); render(); }
    toast("Código acrescentado a «" + name + "»."); return { ...free[0], ...f };
  }
  const rec = { name, barcode, category, expiry: "", quantity: 1, por: myName(), codigo_balanca, codigo_doacao };
  if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...rec, createdAt: ts, updatedAt: ts }).catch(fail); }
  else { products.push({ ...rec, id: uid(), updatedAt: Date.now() }); persist(); render(); }
  toast("«" + name + "» cadastrado."); return rec;
}

// ---------- Doação: lançar por EAN digitado (botão +) ----------
function eanFind(v) {
  if (isScale(v)) { const it = Number(parseScale(v).item); return products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === it); }
  return products.find(p => p.barcode === v);
}
function eanPreview() {                              // assim que o código é digitado, mostra o produto e o código de doação
  const v = $("eanCode").value.replace(/\D/g, ""), box = $("eanPrev");
  if (v.length < 6) { box.classList.add("hidden"); return; }
  const p = eanFind(v); box.classList.remove("hidden"); box.classList.toggle("none", !p);
  box.innerHTML = p ? `<div><small>PRODUTO</small><span>${esc(p.name)}</span></div><div class="r"><small>CÓDIGO DE DOAÇÃO</small><b>${esc(p.codigo_doacao || "—")}</b></div>`
                    : '<div><small>NÃO CADASTRADO</small><span>Será cadastrado a seguir</span></div>';
}
const eanClose = () => $("eanModal").classList.add("hidden");
$("dEan").onclick = () => {
  $("eanCode").value = ""; eanPreview(); $("eanModal").classList.remove("hidden"); setTimeout(() => $("eanCode").focus(), 80);
};
$("eanClose").onclick = $("eanCancel").onclick = eanClose;
$("eanCode").oninput = eanPreview;
function eanGo() {
  const v = $("eanCode").value.replace(/\D/g, "");
  if (!/^\d{6,14}$/.test(v)) { toast("Digite o código de barras só com números (6 a 14 dígitos)."); return $("eanCode").focus(); }
  eanClose(); lastScan = { c: "", t: 0 }; donationScan(v);        // mesmo caminho da leitura pela câmera: cadastro (se novo) e quantidade
}
$("eanGo").onclick = eanGo;
$("eanCode").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); eanGo(); } };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("eanModal").classList.contains("hidden")) eanClose(); });

// ---------- aba Doação ----------
const UK = "validamais-dunid", DK = "validamais-doacao", HK = "validamais-doacoes", NK = "validamais-dnomes";
let don = store.get(DK, null) || { itens: [], inicio: new Date().toISOString() }, dSel = "", dVal = "", curRom = null, histList = [], unsubHist = null, lastScan = { c: "", t: 0 };
function norm(s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function pkey(p) { return p.barcode || norm(p.name); }
function tamOf(p) { return (p && store.get(TK, {})[pkey(p)]) || "M"; }
function dayOf(p) { const t = p.updatedAt, v = t && t.toMillis ? t.toMillis() : (t ? Number(t) : Date.now()); return new Date(v).toLocaleDateString("pt-BR"); }
const fq = q => (Math.round(q * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sumU = u => don.itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0);
const dataBR = d => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
const FERR = ["Etiquetas", "Inventario", "Cadastros"], FK = "validamais-ferr";
function tab(t) {
  curTab = t;
  ["Loja", "Doacao", "Etiquetas", "Inventario", "Cadastros"].forEach(n => { $("tab" + n).classList.toggle("hidden", n !== t); $("nav" + n).classList.toggle("active", n === t); });
  [["Loja", t === "Loja"], ["Doacao", t === "Doacao"], ["Etiquetas", t === "Etiquetas"]].forEach(([n, on]) => $("tb" + n).classList.toggle("active", on));
  document.body.dataset.tab = t; document.body.dataset.grp = t;
  if (t === "Doacao" && typeof dView === "function") dView("lista");
}
function dCodTxt(i) {   // kg: código de doação · un: código de barras
  const pr = products.find(x => norm(x.name || "") === norm(i.nome)) || {};
  return i.unidade === "un"
    ? (pr.codigo_balanca ? "Cód. balança: " + esc(String(Number(pr.codigo_balanca))) : pr.barcode ? "Cód. barras: " + esc(pr.barcode) : i.bar ? "Cód. barras: " + esc(i.bar) : i.cod ? "Cód.: " + esc(i.cod) : "")
    : ((pr.codigo_doacao || i.cod) ? "Cód. doação: " + esc(pr.codigo_doacao || i.cod) : "");
}
const burnTxt = (t, off) => [...String(t)].map((c, k) => c === " " ? " " : `<span class="bc" style="animation-delay:${off + k * 38}ms">${esc(c)}</span>`).join("");
function renderDon() {
  if (typeof dTop6Render === "function") dTop6Render();
  $("dKg").textContent = fq(sumU("kg")); $("dUn").textContent = fq(sumU("un")); $("dKg").parentElement.style.display = sumU("kg") > 0 ? "" : "none"; $("dUn").parentElement.style.display = sumU("un") > 0 ? "" : "none"; $("dItens").textContent = don.itens.length;
  $("dLista").innerHTML = don.itens.length ? don.itens.map((i, x) => `<div class="ditem${window.dNovo===i.key?" novo":""}${(window.dLastKey&&don.itens.some(z=>z.key===window.dLastKey)?i.key===window.dLastKey:x===don.itens.length-1)?" ult":""}${dSel && norm(i.nome) === norm(dSel) ? " cur" : ""}"><div class="dn"><b${window.dBurn===i.key?` class="burn" style="--n:${[...i.nome].length}"`:""}>${window.dBurn===i.key?burnTxt(i.nome,350):esc(i.nome)}</b>${dCodTxt(i) ? `<span class="dcod">${dCodTxt(i)}</span>` : ""}<small>${i.lanc} lançamento(s)${(i.cx || i.sem) ? `<span class="dtara">${i.cx ? i.cx + " com TARA" : ""}${i.cx && i.sem ? " · " : ""}${i.sem ? i.sem + " sem TARA" : ""}</span>` : ""}</small></div><div class="dq" data-edit="${x}" role="button" tabindex="0" title="Tocar para corrigir a quantidade"><span class="cnum" data-v="${i.qtd}">${fq(i.qtd)}</span> <span>${esc(i.unidade)}</span></div><button class="cdel" data-drop="${x}" aria-label="Remover ${esc(i.nome)}">✕</button></div>`).reverse().join("") : '<p class="empty">Nada lançado ainda.<br>Toque num produto abaixo para começar.</p>';
  if (window.dBurn) { const k = window.dBurn; setTimeout(() => dFx(k), 380); }
  window.dBurn = ""; renderKey();
}
const dBase = n => String(n || "").replace(/\s+(kg|un)$/i, "").trim();
const dFamKey = n => norm(dBase(n).split(/\s+/)[0] || "");
const dTitle = w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "";
function dTop6Render(){ const box=$("dTop6"); if(!box) return; let rank=[]; try{ const hd=store.get("validamais-doculto",{}), recs=(db?topDb:store.get(HK,[])).filter(r=>r&&!hd[r._id||(typeof r.em==="number"?String(r.em):"")]), m=new Map();
    recs.forEach(r=>{ const seen=new Set(); (r.itens||[]).forEach(i=>{ const k=norm(i.nome)+"|"+i.unidade, o=m.get(k)||{n:i.nome,u:i.unidade,c:i.cod||"",d:0,q:0}; if(!seen.has(k)){ o.d++; seen.add(k); } o.q+=Number(i.qtd)||0; if(i.cod) o.c=i.cod; m.set(k,o); }); });
    rank=[...m.values()].sort((a,b)=>b.d-a.d||b.q-a.q); }catch(e){}
  if(!rank.length) rank=shortcuts.map(x=>({n:x.n,c:x.c,u:x.u,d:0,q:0}));
  // agrupa por família (primeira palavra): Banana → nanica, prata…
  const fams=new Map(); rank.forEach(o=>{ const k=dFamKey(o.n); if(!k) return; if(!fams.has(k)) fams.set(k,{k,w:dBase(o.n).split(/\s+/)[0],v:new Map()}); const f=fams.get(k), nk=norm(dBase(o.n)); if(!f.v.has(nk)) f.v.set(nk,{n:o.n,c:o.c,u:o.u,d:o.d}); });
  let top=[...fams.values()].slice(0,6);
  top.forEach(f=>{ let cat=""; try{ const p0=products.find(p=>norm(dBase(p.name))===[...f.v.keys()][0]); cat=p0&&p0.category||""; }catch(e){}
    try{ products.forEach(p=>{ if(!p||!p.name||dFamKey(p.name)!==f.k) return; if(cat&&p.category&&p.category!==cat) return; const nk=norm(dBase(p.name)); if(f.v.has(nk)) return; if(f.v.size>=8) return; f.v.set(nk,{n:p.name,c:p.codigo_doacao||"",u:unitOf(p.name),d:-1}); }); }catch(e){}
    f.list=[...f.v.values()].sort((a,b)=>b.d-a.d||a.n.localeCompare(b.n,"pt-BR")); });
  box._auto=top; const cfg=dBalCfg(); if(cfg) top=cfg.map(c=>({k:norm(c.w),w:c.w,list:c.v.map(o=>({n:o.n,c:o.c||"",u:o.u||"kg",d:0}))}));
  const ed=!!window.dEditBal; box.classList.toggle("vazio",!top.length&&!ed); box._f=top; const op=ed?-1:box._open;
  const colp=!!store.get("validamais-dcol",false)&&!ed&&op<0; $("dDock").classList.toggle("col",colp); $("dBalCol").textContent=colp?"▴ Mostrar":"▾ Recolher"; $("dBalCol").hidden=(ed||op>=0);
  $("dBalEdit").textContent=ed?"✔ Concluir":"✎ Editar"; $("dBalEdit").hidden=(op>=0); $("dBalAuto").hidden=!(ed&&cfg);
  if(op!=null&&op>=0&&top[op]){ const f=top[op];
    $("dT6L").textContent="⭐ "+dTitle(f.w).toUpperCase()+" — QUAL?";
    $("dT6").classList.add("var");
    $("dT6").innerHTML=f.list.map((o,i)=>{ const same=dFamKey(o.n)===f.k, rest=(same?dBase(o.n).split(/\s+/).slice(1).join(" "):dBase(o.n)); return `<button type="button" data-tv="${i}">${esc(rest?dTitle(rest.split(" ")[0])+(rest.includes(" ")?" "+rest.split(" ").slice(1).join(" ").toLowerCase():""):"Comum")}<small>${o.u}</small></button>`; }).join("")+`<button type="button" class="dback" data-tback="1">← voltar</button>`;
  } else { box._open=-1; $("dT6L").textContent=ed?"✎ TOQUE NUM BALÃO PARA EDITAR":(cfg?"⭐ MEUS BALÕES":"⭐ MAIS DOADOS"); $("dT6").classList.remove("var");
    $("dT6").innerHTML=top.map((f,i)=>`<button type="button" class="${ed?"ed":""}" data-t6="${i}">${esc(dTitle(f.w))}<small>${f.list.length>1?f.list.length+" tipos"+(ed?"":" ›"):(f.list[0]?f.list[0].u:"")}</small></button>`).join("")+(ed&&top.length<9?'<button type="button" class="dnew" data-tnew="1">＋ Novo</button>':""); } }
function dPickVar(o){ const box=$("dTop6"); box._open=-1; buzz(); const p=products.find(x=>norm(dBase(x.name))===norm(dBase(o.n)))||prodFor(o.n); selectProd(p?p.name:o.n,o.c||"",o.u); }
$("dT6").onclick=e=>{ const box=$("dTop6"), f=box._f||[];
  if(window.dEditBal){ if(e.target.closest("[data-tnew]")) return dBalOpen(-1); const b=e.target.closest("[data-t6]"); if(b) dBalOpen(Number(b.dataset.t6)); return; }
  if(e.target.closest("[data-tback]")){ box._open=-1; dTop6Render(); return; }
  const v=e.target.closest("[data-tv]"); if(v){ const o=(f[box._open]||{list:[]}).list[Number(v.dataset.tv)]; if(o) dPickVar(o); return; }
  const b=e.target.closest("[data-t6]"); if(!b) return; const fam=f[Number(b.dataset.t6)]; if(!fam) return;
  if(fam.list.length>1){ buzz(); box._open=Number(b.dataset.t6); dTop6Render(); } else dPickVar(fam.list[0]); };
function dBalCfg(){ const v=store.get("validamais-dbal",null); return Array.isArray(v)&&v.length?v:null; }
function dBalEnsure(){ let c=dBalCfg(); if(c) return c; const a=$("dTop6")._auto||[]; c=a.map(f=>({w:dTitle(f.w),v:f.list.map(o=>({n:o.n,c:o.c||"",u:o.u||"kg"}))})); store.set("validamais-dbal",c); return c; }
let dbIdx=-1, dbDraft=null;
function dBalOpen(i){ const c=dBalEnsure(); dbIdx=i; dbDraft=i>=0?JSON.parse(JSON.stringify(c[i])):{w:"",v:[]};
  $("dbTit").textContent=i>=0?"Editar balão":"Novo balão"; $("dbNome").value=dbDraft.w; $("dbBusca").value=""; $("dbSug").innerHTML=""; $("dbExcluir").style.display=i>=0?"":"none"; dbRender(); dbMvUpd(); $("dBalModal").classList.remove("hidden"); }
function dbRender(){ $("dbTipos").innerHTML=dbDraft.v.length?dbDraft.v.map((o,x)=>`<span class="ch">${esc(dBase(o.n))}<button type="button" data-dx="${x}" aria-label="Remover">✕</button></span>`).join(""):'<small style="color:var(--mut)">Nenhum tipo ainda. Busque abaixo para adicionar.</small>'; }
function dbSug(){ const q=norm($("dbBusca").value.trim()); if(!q){ $("dbSug").innerHTML=""; return; } const seen=new Set(), out=[];
  for(const p of products){ if(!p||!p.name) continue; const nk=norm(dBase(p.name)); if(seen.has(nk)||!nk.includes(q)) continue; if(dbDraft.v.some(o=>norm(dBase(o.n))===nk)) continue; seen.add(nk); out.push(p); if(out.length>=6) break; }
  $("dbSug").innerHTML=out.map((p,x)=>`<button type="button" data-sx="${esc(p.name)}">${esc(dBase(p.name))}</button>`).join("")+`<button type="button" data-sfree="1">＋ Adicionar "${esc($("dbBusca").value.trim())}"</button>`; }
$("dbBusca").oninput=dbSug;
$("dbSug").onclick=e=>{ const b=e.target.closest("button"); if(!b) return; let n;
  if(b.dataset.sx) n=b.dataset.sx; else if(b.dataset.sfree) n=$("dbBusca").value.trim().toUpperCase(); if(!n) return;
  const p=products.find(x=>x.name===n); dbDraft.v.push({n,c:(p&&p.codigo_doacao)||"",u:unitOf(n)});
  if(!$("dbNome").value.trim()) $("dbNome").value=dTitle(dBase(n).split(/\s+/)[0]);
  $("dbBusca").value=""; $("dbSug").innerHTML=""; dbRender(); };
$("dbTipos").onclick=e=>{ const b=e.target.closest("[data-dx]"); if(!b) return; dbDraft.v.splice(Number(b.dataset.dx),1); dbRender(); };
function dbMvUpd(){ const c=dBalCfg()||[]; $("dbMv").style.display=dbIdx>=0?"":"none"; $("dbEsq").disabled=!(dbIdx>0); $("dbDir").disabled=!(dbIdx>=0&&dbIdx<c.length-1); }
function dbMove(d){ const c=dBalEnsure(), j=dbIdx+d; if(dbIdx<0||j<0||j>=c.length) return; [c[dbIdx],c[j]]=[c[j],c[dbIdx]]; store.set("validamais-dbal",c); dbIdx=j; dbMvUpd(); dTop6Render(); }
$("dbEsq").onclick=()=>dbMove(-1); $("dbDir").onclick=()=>dbMove(1);
function dbClose(){ $("dBalModal").classList.add("hidden"); }
$("dbX").onclick=dbClose;
$("dbSalvar").onclick=()=>{ const w=$("dbNome").value.trim().slice(0,24); if(!w) return toast("Dê um nome ao balão."); if(!dbDraft.v.length) return toast("Adicione pelo menos um tipo."); dbDraft.w=w;
  const c=dBalEnsure(); if(dbIdx>=0) c[dbIdx]=dbDraft; else c.push(dbDraft); store.set("validamais-dbal",c.slice(0,9)); dbClose(); dTop6Render(); };
$("dbExcluir").onclick=()=>{ const c=dBalEnsure(); if(dbIdx<0) return; const rem=c.splice(dbIdx,1)[0]; store.set("validamais-dbal",c.length?c:null); dbClose(); dTop6Render(); toast(`Balão "${rem.w}" excluído.`); };
$("dBalCol").onclick=()=>{ store.set("validamais-dcol",!store.get("validamais-dcol",false)); dTop6Render(); };
$("dBalEdit").onclick=()=>{ window.dEditBal=!window.dEditBal; $("dTop6")._open=-1; dTop6Render(); };
$("dBalAuto").onclick=()=>{ if(!confirm("Voltar aos balões automáticos? Os seus balões serão apagados.")) return; store.set("validamais-dbal",null); dTop6Render(); };
function dFinOpen(){ if(!don.itens.length) return toast("Nada lançado ainda."); const nomes=[...don.itens].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(i=>esc(i.nome.replace(/\s+(kg|un)$/i,""))).join(" · ");
  $("dFinBody").innerHTML=`<div class="ft"><span>Itens</span><b>${don.itens.length}</b></div><div class="ft"><span>Total</span><b>${[sumU("kg")>0?fq(sumU("kg"))+" kg":"",sumU("un")>0?fq(sumU("un"))+" un":""].filter(Boolean).join(" + ")}</b></div><div class="ft" style="font-weight:600;font-size:13px">${nomes}</div>`;
  $("dFinSheet").classList.remove("hidden"); }
function dFinClose(){ $("dFinSheet").classList.add("hidden"); }
$("dStrip").onclick=dFinOpen; $("dStrip").onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); dFinOpen(); } };
$("dFinX").onclick=dFinClose;
$("dFinOk").onclick=()=>{ dFinClose(); $("dFinalizar").click(); };
$("dFinLimpar").onclick=()=>{ dFinClose(); $("dLimpar").click(); };
function dView(v){ const e=$("donaEntrada"); if(!e) return; e.dataset.dview=v; if(v==="pick"){ if(window.npClose) window.npClose(); window.scrollTo({top:0}); } }
$("dAddItem").onclick=()=>{ dView("pick"); setTimeout(()=>{ try{ $("dBusca").focus({preventScroll:true}); }catch(e){} },60); };
$("dBarScan").onclick=()=>$("fab").click();
$("dVoltar").onclick=()=>dView("lista");
$("dTrocar").onclick=()=>{ dSel=""; dCodSel=""; $("dPeso").value=""; if(window.npClose) window.npClose(); renderDon(); };
["dScan","dEan"].forEach(id=>$(id).addEventListener("click",()=>dView("lista"),true));

// ---------- efeito ao lançar: chuva da própria fruta + contador + anel de luz ----------
const DFX_EMO = [[/tomate/,"🍅"],[/banana/,"🍌"],[/lim[aã]o/,"🍋"],[/manga/,"🥭"],[/pimentao|pimenta/,"🫑"],[/pepino/,"🥒"],[/cebola/,"🧅"],[/batata/,"🥔"],[/berinjela/,"🍆"],[/mam[aã]o/,"🍈"],[/abacaxi/,"🍍"],[/uva/,"🍇"],[/laranja|tangerina|mexerica|ponkan/,"🍊"],[/ma[cç]a/,"🍎"],[/pera/,"🍐"],[/morango/,"🍓"],[/melancia/,"🍉"],[/melao/,"🍈"],[/abacate/,"🥑"],[/cenoura/,"🥕"],[/milho/,"🌽"],[/alho/,"🧄"],[/alface|couve|rucula|agriao|repolho|brocolis|espinafre|cheiro|salsa|coentro/,"🥬"],[/abobora|moranga|jilo|chuchu|vagem|quiabo|abobrinha/,"🥒"],[/coco/,"🥥"],[/kiwi/,"🥝"],[/pessego|nectarina|ameixa/,"🍑"],[/cereja/,"🍒"]];
function dFxEmoji(nome){ const n = norm(nome || ""); for (const [r, e] of DFX_EMO) if (r.test(n)) return e; return "✨"; }
function dFx(key) {
  try {
    const row = document.querySelector(".ditem.novo"); if (!row) return;
    const it = don.itens.find(i => i.key === key), num = row.querySelector(".cnum"); if (!it || !num) return;
    try { if (navigator.vibrate) navigator.vibrate([18, 40, 18, 40, 30]); } catch (_) {}
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // número sobe de zero até o valor e dá um "pop"
    const v = Number(num.dataset.v), t0 = performance.now(), D = 750;
    if (isFinite(v) && v > 0) {
      const step = now => { const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3); num.textContent = p >= 1 ? fq(v) : fq(Math.round(v * e * 10) / 10); if (p < 1 && num.isConnected) requestAnimationFrame(step); };
      num.classList.add("pop"); requestAnimationFrame(step);
    }
    // origem das partículas: o número, dentro da própria linha (acompanha a rolagem)
    const rr = row.getBoundingClientRect(), nr = num.getBoundingClientRect();
    const ox = nr.left - rr.left + nr.width / 2, oy = nr.top - rr.top + nr.height / 2;
    const ring = document.createElement("div"); ring.className = "dfx ring"; ring.style.cssText = `left:${ox - 14}px;top:${oy - 14}px;width:28px;height:28px`;
    row.appendChild(ring); ring.animate([{ transform: "scale(.4)", opacity: .95 }, { transform: "scale(5.5)", opacity: 0 }], { duration: 700, easing: "ease-out" }).onfinish = () => ring.remove();
    const emo = dFxEmoji(it.nome), N = 16;
    for (let k = 0; k < N; k++) {
      const s = document.createElement("div"); s.className = "dfx"; s.textContent = k % 4 === 3 ? "✨" : emo;
      const sz = 16 + Math.random() * 14; s.style.cssText = `left:${ox - sz / 2}px;top:${oy - sz / 2}px;font-size:${sz}px`; row.appendChild(s);
      const ang = (-Math.PI / 2) + (Math.random() - .5) * Math.PI * 1.5, dist = 70 + Math.random() * 120, dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, fall = 90 + Math.random() * 90, rot = (Math.random() - .5) * 540;
      s.animate([{ transform: "translate(0,0) scale(.3) rotate(0)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(1.1) rotate(${rot * .5}deg)`, opacity: 1, offset: .45 }, { transform: `translate(${dx * 1.15}px,${dy + fall}px) scale(.8) rotate(${rot}deg)`, opacity: 0 }], { duration: 1050 + Math.random() * 450, easing: "cubic-bezier(.2,.7,.4,1)", delay: Math.random() * 120 }).onfinish = () => s.remove();
    }
  } catch (e) { console.error(e); }
}
function dNovoMark(key){ window.dNovo=key; window.dBurn=key; window.dLastKey=key; clearTimeout(window.dNovoT); window.dNovoT=setTimeout(()=>{ window.dNovo=""; const n=document.querySelector(".ditem.novo"); if(n) n.classList.remove("novo"); },2600); setTimeout(()=>{ const n=document.querySelector(".ditem.novo"); if(n && !romAberta()) n.scrollIntoView({block:"center",behavior:"smooth"}); },450); }
function addDon(nome, unidade, qtd, cod = "", bar = "", meta = null) {
  if (romAberta()) return addToRom(nome, unidade, qtd, cod, bar);
  qtd = Math.round(qtd * 1000) / 1000; if (!(qtd > 0)) return 0; buzz();
  const key = norm(nome) + "|" + unidade; let it = don.itens.find(i => i.key === key);
  if (it) { it.qtd = Math.round((it.qtd + qtd) * 1000) / 1000; it.lanc++; } else { it = { key, nome: nome.trim().slice(0, 60), unidade, qtd, lanc: 1 }; don.itens.push(it); }
  if (bar && !it.bar) it.bar = bar;
  if (meta) { if (meta.sem) it.sem = (it.sem || 0) + 1; else if (meta.tara) { it.cx = (it.cx || 0) + 1; it.tara = Math.round(((it.tara || 0) + meta.tara) * 1000) / 1000; } }
  const pr = products.find(x => norm(x.name) === norm(nome)); it.cod =it.cod || cod || (pr && (pr.codigo_doacao || pr.barcode || pr.codigo_balanca)) || "";
  dNovoMark(it.key); store.set(DK, don); renderDon(); return it.qtd;
}
const isScale = c => /^2\d{12}$/.test(c) || /^2\d{11}$/.test(c) || /^02\d{11}$/.test(c);   // EAN-13 de balança, ou UPC-A de 12 dígitos (etiqueta PRIX), às vezes lido com um 0 na frente
function parseScale(code) {
  if (/^02\d{11}$/.test(code)) code = code.slice(1);
  if (/^2\d{11}$/.test(code)) {                    // UPC-A (PRIX): 2 + item (5) + valor (5) + dígito verificador. O valor é o PREÇO total em centavos
    const v = Number(code.slice(6, 11)), peso = (C.balanca || {}).upcValor === "peso";
    return { item: code.slice(1, 6).padStart(6, "0"), kg: peso ? v / 1000 : 0, total: peso ? 0 : v / 100 };
  }
  const b = C.balanca || {}, cd = b.codigoDigitos ?? 6, vd = b.valorDigitos ?? 5, div = b.divisor ?? 1000;
  return { item: code.slice(1, 1 + cd), kg: Number(code.slice(1 + cd, 1 + cd + vd)) / div, total: 0 };
}
window.vmScale = { is: isScale, parse: parseScale };

// ---------- etiqueta PRIX: peso a partir do preço total ----------
const PKK = "validamais-precokg", brl = v => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let pkResolve = null, pkTotal = 0, pkNome = "";
const precoKg = n => Number((store.get(PKK, {})[norm(n)] || {}).p) || 0;
window.vmPk = { get: n => precoKg(n), set: (n, p) => { const m = store.get(PKK, {}); m[norm(n)] = { p: Math.round(p * 100) / 100, em: Date.now() }; store.set(PKK, m); } };
function askPeso(nome, total) {                        // devolve { kg, nota } ou null se cancelar
  const pk = precoKg(nome);
  if (pk > 0) { const kg = Math.round(total / pk * 1000) / 1000; if (kg > 0) return Promise.resolve({ kg, nota: ` (R$ ${brl(total)} ÷ R$ ${brl(pk)}/kg)` }); }
  return new Promise(res => {
    pkResolve = res; pkTotal = total; pkNome = nome;
    $("pkNome").textContent = nome; $("pkInfo").textContent = `Etiqueta com total de R$ ${brl(total)}. Digite o peso que está na etiqueta (PESO). O app guarda o preço do kg e, nas próximas, calcula o peso sozinho.`;
    $("pkPeso").value = ""; $("pkModal").classList.remove("hidden"); setTimeout(() => $("pkPeso").focus(), 80);
  });
}
function pkDone(ok) {
  const res = pkResolve; if (!res) return;
  if (ok) { const kg = Number(String($("pkPeso").value).replace(",", ".")); if (!(kg > 0) || kg > 999) return toast("Digite o peso em kg, como está na etiqueta.");
    const p = Math.round(pkTotal / kg * 100) / 100, m = store.get(PKK, {}); m[norm(pkNome)] = { p, em: Date.now() }; store.set(PKK, m);
    pkResolve = null; $("pkModal").classList.add("hidden"); if (window.npClose) window.npClose(); res({ kg: Math.round(kg * 1000) / 1000, nota: ` (preço do kg guardado: R$ ${brl(p)})` }); }
  else { pkResolve = null; $("pkModal").classList.add("hidden"); if (window.npClose) window.npClose(); res(null); }
}
$("pkOk").onclick = () => pkDone(true); $("pkCancel").onclick = $("pkClose").onclick = () => pkDone(false);
async function donationScan(code) {
  const now = Date.now(); if (code === lastScan.c && now - lastScan.t < 2500) return;   // ignora leitura repetida do mesmo código
  lastScan = { c: code, t: now };
  if (nrResolve || qtResolve || pkResolve) return;   // há um cadastro ou uma pergunta aberta
  buzz(); beep();
  const names = store.get(NK, {}); let key, unidade, qtd, regd = null, donCod = "", precoTot = 0, notaPeso = "";
  if (isScale(code)) { const s = parseScale(code); key = "B" + s.item; unidade = "kg"; qtd = s.kg; precoTot = s.total || 0;
    if (!(qtd > 0) && !(precoTot > 0)) { toast("Etiqueta de balança sem peso legível. Ajuste a configuração 'balanca' no config.js."); return; } }
  else { key = code; unidade = "un"; qtd = 1; }
  let nome = (unidade === "un" && (products.find(p => p.barcode === code) || {}).name) || (unidade === "kg" && (products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(key.slice(1))) || {}).name) || names[key];
  if (nome && products.length && !adopted.has(key)) { adopted.add(key);       // nome que só existia neste aparelho passa para o cadastro compartilhado
    const inBase = unidade === "kg" ? products.some(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(key.slice(1))) : products.some(p => p.barcode === code);
    if (!inBase) registerProduct({ name: nome, barcode: unidade === "kg" ? "" : code, codigo_balanca: unidade === "kg" ? String(Number(key.slice(1))) : "" }); }
  if (!nome) { const sc = unidade === "kg", plu = sc ? String(Number(key.slice(1))) : "", r = await askNewProduct(code, sc, plu, true);
    if (!r) { lastScan.t = Date.now(); return; }
    regd = registerProduct({ name: r.nome, barcode: sc ? "" : code, codigo_balanca: plu, codigo_doacao: r.don || "" });
    nome = r.nome; names[key] = nome; store.set(NK, names); }
  const scaleLbl = isScale(code); if (unidade === "kg" && unitOf(nome) === "un") { unidade = "un"; qtd = 1; precoTot = 0; }
  if (precoTot > 0) {                                  // etiqueta PRIX traz o preço total: peso = total ÷ preço do kg
    const r = await askPeso(nome, precoTot); if (!r) { lastScan.t = Date.now(); return; } qtd = r.kg; notaPeso = r.nota; }
  if (unidade === "un" && !scaleLbl) {
    const prod = regd || products.find(p => p.barcode === code) || products.find(p => norm(p.name || "") === norm(nome));
    const r = await askQty(nome, prod, code); if (!r) { lastScan.t = Date.now(); return; } qtd = r.q; donCod = r.cod; }   // item por unidade: informa a quantidade em vez de bipar várias vezes
  const romAbertaAntes = romAberta();
  // item bipado por código de barras: no relatório e na lista fica o código de balança (PLU) do cadastro; sem PLU, mantém o código antigo
  const prodPlu = (!scaleLbl && unidade === "un") ? (regd || products.find(p => p.barcode === code) || products.find(p => norm(p.name || "") === norm(nome)) || {}) : {};
  const plu = prodPlu.codigo_balanca ? String(Number(prodPlu.codigo_balanca)) : "";
  const total = addDon(nome, unidade, qtd, (!scaleLbl && unidade === "un") ? (plu || donCod || code) : "", (!scaleLbl && unidade === "un") ? code : "");
  if (!romAbertaAntes) toast(`${nome}${donCod ? " (cód. " + donCod + ")" : ""}: +${fq(qtd)} ${unidade}${notaPeso} → total ${fq(total)} ${unidade}`); lastScan.t = Date.now();
}
// pesagem manual
// ---------- TARA: padrão 2 kg, dá para pesar sem TARA ----------
var taraOn;   // undefined ou true = com caixa; false = sem caixa (volta a "com caixa" após cada lançamento)
function taraKg() { var v = Number((store.get("validamais-tara", {}) || {}).kg); return isFinite(v) && v >= 0 && v < 50 ? v : 2; }
function taraRefresh() {
  var row = $("dTara"); if (!row) return;
  var tem = dUnit === "kg" && taraKg() > 0; row.classList.toggle("hidden", !tem); if (!tem) return;
  var on = taraOn !== false, b = $("tCx");
  b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  b.textContent = on ? "Com TARA (−" + fq(taraKg()) + " kg)" : "Sem TARA";
  var raw = Number(String($("dPeso").value || "").replace(",", ".")), el = $("dLiq"), bad = false, t = "";
  if (raw > 0) { if (on) { var l = raw - taraKg(); bad = l <= 0; t = "Balança " + fq(raw) + " → líquido " + (bad ? "—" : fq(l) + " kg"); } else t = "Sem desconto: " + fq(raw) + " kg"; }
  else t = on ? "Digite o peso da balança" : "";
  el.textContent = t; el.classList.toggle("bad", bad);
}
window.taraRefresh = taraRefresh;
$("tCx").onclick = () => { taraOn = taraOn === false; taraRefresh(); };
$("tEdit").onclick = () => {
  const r = prompt("Peso da TARA (caixa vazia), em kg (0 desliga):", String(taraKg()).replace(".", ","));
  if (r === null) return; const n = Number(String(r).replace(",", ".").trim());
  if (!(n >= 0 && n < 50)) return toast("Valor inválido.");
  store.set("validamais-tara", { kg: Math.round(n * 1000) / 1000 }); taraRefresh(); toast(n > 0 ? "TARA: " + fq(n) + " kg" : "TARA desligada.");
};
function renderKey() {
  $("dNome").textContent = dSel || "Pesquise o produto"; $("dNow").classList.toggle("vazio", !dSel);
  const it = dSel && don.itens.find(i => i.key === norm(dSel) + "|" + dUnit);
  const plus = lastAdd && lastAdd.k === norm(dSel) + "|" + dUnit && Date.now() - lastAdd.t < 2500 ? `<i class="plus">+${fq(lastAdd.q)}</i>` : "";
  $("dSelInfo").innerHTML = !dSel ? "" : it ? `<b>${plus}${fq(it.qtd)} ${esc(it.unidade)}</b>${it.lanc} lançamento${it.lanc > 1 ? "s" : ""}` : `<b>0 ${dUnit}</b>ainda não lançado`;
  taraRefresh();
}
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
const unitOf = n => store.get(UK, {})[norm(n)] || (/^abacaxi/.test(norm(n)) ? "un" : "kg");
function setUnit(u, save) { dUnit = u; $("uKg").classList.toggle("sel", u === "kg"); $("uUn").classList.toggle("sel", u === "un");
  $("dPeso").placeholder = u === "un" ? "unidades (ex.: 3)" : "kg (ex.: 2,5)"; $("dPeso").toggleAttribute("data-np-int", u === "un");
  if (save && dSel) { const m = store.get(UK, {}); m[norm(dSel)] = u; store.set(UK, m); } renderKey(); }
let dUnit = "kg", lastAdd = null, addTimer = null; $("uKg").onclick = () => setUnit("kg", true); $("uUn").onclick = () => setUnit("un", true);
// atalhos padrão: só servem de sugestão para os balões enquanto ainda não há histórico de doações
const QK = "validamais-atalhos";
const QDEF = () => ["Chuchu", "Batata", "Abacaxi", "Banana", "Tomate", "Cebola", "Cenoura", "Mamão", "Laranja", "Maçã", "Limão", "Alface", "Pepino", "Pimentão", "Abobrinha", "Melão"].map(n => ({ n, c: "", u: /^abacaxi/i.test(n) ? "un" : "kg" }));
const shortcuts = (() => { const v = store.get(QK, null); return Array.isArray(v) && v.length ? v : QDEF(); })()
  .sort((a, b) => a.n.localeCompare(b.n, "pt-BR", { sensitivity: "base" }));
let dCodSel = "";
const prodFor = l => { const q = norm(l); return products.find(p => norm(p.name || "").startsWith(q)) || products.find(p => norm(p.name || "").includes(q)); };
function selectProd(n, code, unit) { dView("lista"); dSel = n; dCodSel = code || ""; setUnit(unit || unitOf(n), false); $("dCod").value = code || (products.find(x => norm(x.name) === norm(n)) || {}).codigo_doacao || ""; $("dBusca").value = ""; $("dSug").innerHTML = ""; renderDon(); $("dPeso").focus({ preventScroll: true }); }
$("dCodSave").onclick = () => { if (!dSel) return toast("Pesquise o produto primeiro."); const pr = products.find(x => norm(x.name) === norm(dSel)) || { name: dSel };
  const v = saveCode(pr, "codigo_doacao", $("dCod").value); if (v !== null) $("dCod").value = v; };
// aviso de quantidade fora do normal: aprende o usual de cada produto (por lançamento)
const DSTAT = "valida_dstat";
const dStatKey = (n, u) => norm(n) + "|" + u;
function dStatLearn(n, u, q) { const s = store.get(DSTAT, {}), k = dStatKey(n, u), o = s[k] || { n: 0, sum: 0, max: 0 };
  o.n++; o.sum += q; o.max = Math.max(o.max, q); s[k] = o; store.set(DSTAT, s); }
// diálogo no tema do app (substitui o confirm() do navegador)
function askConfirm({ icon = "⚠️", title, big, bigUnit, text, sub, ok = "Confirmar", cancel = "Cancelar" }) {
  return new Promise(res => {
    if (window.npClose) window.npClose();
    const bg = document.createElement("div"); bg.className = "askbg";
    bg.innerHTML = `<div class="ask" role="alertdialog" aria-modal="true"><div class="ai">${icon}</div><h3>${esc(title)}</h3>` +
      (big ? `<div class="big">${esc(big)} <small>${esc(bigUnit || "")}</small></div>` : "") +
      (text ? `<p><b>${esc(text)}</b></p>` : "") + (sub ? `<p>${esc(sub)}</p>` : "") +
      `<div class="arow"><button type="button" data-a="0">${esc(cancel)}</button><button type="button" class="ok" data-a="1">${esc(ok)}</button></div></div>`;
    const done = v => { bg.remove(); res(v); };
    bg.onclick = e => { const b = e.target.closest("[data-a]"); if (b) done(b.dataset.a === "1"); else if (e.target === bg) done(null); };
    document.body.appendChild(bg); bg.querySelector(".ok").focus({ preventScroll: true });
  });
}
async function dOddOk(n, u, q) {
  const o = store.get(DSTAT, {})[dStatKey(n, u)], piso = u === "un" ? 24 : 10;   // abaixo do piso nunca avisa
  let lim = u === "un" ? 100 : 30;                                                 // sem histórico: teto fixo
  if (o && o.n >= 3) lim = Math.max(piso, (o.sum / o.n) * 3, o.max * 1.5);
  if (q <= lim) return true;
  return askConfirm({ title: "Quantidade acima do normal", big: fq(q), bigUnit: u, text: n,
    sub: o && o.n >= 3 ? `O usual é cerca de ${fq(o.sum / o.n)} ${u} por lançamento.` : "Confira se não faltou uma vírgula.",
    ok: "Está certo", cancel: "Corrigir" });
}
async function dPesoAdd() { let q = Number(($("dPeso").value || "").replace(",", "."));
  if (!dSel) return toast("Pesquise o produto."); if (!(q > 0)) return toast(dUnit === "un" ? "Digite a quantidade." : "Digite o peso em kg.");
  if (dUnit === "un") q = Math.round(q); if (!(q > 0)) return toast("Digite a quantidade.");
  let meta = null;
  if (dUnit === "kg" && taraKg() > 0) {
    const t = taraKg(); meta = { bruto: q, tara: 0, sem: false };
    if (taraOn === false) meta.sem = true;
    else if (q <= t) {
      const r = await askConfirm({ icon: "📦", title: "Menor que a TARA", big: fq(q), bigUnit: "kg", text: dSel, sub: `A TARA é de ${fq(t)} kg. Este peso é sem TARA?`, ok: "Sim, sem TARA", cancel: "Corrigir" });
      if (!r) return; meta.sem = true;
    } else { meta.tara = t; q = Math.round((q - t) * 1000) / 1000; }
  }
  if (!(await dOddOk(dSel, dUnit, q))) return;
  dStatLearn(dSel, dUnit, q);
  const nome = dSel, un = dUnit, total = addDon(dSel, dUnit, q, dCodSel, "", meta);
  taraOn = true;
  if (meta) toast(`${nome}: +${fq(q)} ${un}` + (meta.tara ? ` · com TARA (bruto ${fq(meta.bruto)} − ${fq(meta.tara)} kg)` : " · sem TARA") + ` → total ${fq(total)} ${un}`);
  $("dPeso").value = ""; $("dPeso").blur(); if (window.npClose) window.npClose();
  dSel = ""; dCodSel = ""; $("dCod").value = ""; renderKey(); window.scrollTo({ top: 0, behavior: "smooth" }); }
$("dAdd").onclick = dPesoAdd; $("dPeso").onkeydown = e => { if (e.key === "Enter") dPesoAdd(); };
// editar a quantidade de um item já coletado (toque no "5 kg")
let dEditing = -1;
function dEditOpen(q) {
  const x = Number(q.dataset.edit), it = don.itens[x]; if (!it || q.classList.contains("editing")) return;
  if (dEditing >= 0) { dEditing = -1; renderDon(); q = $("dLista").querySelector(`[data-edit="${x}"]`); if (!q) return; }
  dEditing = x; q.classList.add("editing");
  q.innerHTML = `<input class="dedit" type="text" readonly inputmode="none" data-np${it.unidade === "un" ? " data-np-int" : ""} data-np-submit="#dEditOk" data-np-label="Salvar" value="${fq(it.qtd)}" aria-label="Quantidade de ${esc(it.nome)}"> <span>${esc(it.unidade)}</span>`;
  q.querySelector("input").focus({ preventScroll: true });
}
async function dEditSave() {
  const inp = $("dLista").querySelector(".dedit"), it = don.itens[dEditing]; dEditing = -1;
  if (inp && it) {
    const v = Math.round(parseFloat(String(inp.value).replace(",", ".")) * 1000) / 1000;
    if (v > 0 && v !== it.qtd && (await dOddOk(it.nome, it.unidade, v))) { it.qtd = v; store.set(DK, don); toast("Quantidade corrigida."); }
  }
  if (window.npClose) window.npClose(); renderDon();
}
$("dEditOk").onclick = dEditSave;
document.addEventListener("pointerdown", e => { if (dEditing >= 0 && !e.target.closest(".dq, #np")) { dEditing = -1; renderDon(); } }, true);
$("dLista").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-edit]")) { e.preventDefault(); dEditOpen(e.target); } });
$("dLista").onclick = e => { const q = e.target.closest("[data-edit]"); if (q) return dEditOpen(q); const b = e.target.closest("[data-drop]"); if (!b) return; const x = Number(b.dataset.drop), it = don.itens.splice(x, 1)[0];
  store.set(DK, don); renderDon();
  toast(`${it.nome} removido.`, "Desfazer", () => { if (!don.itens.some(z => z.key === it.key)) { don.itens.splice(Math.min(x, don.itens.length), 0, it); store.set(DK, don); renderDon(); toast(`${it.nome} voltou para a lista.`); } else toast("Esse produto já foi lançado de novo."); }); };
$("dLimpar").onclick = () => { if (don.itens.length && confirm("Apagar toda a lista da doação atual?")) { const antes = don; don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon();
  toast("Lista da doação apagada.", "Desfazer", () => { if (!don.itens.length) { don = antes; store.set(DK, don); renderDon(); toast("Lista restaurada."); } else toast("Já existem itens novos na lista; não dá mais para restaurar."); }); } };
// romaneio
function romTop(d) {    // top 3 dos 30 dias até a data desta doação (inclui ela mesma); por peso (kg), senão por quantidade
  const hd = store.get("validamais-doculto", {}), fim = d.data, ini = new Date(new Date(fim + "T12:00:00").getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const kid = r => r._id || (typeof r.em === "number" ? String(r.em) : "");
  let recs = (db ? topDb : store.get(HK, [])).filter(r => r && r.data >= ini && r.data <= fim && !hd[kid(r)]);
  if (!recs.some(r => (d._id && r._id === d._id) || (d.em && r.em === d.em) || r === d)) recs = recs.concat([d]);   // a doação que está sendo enviada sempre conta
  const m = new Map(); recs.forEach(r => (r.itens || []).forEach(i => { const k = norm(String(i.nome).replace(/\s+(kg|un)$/i, "")) + "|" + i.unidade, o = m.get(k) || { nome: String(i.nome).replace(/\s+(kg|un)$/i, ""), unidade: i.unidade, qtd: 0 }; o.qtd += Number(i.qtd) || 0; m.set(k, o); }));
  const all = [...m.values()].filter(o => o.qtd > 0), kg = all.filter(o => o.unidade === "kg"), base = kg.length ? kg : all;
  return base.sort((a, b) => b.qtd - a.qtd).slice(0, 3).map((o, x) => ({ pos: x + 1, nome: o.nome, q: `${fq(o.qtd)} ${o.unidade}` }));
}
function romText(d) {   // texto para o WhatsApp + link da tela de conferência (toque risca o item)
  return ["DOAÇÃO FLV", `Data: ${dataBR(d.data)}`, `Loja: ${LOJA}`, "------------------------",
    ...d.itens.map(i => `[ ] ${i.cod || "-"} | ${i.nome} | ${fq(i.qtd)} ${i.unidade}`), "------------------------",
    `TOTAL: ${totTxt(d.totalKg, d.totalUn, d.itens.length)}`, "",
    "🏆 TOP 3 MAIS DOADOS · 30 DIAS", ...romTop(d).map(t => `${t.pos}º ${t.nome} — ${t.q}`), "",
    "👉 Toque no link para conferir e riscar os itens:", confUrl(d)].join("\n");
}
function romPdf(d) {    // PDF com coluna CONFERIDO (caixinhas vazias para marcar)
  const pdf = new V.jsPDF(); pdf.setFontSize(18); pdf.setFont("helvetica", "bold"); pdf.text("DOAÇÃO FLV", 14, 16);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`Data: ${dataBR(d.data)}   Loja: ${LOJA}`, 14, 23);
  pdf.setTextColor(22, 101, 52); pdf.textWithLink("Toque aqui para conferir e riscar os itens no celular", 14, 29, { url: confUrl(d) }); pdf.setTextColor(0);
  V.autoTable(pdf, { startY: 34, styles: { fontSize: 10, cellPadding: 2.5 }, headStyles: { fillColor: [22, 101, 52] }, footStyles: { fillColor: [226, 238, 229], textColor: [20, 83, 45] }, columnStyles: { 0: { cellWidth: 26 } },
    head: [["CONFERIDO", "CÓDIGO", "NOME", "QUANTIDADES"]], body: d.itens.map(i => ["", i.cod || "-", i.nome, `${fq(i.qtd)} ${i.unidade}`]),
    foot: [["", "TOTAL", totTxt(d.totalKg, d.totalUn, 0).replace(/ · 0 itens$/, ""), `${d.itens.length} itens`]],
    didDrawCell: h => { if (h.section === "body" && h.column.index === 0) { const c = h.cell; pdf.setDrawColor(60); pdf.setLineWidth(.3); pdf.rect(c.x + 9, c.y + c.height / 2 - 2, 4, 4); } } });
  let y = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : 40) + 10; const top = romTop(d);
  if (top.length) { if (y > 262) { pdf.addPage(); y = 20; } pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); pdf.text("TOP 3 MAIS DOADOS · ÚLTIMOS 30 DIAS", 14, y); pdf.setTextColor(0); pdf.setFontSize(11);
    top.forEach((t, x) => { pdf.setFont("helvetica", "bold"); pdf.text(`${t.pos}º`, 14, y + 7 + x * 6.5); pdf.setFont("helvetica", "normal"); pdf.text(`${t.nome} — ${t.q}`, 23, y + 7 + x * 6.5); }); }
  return pdf.output("blob");
}
const byName = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }) || (a.unidade || "").localeCompare(b.unidade || "");
function showRomaneio(d) {
  if (d && d.itens) d.itens.sort(byName);   // romaneio sempre em ordem alfabética
  curRom = d; romEdit = null; $("romBar").classList.remove("hidden"); $("donaEntrada").classList.add("hidden"); $("donaRomaneio").classList.remove("hidden");
  $("romHead").innerHTML = `<h3 class="romtitle">DOAÇÃO FLV</h3><p class="note">Data: ${dataBR(d.data)} · Loja: ${esc(LOJA)}${d.editada ? " · editada" : ""}</p>`;
  $("romBody").innerHTML = `<div class="rwrap"><table class="rom"><thead><tr><th>CÓDIGO</th><th>NOME</th><th>QUANTIDADES</th></tr></thead><tbody>` +
    d.itens.map(i => `<tr><td>${esc(i.cod || "—")}</td><td>${esc(i.nome)}</td><td>${fq(i.qtd)} ${esc(i.unidade)}</td></tr>`).join("") +
    `</tbody></table></div><p class="romtotal">TOTAL: ${totTxt(d.totalKg, d.totalUn, d.itens.length)}</p>` +
    (romTop(d).length ? `<div class="romtop"><b>🏆 TOP 3 MAIS DOADOS · 30 DIAS</b>${romTop(d).map(t => `<div>${t.pos}º ${esc(t.nome)} — <b>${esc(t.q)}</b></div>`).join("")}</div>` : "");
}
$("rZap").onclick = async () => { const t = romText(curRom);
  if (navigator.share) { try { await navigator.share({ title: "Romaneio de doação", text: t }); markSent(curRom, true); } catch (e) { if (e.name !== "AbortError") toast("Não foi possível compartilhar."); } }
  else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank"); };
$("rPdf").onclick = async () => { try { const blob = romPdf(curRom), file = new File([blob], `romaneio-doacao-${curRom.data}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Romaneio de doação", files: [file] }); else download(blob, file.name);
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível gerar o PDF."); } } };
$("rConf").onclick = () => { location.hash = confUrl(curRom).split("#")[1]; location.reload(); };
$("rNova").onclick = () => { $("donaRomaneio").classList.add("hidden"); $("donaEntrada").classList.remove("hidden"); };
// ----- editar doação já finalizada: corrigir quantidades, remover e acrescentar itens -----
let romEdit = null; const EDK = "validamais-dedit";
const withEdits = x => { const o = x && x._id && store.get(EDK, {})[x._id]; return o ? { ...x, ...o } : x; };
const parseQ = (v, u) => { let q = Number(String(v).replace(",", ".")); if (!(q > 0)) return 0; q = Math.round(q * 1000) / 1000; return u === "un" ? Math.round(q) : q; };
function romEditPaint() {
  const names = [...new Set(products.map(p => p.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("romBody").innerHTML = `<p class="note">Editando a doação de ${dataBR(curRom.data)}. Corrija as quantidades, remova ou acrescente itens.</p><div class="redit">` +
    romEdit.map((i, x) => `<div class="rerow"><div class="ren"><b>${esc(i.nome)}</b>${i.cod ? `<small>${esc(i.cod)}</small>` : ""}</div><input class="req" data-rq="${x}" inputmode="${i.unidade === "un" ? "numeric" : "decimal"}" value="${fq(i.qtd)}" aria-label="Quantidade de ${esc(i.nome)}"><span class="reu">${esc(i.unidade)}</span><button class="cdel" data-rd="${x}" aria-label="Remover ${esc(i.nome)}">✕</button></div>`).join("") +
    `</div><div class="readd"><b>Acrescentar item</b><input id="reNome" list="reList" placeholder="Produto" autocomplete="off"><datalist id="reList">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>` +
    `<div class="rerow2"><select id="reUn"><option value="kg">kg</option><option value="un">un</option></select><input id="reQtd" inputmode="decimal" placeholder="Quantidade"><button type="button" class="primary" id="reAdd">Adicionar</button></div></div>` +
    `<div class="toolbar" style="margin-top:12px"><button class="secondary big" id="reCancel">Cancelar</button><button class="primary big" id="reSave">Salvar alterações</button></div>`;
}
$("rEdit").onclick = () => { if (!curRom) return; if (!hid(curRom) && !(db && curRom._id)) return toast("Aguarde o salvamento da doação e tente de novo."); romEdit = curRom.itens.map(i => ({ ...i })); $("romBar").classList.add("hidden"); romEditPaint(); };
function romEditEnd() { romEdit = null; $("romBar").classList.remove("hidden"); showRomaneio(curRom); }
$("romBody").addEventListener("input", e => { const t = e.target;
  if (romEdit && t.dataset.rq !== undefined) { const i = romEdit[Number(t.dataset.rq)]; if (i) i.qtd = parseQ(t.value, i.unidade); }
  if (t.id === "reNome") { const p = products.find(x => norm(x.name || "") === norm(t.value)); if (p) $("reUn").value = unitOf(p.name); } });
$("romBody").addEventListener("click", async e => { if (!romEdit) return; const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.rd !== undefined) { romEdit.splice(Number(b.dataset.rd), 1); return romEditPaint(); }
  if (b.id === "reCancel") return romEditEnd();
  if (b.id === "reAdd") { const nome = $("reNome").value.trim(), u = $("reUn").value, q = parseQ($("reQtd").value, u);
    if (!nome) return toast("Digite o produto."); if (!(q > 0)) return toast("Digite a quantidade.");
    let pr = products.find(x => norm(x.name || "") === norm(nome));
    if (!pr && /^[0-9A-Za-z]{3,14}$/.test(nome) && /\d/.test(nome)) {   // digitou um código: acha o produto pelo EAN, código de balança ou de doação
      const c = nome.toUpperCase(), sc = isScale(nome) ? Number(parseScale(nome).item) : null;
      pr = products.find(x => x.barcode === nome || String(x.codigo_doacao || "").toUpperCase() === c || String(x.codigo_balanca || "") === nome || (sc !== null && x.codigo_balanca && Number(x.codigo_balanca) === sc));
      if (!pr) return toast("Código " + nome + " não está cadastrado. Digite o nome do produto.");
      if (u === "kg" && unitOf(pr.name) === "un") $("reUn").value = "un"; }
    const u2 = $("reUn").value, q2 = parseQ($("reQtd").value, u2); if (!(q2 > 0)) return toast("Digite a quantidade.");
    const nm = (pr ? pr.name : nome).slice(0, 60), ex = romEdit.find(i => norm(i.nome) === norm(nm) && i.unidade === u2);
    if (ex) { ex.qtd = Math.round((ex.qtd + q2) * 1000) / 1000; ex.lanc = (ex.lanc || 1) + 1; }
    else romEdit.push({ nome: nm, unidade: u2, qtd: q2, lanc: 1, cod: (pr && (pr.codigo_doacao || pr.barcode || pr.codigo_balanca)) || "" });
    romEditPaint(); return toast(`${nm} acrescentado.`); }
  if (b.id === "reSave") {
    const itens = romEdit.filter(i => i.qtd > 0);
    if (!itens.length) return toast("A doação ficou sem itens. Para apagar tudo, use a lixeira em Doações anteriores.");
    const tot = u => Math.round(itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0) * 1000) / 1000;
    const campos = { itens: itens.sort(byName).map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" })), totalKg: tot("kg"), totalUn: tot("un"), editada: true };
    try {
      if (db && curRom._id) await V.updateDoc(V.doc(db, "doacoes", curRom._id), campos);
      else { const l = store.get(HK, []), y = l.find(z => String(z.em) === hid(curRom)); if (y) { Object.assign(y, campos); store.set(HK, l); } }
    } catch (err) {   // o Firebase recusou a alteração (regras só permitem criar): guarda a edição neste aparelho
      console.error(err); const m = store.get(EDK, {}); m[curRom._id] = campos; store.set(EDK, m); Object.assign(curRom, campos);
      toast("Salvo só neste aparelho: o Firebase não permite alterar doações na nuvem."); romEditEnd(); renderTop(); return; }
    Object.assign(curRom, campos); toast("Doação atualizada."); romEditEnd(); if (!db) reloadLocalHist(); renderTop(); } });

// ---------- aba Cadastros: cadastrar e editar produtos digitando (EAN até 13 dígitos) ----------
let cadEdit = null;   // chave do produto em edição
const cadKey = p => p.barcode ? "b" + p.barcode : "n" + norm(p.name || "");
function cadGroups() { const m = new Map(); products.forEach(p => { if (!p.name) return; const k = cadKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return [...m.entries()].map(([k, l]) => ({ k, l, p: l[0], name: l[0].name, barcode: l.map(x => x.barcode).find(Boolean) || "", plu: l.map(x => x.codigo_balanca).find(Boolean) || "", don: l.map(x => x.codigo_doacao).find(Boolean) || "" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); }
function cadPaint() {
  const q = norm($("cBusca").value.trim()), all = cadGroups(), g = all.filter(x => !q || norm(x.name).includes(q) || x.barcode.includes(q) || x.plu === q || x.don.toLowerCase() === q);
  $("cCount").textContent = all.length + (q ? " · " + g.length + " achados" : "");
  $("cLista").innerHTML = g.length ? g.map(x => `<div class="cadrow"><div class="ci"><b>${esc(x.name)}</b><small>EAN ${x.barcode ? esc(x.barcode) : "—"} · PLU ${x.plu ? esc(x.plu) : "—"} · Doação ${x.don ? esc(x.don) : "—"}</small></div><button class="secondary" data-ced="${esc(x.k)}">Editar</button><button class="cdel" data-cdel="${esc(x.k)}" aria-label="Excluir ${esc(x.name)}">✕</button></div>`).join("") : '<p class="empty">Nenhum produto encontrado.</p>';
}
function cadReset() { cadEdit = null; ["cNome", "cEan", "cPlu", "cDon"].forEach(i => $(i).value = ""); $("cTitulo").textContent = "Novo cadastro"; $("cSalvar").textContent = "Cadastrar"; $("cCancela").hidden = true; $("cEanN").textContent = "0/13"; }
$("cEan").oninput = () => { const v = $("cEan").value.replace(/\D/g, "").slice(0, 13); $("cEan").value = v; $("cEanN").textContent = v.length + "/13"; };
$("cPlu").oninput = () => { $("cPlu").value = $("cPlu").value.replace(/\D/g, "").slice(0, 6); };
$("cDon").oninput = () => { $("cDon").value = $("cDon").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); };
$("cBusca").oninput = cadPaint; $("cCancela").onclick = cadReset;
$("cSalvar").onclick = () => {
  const name = $("cNome").value.trim().replace(/\s+/g, " "), ean = $("cEan").value.trim(), plu = $("cPlu").value.trim(), don = $("cDon").value.trim().toUpperCase();
  if (!name) { toast("Digite o nome do produto."); return $("cNome").focus(); }
  if (ean && !/^\d{6,13}$/.test(ean)) { toast("O código de barras deve ter de 6 a 13 números."); return $("cEan").focus(); }
  const mine = cadEdit ? products.filter(x => x.name && cadKey(x) === cadEdit) : [];
  const outros = products.filter(x => !mine.includes(x));
  let d;
  if (ean && (d = outros.find(x => x.barcode === ean))) return toast(`Esse código de barras já pertence a «${d.name}».`);
  if (plu && (d = outros.find(x => x.codigo_balanca && Number(x.codigo_balanca) === Number(plu)))) return toast(`Esse código de balança já pertence a «${d.name}».`);
  if (don && (d = outros.find(x => String(x.codigo_doacao || "").toUpperCase() === don))) return toast(`Esse código de doação já pertence a «${d.name}».`);
  if (!ean && !mine.length && outros.some(x => norm(x.name || "") === norm(name) && !x.barcode)) return toast("Já existe um produto com esse nome.");
  const f = { name, barcode: ean, codigo_balanca: plu, codigo_doacao: don }, fail = e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras do Firebase)."); };
  if (mine.length) {
    if (db) { const ts = V.serverTimestamp(); mine.forEach(x => V.updateDoc(V.doc(db, "products", x.id), { ...f, updatedAt: ts }).catch(fail)); }
    else { mine.forEach(x => Object.assign(x, f)); persist(); render(); }
    toast("Cadastro atualizado.");
  } else {
    const rec = { ...f, category: "FLV", expiry: "", quantity: 1, por: myName() };
    if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...rec, createdAt: ts, updatedAt: ts }).catch(fail); }
    else { products.push({ ...rec, id: uid(), updatedAt: Date.now() }); persist(); render(); }
    toast("«" + name + "» cadastrado.");
  }
  cadReset(); setTimeout(cadPaint, db ? 600 : 0);
};
$("cLista").onclick = e => { const b = e.target.closest("[data-ced],[data-cdel]"); if (!b) return;
  if (b.dataset.ced !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.ced); if (!x) return; cadEdit = x.k;
    $("cNome").value = x.name; $("cEan").value = x.barcode; $("cPlu").value = x.plu; $("cDon").value = x.don; $("cEanN").textContent = x.barcode.length + "/13";
    $("cTitulo").textContent = "Editando cadastro"; $("cSalvar").textContent = "Salvar alterações"; $("cCancela").hidden = false; window.scrollTo(0, 0); return; }
  const x = cadGroups().find(y => y.k === b.dataset.cdel); if (!x) return;
  if (!confirm(`Excluir «${x.name}»${x.l.length > 1 ? " e seus " + x.l.length + " lotes" : ""}?`)) return;
  x.l.forEach(p => { if (db) V.deleteDoc(V.doc(db, "products", p.id)).catch(() => toast("Não foi possível excluir.")); });
  if (!db) { products = products.filter(p => !x.l.includes(p)); persist(); render(); }
  toast("Cadastro excluído."); if (cadEdit === x.k) cadReset(); setTimeout(cadPaint, db ? 600 : 0); };
$("navCadastros").addEventListener("click", cadPaint);
// ---------- Cadastros: preencher o código lendo com a câmera ----------
async function cadScan(code) {
  if (navigator.vibrate) navigator.vibrate(100); beep(); await stopScanner(); closeModal();
  const d = String(code).replace(/\D/g, "");
  if (!d) return toast("Esse código não é só de números. Digite-o no campo.");
  if (isScale(d)) { $("cPlu").value = String(Number(parseScale(d).item)).slice(0, 6); toast("Etiqueta de balança: preenchi o código de balança (PLU)."); }
  else if (d.length > 13) return toast("Código com mais de 13 dígitos. Digite manualmente o que for válido.");
  else {
    const ja = products.find(p => p.barcode === d);
    if (ja && !cadEdit) { toast("«" + ja.name + "» já tem esse código. Abri para editar."); $("cBusca").value = ""; cadPaint(); const b = document.querySelector('[data-ced="' + (cadKey(ja)).replace(/"/g, '\\"') + '"]'); if (b) b.click(); return; }
    $("cEan").value = d; $("cEan").dispatchEvent(new Event("input", { bubbles: true })); toast("Código lido: " + d);
  }
  if (!$("cNome").value.trim()) $("cNome").focus();
}
$("cBipar").onclick = () => openScan("cadastro");


// ---------- doação já lançada: itens bipados entram nela, sem criar outra ----------
const romAberta = () => curRom && !romEdit && !$("donaRomaneio").classList.contains("hidden") && document.body.dataset.tab === "Doacao";
function addToRom(nome, unidade, qtd, cod, bar) {
  qtd = Math.round(qtd * 1000) / 1000; if (!(qtd > 0)) return 0; buzz();
  const nm = nome.trim().slice(0, 60), pr = products.find(x => norm(x.name || "") === norm(nm)), itens = curRom.itens.map(i => ({ ...i }));
  let it = itens.find(i => norm(i.nome) === norm(nm) && i.unidade === unidade);
  if (it) { it.qtd = Math.round((it.qtd + qtd) * 1000) / 1000; it.lanc = (it.lanc || 1) + 1; if (!it.cod) it.cod = cod || ""; }
  else { it = { nome: nm, unidade, qtd, lanc: 1, cod: cod || (pr && (pr.codigo_doacao || pr.barcode || pr.codigo_balanca)) || "" }; itens.push(it); }
  const tot = u => Math.round(itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0) * 1000) / 1000;
  const campos = { itens: itens.sort(byName).map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" })), totalKg: tot("kg"), totalUn: tot("un"), editada: true };
  const fim = () => { Object.assign(curRom, campos); showRomaneio(curRom); if (!db) reloadLocalHist(); renderTop(); };
  const local = () => { const m = store.get(EDK, {}); if (curRom._id) { m[curRom._id] = campos; store.set(EDK, m); } };
  if (db && curRom._id) V.updateDoc(V.doc(db, "doacoes", curRom._id), campos).catch(err => { console.error(err); local(); toast("Salvo só neste aparelho: o Firebase não permite alterar doações na nuvem."); });
  else { const l = store.get(HK, []), y = l.find(z => String(z.em) === hid(curRom)); if (y) { Object.assign(y, campos); store.set(HK, l); } }
  fim(); toast(`${nm}: +${fq(qtd)} ${unidade} na doação de ${dataBR(curRom.data)} (total ${fq(it.qtd)} ${unidade})`); return it.qtd;
}
$("rAdd").onclick = () => openScan("doacao");
function finalizeDon() {
  const rec = { data: iso(new Date()), por: myName().slice(0, 40), totalKg: Math.round(sumU("kg") * 1000) / 1000, totalUn: Math.round(sumU("un") * 1000) / 1000,
    itens: don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc, cod: cod || "" })).sort(byName) };
  if (db) V.addDoc(V.collection(db, "doacoes"), { ...rec, em: V.serverTimestamp() }).then(r => { rec._id = r.id; }).catch(e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras). O romaneio foi gerado."); });
  else { const hh = store.get(HK, []), em = Date.now(); rec.em = em; hh.unshift({ ...rec }); store.set(HK, hh.slice(0, 50)); }
  don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon(); showRomaneio(rec); renderTop();
}
$("dFinalizar").onclick = () => { if (!don.itens.length) return toast("A lista está vazia."); finalizeDon(); };
const ENV = "validamais-denv", hid = x => x._id || (x.em && typeof x.em === "number" ? String(x.em) : ""), isSent = x => !!(x.enviada || store.get(ENV, {})[hid(x)]);
const HLIM = 20, reloadLocalHist = () => renderHist(store.get(HK, []).slice(0, HLIM));
function markSent(x, val) { const id = hid(x); if (!id) return; x.enviada = val;
  const m = store.get(ENV, {}); if (val) m[id] = 1; else delete m[id]; store.set(ENV, m);
  if (db && x._id) V.updateDoc(V.doc(db, "doacoes", x._id), { enviada: val }).catch(e => console.error(e));
  else { const l = store.get(HK, []), it = l.find(y => String(y.em) === id); if (it) { it.enviada = val; store.set(HK, l); } } }
const HID = "validamais-doculto";
function renderHist(l) { const hd = store.get(HID, {}); l = l.filter(x => !hd[hid(x)]); histList = l;
  $("dHist").innerHTML = l.length ? l.map((x, i) => { const tot = totTxt(x.totalKg, x.totalUn, x.itens ? x.itens.length : 0), sent = isSent(x);
    return `<div class="hrow"><div class="hi"><b>${dataBR(x.data)}</b>${sent ? ' <span class="hbadge">✓ Enviada</span>' : ""}<br><small class="muted">${tot}</small></div><button class="secondary" data-hist="${i}">Abrir</button><button class="${sent ? "primary" : "secondary"}" data-sent="${i}" aria-label="${sent ? "Desmarcar enviada" : "Marcar como enviada"}">✓</button><button class="cdel" data-del="${i}" aria-label="Excluir doação">🗑</button></div>`; }).join("") : '<p class="muted">Nenhuma doação finalizada.</p>'; }
$("dHist").onclick = e => { const b = e.target.closest("[data-hist],[data-sent],[data-del]"); if (!b) return;
  if (b.dataset.hist !== undefined) return showRomaneio(histList[Number(b.dataset.hist)]);
  const x = histList[Number(b.dataset.sent ?? b.dataset.del)]; if (!x) return;
  if (b.dataset.sent !== undefined) { markSent(x, !isSent(x)); if (!db) reloadLocalHist(); else renderHist(histList); toast(isSent(x) ? "Marcada como enviada." : "Marca de enviada removida."); return; }
  if (!confirm(`Excluir a doação de ${dataBR(x.data)}?`)) return;
  const id = hid(x), hd = store.get(HID, {}); hd[id] = 1; store.set(HID, hd);          // some já neste aparelho, mesmo que a nuvem recuse
  store.set(HK, store.get(HK, []).filter(y => String(y.em) !== id)); renderHist(histList); renderTop();
  if (db && x._id) V.deleteDoc(V.doc(db, "doacoes", x._id)).then(() => toast("Doação excluída.")).catch(err => { console.error(err); toast("Removida só deste aparelho: o Firebase não permite apagar na nuvem (veja as regras)."); });
  else toast("Doação excluída."); };
$("histBox").ontoggle = () => {
  if ($("histBox").open) { if (db) { if (!unsubHist) unsubHist = V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(HLIM)), s => renderHist(s.docs.map(d => withEdits({ ...d.data(), _id: d.id })))); } else reloadLocalHist(); }
  else if (unsubHist) { unsubHist(); unsubHist = null; } };
const go = t => { tab(t); side(false); };
$("navHist").onclick = () => { go("Doacao"); try { if (typeof dView === "function") dView("lista"); } catch (e) {} document.body.classList.add("histOn"); const hb = $("histBox"); hb.open = true; hb.ontoggle && hb.ontoggle(); setTimeout(() => $("histSec").scrollIntoView({ block: "start", behavior: "smooth" }), 120); };
$("histFechar").onclick = () => { $("histBox").open = false; document.body.classList.remove("histOn"); window.scrollTo({ top: 0, behavior: "smooth" }); }; $("navLoja").onclick = () => go("Loja"); $("navDoacao").onclick = () => go("Doacao"); $("navEtiquetas").onclick = () => go("Etiquetas"); $("navInventario").onclick = () => go("Inventario"); $("navCadastros").onclick = () => go("Cadastros"); $("dScan").onclick = () => openScan("doacao");
// ----- top 3 mais doados (últimos 30 dias, compacto) -----
let topDb = [];
// recalcula os balões «Mais doados» (o painel antigo de top 3 foi removido)
function renderTop() { try { dTop6Render(); } catch (e) {} }
if (db) V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(40)), s => { topDb = s.docs.map(d => withEdits({ ...d.data(), _id: d.id })); renderTop(); }, console.error);
renderDon(); renderKey(); renderTop();
tab("Doacao");

// ---------- aba Etiquetas ----------
const EK = "validamais-etiquetas", EUK = "validamais-etq-uni";   // EUK: código original -> código do sistema (só para a lista de etiquetas)
const uniCode = c => (c && store.get(EUK, {})[c]) || c;
const SZ = { P: { w: 63, h: 30, cols: 3, rows: 9, nome: 8, preco: 15, cod: 6, bar: 6 }, M: { w: 95, h: 50, cols: 2, rows: 5, nome: 12, preco: 26, cod: 8, bar: 12 }, G: { w: 190, h: 90, cols: 1, rows: 3, nome: 20, preco: 52, cod: 11, bar: 24 } };
let labels = store.get(EK, []), pend = null, eHits = [];
// itens pesados (FLV/Padaria) usam o código de balança; os demais usam o EAN
const codeText = c => c.code ? `${c.kg ? "Código de balança" : "EAN"}: ${c.code}` : "⚠ Sem código cadastrado para este produto.";
const labelCode = p => (p.codigo_balanca && (["FLV", "Padaria"].includes(p.category) || !p.barcode)) ? { code: String(p.codigo_balanca), kg: true } : { code: p.barcode || "", kg: false };
const eSel = new Set(); let eSelOn = false;   // seleção para apagar várias etiquetas de uma vez
function eSelPaint() {
  [...eSel].forEach(l => { if (!labels.includes(l)) eSel.delete(l); });
  if (!labels.length) eSelOn = false;
  document.body.classList.toggle("esel-on", eSelOn); $("eLista").classList.toggle("selmode", eSelOn);
  $("eSelBar").classList.toggle("hidden", !eSelOn); $("eSelBtn").classList.toggle("hidden", !labels.length || eSelOn);
  $("eSelN").textContent = eSel.size ? eSel.size + (eSel.size > 1 ? " marcadas" : " marcada") : "Marque as etiquetas";
  $("eSelDel").disabled = !eSel.size; $("eSelDel").textContent = "🗑 Apagar" + (eSel.size ? " (" + eSel.size + ")" : "");
  $("eSelAll").textContent = eSel.size === labels.length && labels.length ? "Limpar" : "Todas";
}
function eSelSet(on) { eSelOn = !!on; if (!on) eSel.clear(); renderLabels(); }
function labelDropMany(its) {
  const idx = its.map(l => ({ l, x: labels.indexOf(l) })).filter(o => o.x >= 0).sort((a, b) => a.x - b.x); if (!idx.length) return;
  idx.slice().reverse().forEach(o => labels.splice(o.x, 1)); store.set(EK, labels); eSelOn = false; eSel.clear(); renderLabels();
  toast(idx.length > 1 ? idx.length + " etiquetas removidas." : "Etiqueta removida.", "Desfazer", () => { idx.forEach(o => labels.splice(Math.min(o.x, labels.length), 0, o.l)); store.set(EK, labels); renderLabels(); });
}
function renderLabels() {
  $("eLimpa").classList.toggle("hidden", labels.length <= 5); { const n = labels.filter(l => l.ok).length; $("eMarc").textContent = labels.length ? `✓ ${n} de ${labels.length} já colocadas para impressão` : ""; } $("eSumP").textContent = labels.length; $("eSumQ").textContent = labels.reduce((s, l) => s + (Number(l.qtd) || 0), 0);
  const ord = { P: 0, M: 1, G: 2 };   // lista única: primeiro os P, depois M, depois G (mantém a ordem de inclusão dentro de cada tamanho)
  $("eLista").innerHTML = labels.length ? labels.map((l, i) => ({ l, i })).sort((a, b) => (ord[a.l.tam || "M"] - ord[b.l.tam || "M"]) || (a.i - b.i)).map(({ l, i }) => `<div class="crwrap"><div class="crw${l.ok ? " done" : ""}${eSel.has(l) ? " esel" : ""}" data-li="${i}"><span class="selc" aria-hidden="true"></span><button type="button" class="lchk" data-lchk="${i}" role="checkbox" aria-checked="${l.ok ? "true" : "false"}" aria-label="Já colocada para impressão: ${esc(l.nome)}">${l.ok ? "✓" : ""}</button><div class="crl"><div class="ccode${(l.code || "").length > 14 ? " long" : ""}">${l.code ? esc(l.code) : "SEM CÓDIGO"}${l.orig && l.orig !== l.code ? ` <span class="unib">unificado</span>` : ""}</div><div class="cname">${esc(l.nome)}</div></div><div class="crr"><div class="cqty">${l.qtd}${(l.tam || "M") !== "M" ? `<span class="tbadge">${l.tam}</span>` : ""}</div></div></div></div>`).join("") : '<p class="empty">Nenhum item na lista.</p>';
  eSelPaint();
}
// efeito: o item novo é escrito à mão, devagar — uma mão (✍️) vai riscando o código e depois o nome, com tinta vermelha que seca
function etqEscrever(row) {
  try {
    if (!row || !row.isConnected || !row.animate || document.hidden || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const code = row.querySelector(".ccode"), nome = row.querySelector(".cname"); if (!code || !nome) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const inkify = (el, t0, step, gd) => {
      const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim()); if (!tn) return { list: [], end: t0 };
      const frag = document.createDocumentFragment(), list = []; let t = t0;
      tn.nodeValue.normalize("NFC").trim().split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); t += step * 0.6; return; }
        const ws = document.createElement("span"); if (w.length <= 16) ws.style.whiteSpace = "nowrap";
        for (const ch of w) {
          const sp = document.createElement("span"); sp.className = "ink"; sp.textContent = ch;
          sp.style.setProperty("--d", Math.round(t) + "ms"); sp.style.setProperty("--gd", gd + "ms");
          sp.style.setProperty("--r", rnd(-7, 7).toFixed(1) + "deg"); sp.style.setProperty("--y", rnd(-2, 2).toFixed(1) + "px");
          ws.appendChild(sp); list.push({ s: sp, t, gd }); t += step * rnd(0.8, 1.25);
        }
        frag.appendChild(ws);
      });
      el.replaceChild(frag, tn); return { list, end: t };
    };
    const nLen = (nome.textContent || "").length;
    const c = inkify(code, 250, 170, 420);                                   // código: bem devagar
    const n = inkify(nome, c.end + 450, Math.min(60, 1500 / Math.max(1, nLen)), 300);   // nome: um pouco mais rápido
    const all = [...c.list, ...n.list]; if (!all.length) return;
    const T = Math.max(c.end, n.end) + 320;
    const P = e => ({ x: e.s.offsetLeft + e.s.offsetWidth * 0.5, y: e.s.offsetTop + e.s.offsetHeight * 0.88 });   // offset*: ignora o "pulo" (scale) da linha
    const fr = (off, x, y, rot, op) => ({ offset: Math.min(1, Math.max(0, off)), opacity: op, transform: "translate(" + (x - 4).toFixed(1) + "px," + (y - 21).toFixed(1) + "px) rotate(" + rot.toFixed(1) + "deg)" });
    const kf = [], p0 = P(all[0]); kf.push(fr(0, p0.x - 20, p0.y - 18, -12, 0));
    all.forEach(e => { const q = P(e); kf.push(fr((e.t + e.gd * 0.5) / T, q.x + rnd(-1, 1), q.y + rnd(-2, 2), rnd(-5, 3), 1)); });
    const pl = P(all[all.length - 1]); kf.push(fr(1, pl.x + 26, pl.y - 30, 14, 0));
    const hand = document.createElement("span"); hand.className = "etq-hand"; hand.setAttribute("aria-hidden", "true"); hand.textContent = "✍️"; row.appendChild(hand);
    const a = hand.animate(kf, { duration: T, easing: "linear", fill: "both" }); a.onfinish = a.oncancel = () => hand.remove();
    row.animate([{ boxShadow: "inset 0 0 0 0 rgba(176,8,20,0)" }, { boxShadow: "inset 0 0 30px 2px rgba(176,8,20,.34)", offset: 0.15 }, { boxShadow: "inset 0 0 30px 2px rgba(176,8,20,.3)", offset: 0.85 }, { boxShadow: "inset 0 0 0 0 rgba(176,8,20,0)" }], { duration: T + 900, delay: 400, easing: "ease-in-out" });
    const rc = row.getBoundingClientRect(); if (rc.top < 70 || rc.bottom > innerHeight - 90) row.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (_) {}
}
function labelPick(p, ean) {   // ean: código de barras que foi bipado (item por unidade) — a etiqueta fica com o EAN, não com o código de balança
  buzz();
  const c = ean ? { code: ean, kg: false } : labelCode(p), key = pkey(p), ex = labels.find(l => !l.dup && l.key === key && (l.orig || l.code) === c.code);
  if (ex) { ex.qtd = (Number(ex.qtd) || 1) + 1; ex.ok = false; } else labels.push({ nome: p.name, code: uniCode(c.code), orig: c.code, kg: c.kg, tam: tamOf(p), key, qtd: 1 });
  store.set(EK, labels); pend = null; $("eBusca").value = ""; $("eRes").innerHTML = ""; renderLabels();
  { const tgt = ex || labels[labels.length - 1], q = () => document.querySelector('#eLista .crw[data-li="' + labels.indexOf(tgt) + '"]'); vmOk(q); if (!ex) setTimeout(() => etqEscrever(q()), 120); }
  toast((c.code ? c.code + " · " : "") + p.name + " adicionado.");
}
async function labelScan(code) {
  buzz(); beep(); await stopScanner(); closeModal();
  const scale = isScale(code), item = scale ? Number(parseScale(code).item) : 0;
  let p = scale ? products.find(x => x.codigo_balanca && Number(x.codigo_balanca) === item) : products.find(x => x.barcode === code);
  if (!p) { const r = await askNewProduct(code, scale, scale ? String(item) : ""); if (!r) return;
    p = registerProduct({ name: r.nome, barcode: scale ? "" : code, codigo_balanca: scale ? String(item) : "" }); }
  labelPick(p, scale ? "" : code);
}
$("eScan").onclick = () => openScan("etiqueta");

// ---------- histórico de etiquetas já impressas (3 dias) ----------
const EHK = "validamais-etqhist";
const ehLoad = () => (store.get(EHK, []) || []).filter(e => Date.now() - (e.t || 0) < HIST_MS);
function ehAdd(lista) {
  if (!lista.length) return;
  const log = ehLoad(); log.unshift({ t: Date.now(), por: myName(), n: lista.length, q: lista.reduce((s, l) => s + (Number(l.qtd) || 0), 0), it: lista.slice(0, 300).map(l => ({ n: l.nome, c: l.code || "", tam: l.tam || "M", q: Number(l.qtd) || 0, ok: !!l.ok })) });
  store.set(EHK, log.slice(0, 60));
}
function ehDraw() {
  const log = ehLoad(); store.set(EHK, log);
  $("ehList").innerHTML = log.length ? log.map(e => `<div class="phe add"><b>🏷️ ${e.n} produto(s) · ${e.q} etiqueta(s)</b><small class="muted">${phWhen(e.t)} · ${esc(e.por || "")}</small>${e.it.slice(0, 40).map(x => `<div>• ${esc(x.n)} <small class="muted">${x.q}× ${esc(x.tam)}${x.c ? " · " + esc(x.c) : ""}${x.ok ? " · ✓ colocada" : ""}</small></div>`).join("")}${e.n > 40 ? `<div class="muted">… e mais ${e.n - 40}</div>` : ""}</div>`).join("") : '<p class="muted">Nada guardado. Ao usar «Remover todos (já imprimi)» na aba Etiquetas, a lista aparece aqui por 3 dias.</p>';
}
window.ehOpen = () => { ehDraw(); $("ehModal").classList.remove("hidden"); };
$("ehClose").onclick = () => $("ehModal").classList.add("hidden");
store.set(EHK, ehLoad());
$("eLimpa").onclick = async () => { if (!labels.length) return;
  const ok = await askConfirm({ icon: "🗑", title: "Remover todas as etiquetas?", text: labels.length + " produtos · " + labels.reduce((t, l) => t + (Number(l.qtd) || 0), 0) + " etiquetas", sub: (labels.filter(l => l.ok).length ? labels.filter(l => l.ok).length + " já marcadas. " : "") + "Use depois de imprimir. A lista ficará vazia.", ok: "Remover todos", cancel: "Cancelar" });
  if (!ok) return; ehAdd(labels); labels = []; store.set(EK, labels); pend = null; renderLabels(); toast("Lista de etiquetas limpa e guardada no histórico (3 dias)."); };
$("eBusca").oninput = () => { const q = norm($("eBusca").value); if (q.length < 2) { $("eRes").innerHTML = ""; return; }
  const seen = new Set();
  eHits = products.filter(p => norm(p.name || "").includes(q) || (p.barcode || "").includes(q)).filter(p => { const k = p.barcode || p.codigo_balanca || norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  $("eRes").innerHTML = eHits.length ? eHits.map((p, i) => `<div class="pick" data-pick="${i}"><b>${esc(p.name)}</b> <small class="muted">${esc(p.category || "")}</small></div>`).join("") : '<p class="muted">Nada encontrado.</p>'; };
$("eRes").onclick = e => { const b = e.target.closest("[data-pick]"); if (b) labelPick(eHits[Number(b.dataset.pick)]); };
$("eTam").onclick = e => { const b = e.target.closest("button"); if (!b || !pend) return; pend.tam = b.dataset.t; { const m = store.get(TK, {}); m[pkey(pend.src)] = pend.tam; store.set(TK, m); } document.querySelectorAll("#eTam button").forEach(x => x.classList.toggle("sel", x === b)); };
$("eMenos").onclick = () => { $("eQtd").value = Math.max(1, (Number($("eQtd").value) || 1) - 1); }; $("eMais").onclick = () => { $("eQtd").value = (Number($("eQtd").value) || 0) + 1; };
$("eCodSave").onclick = () => { if (!pend) return; const v = saveCode(pend.src, "codigo_balanca", $("eCodBal").value); if (v === null) return;
  pend.src = { ...pend.src, codigo_balanca: v }; const c = labelCode(pend.src); pend.code = c.code; pend.kg = c.kg; $("eCod").textContent = codeText(c); $("eCodBal").value = v; };
$("eCancela").onclick = () => { pend = null; $("ePend").classList.add("hidden"); };
$("eAdd").onclick = () => {
  if (!pend) return; if (!pend.tam) return toast("Escolha o tamanho: P, M ou G."); buzz();
  labels.push({ nome: pend.nome, code: uniCode(pend.code), orig: pend.code, kg: pend.kg, tam: pend.tam || "M", key: pkey(pend.src), qtd: Math.max(1, Math.round(Number($("eQtd").value) || 1)) }); store.set(EK, labels);
  pend = null; $("ePend").classList.add("hidden"); $("eBusca").value = ""; $("eRes").innerHTML = ""; renderLabels(); { const tgt = labels[labels.length - 1], q = () => document.querySelector('#eLista .crw[data-li="' + labels.indexOf(tgt) + '"]'); vmOk(q); setTimeout(() => etqEscrever(q()), 120); } toast("Item adicionado à lista.");
};
function labelDup(i) { const l = labels[i]; if (!l) return; const ord = ["P", "M", "G"], atual = l.tam || "M", novo = ord[(ord.indexOf(atual) + 1) % 3];
  labels.splice(i + 1, 0, { ...l, tam: novo, qtd: 1, ok: false, dup: true }); store.set(EK, labels); renderLabels(); lmOpen(i + 1); toast("Duplicado: escolha o tamanho e a quantidade."); }
$("eLista").onclick = e => {
  if (eSelOn) { const r = e.target.closest(".crw"); if (r) { const l = labels[Number(r.dataset.li)]; if (l) { eSel.has(l) ? eSel.delete(l) : eSel.add(l); try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {} renderLabels(); } } return; }
  const dp = e.target.closest("[data-ldup]"); if (dp) { labelDup(Number(dp.dataset.ldup)); return; }
  const k = e.target.closest("[data-lchk]"); if (k) { const l = labels[Number(k.dataset.lchk)]; if (l) { l.ok = !l.ok; store.set(EK, labels); renderLabels(); } return; }
  const rw = e.target.closest(".crw"); if (rw) lmOpen(Number(rw.dataset.li));   // toque na linha abre a folha: tamanho, quantidade, duplicar e apagar
};
$("eSelBtn").onclick = () => eSelSet(true);
$("eSelCancel").onclick = () => eSelSet(false);
$("eSelAll").onclick = () => { if (eSel.size === labels.length) eSel.clear(); else labels.forEach(l => eSel.add(l)); renderLabels(); };
$("eSelDel").onclick = () => { if (eSel.size) labelDropMany([...eSel]); };
new MutationObserver(() => { if (eSelOn && document.body.dataset.tab !== "Etiquetas") eSelSet(false); }).observe(document.body, { attributes: true, attributeFilter: ["data-tab"] });
$("lmDel").onclick = () => { const l = labels[lmI]; $("lModal").classList.add("hidden"); if (l) labelDropMany([l]); };
function labelDrop(x) { const it = labels.splice(x, 1)[0]; if (!it) return; store.set(EK, labels); renderLabels();
  toast("Etiqueta removida.", "Desfazer", () => { labels.splice(Math.min(x, labels.length), 0, it); store.set(EK, labels); renderLabels(); }); }
renderLabels();

// segurar o CÓDIGO do item abre "unificar com o código do sistema" (vale só para a lista de etiquetas)
function labelUnify(i) {
  const l = labels[i]; if (!l) return; if (navigator.vibrate) navigator.vibrate(40);
  const orig = l.orig || l.code || "", bg = document.createElement("div"); bg.className = "askbg";
  bg.innerHTML = `<div class="ask" style="text-align:left;max-height:88dvh;overflow:auto"><div class="ai" style="text-align:center">🔗</div><h3 style="text-align:center">Unificar código</h3><p style="text-align:center"><b>${esc(l.nome)}</b></p><p style="text-align:center">Código bipado: <b>${esc(orig || "—")}</b></p>` +
    `<label style="display:block;margin-top:8px;font-weight:700">Código do sistema da loja</label><input id="unCod" maxlength="25" autocomplete="off" value="${esc(l.code || "")}" style="width:100%;font-size:22px;font-weight:700;text-align:center">` +
    `<label style="display:block;margin-top:12px;font-weight:700">Ou buscar o produto no sistema</label><input id="unBusca" type="search" autocomplete="off" placeholder="Nome ou código" style="width:100%"><div id="unRes" class="lkres"></div>` +
    `<div class="arow" style="flex-wrap:wrap"><button type="button" data-a="0">Cancelar</button>${orig && l.code !== orig ? '<button type="button" data-a="r">Voltar ao original</button>' : ""}<button type="button" class="ok" data-a="1">Unificar</button></div></div>`;
  let hits = []; const cod = () => bg.querySelector("#unCod");
  bg.onclick = e => { const k = e.target.closest("[data-k]"); if (k) { const c = labelCode(hits[Number(k.dataset.k)]).code; if (c) cod().value = c; return; }
    const b = e.target.closest("[data-a]"); if (!b) { if (e.target === bg) bg.remove(); return; } if (b.dataset.a === "0") return bg.remove();
    const m = store.get(EUK, {}), v = b.dataset.a === "r" ? "" : cod().value.replace(/\s+/g, "").toUpperCase();
    if (v && !/^[A-Z0-9]{1,25}$/.test(v)) return toast("Use só letras e números (até 25).");
    if (v && v !== orig) m[orig] = v; else delete m[orig]; store.set(EUK, m);
    labels.forEach(x => { if ((x.orig || x.code) === orig) { x.orig = orig; x.code = m[orig] || orig; } }); store.set(EK, labels); renderLabels(); bg.remove();
    toast(m[orig] ? `Unificado: ${orig} → ${m[orig]}` : "Código original restaurado."); };
  const bu = bg.querySelector("#unBusca"); bu.oninput = () => { const q = norm(bu.value), seen = new Set(); if (q.length < 2) { bg.querySelector("#unRes").innerHTML = ""; hits = []; return; }
    hits = products.filter(p => norm(p.name || "").includes(q) || (p.barcode || "").includes(q) || String(p.codigo_balanca || "").includes(q)).filter(p => { const k = pkey(p); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    bg.querySelector("#unRes").innerHTML = hits.length ? hits.map((p, n) => `<div class="pick" data-k="${n}"><b>${esc(p.name)}</b> <small class="muted">${esc(labelCode(p).code || "sem código")}</small></div>`).join("") : '<p class="muted">Nada encontrado.</p>'; };
  document.body.appendChild(bg); setTimeout(() => { const c = cod(); c.focus(); c.select(); }, 80);
}
// segurar o item da lista abre tamanho (P/M/G) e quantidade
let lmI = -1;
function lmDraw() { const l = labels[lmI]; if (!l) return; document.querySelectorAll("#lmTam button").forEach(b => b.classList.toggle("sel", b.dataset.t === (l.tam || "M"))); $("lmQtd").value = l.qtd; }
function lmOpen(i) { const l = labels[i]; if (!l) return; lmI = i; $("lmNome").textContent = l.nome; $("lmCod").textContent = l.code ? "Código: " + l.code : "Sem código"; lmDraw(); $("lModal").classList.remove("hidden"); if (navigator.vibrate) navigator.vibrate(40); }
const lmSave = () => { store.set(EK, labels); renderLabels(); };
$("lmTam").onclick = e => { const b = e.target.closest("button"); const l = labels[lmI]; if (!b || !l) return; l.tam = b.dataset.t; if (l.key && !l.dup) { const m = store.get(TK, {}); m[l.key] = l.tam; store.set(TK, m); } lmSave(); lmDraw(); };
const lmQ = n => { const l = labels[lmI]; if (!l) return; l.qtd = Math.max(1, Math.round(n) || 1); lmSave(); lmDraw(); };
$("lmMenos").onclick = () => lmQ((labels[lmI] || {}).qtd - 1); $("lmMais").onclick = () => lmQ((labels[lmI] || {}).qtd + 1); $("lmQtd").onchange = () => lmQ(Number($("lmQtd").value));
$("lmOk").onclick = $("lmClose").onclick = () => $("lModal").classList.add("hidden");
$("lmDup").onclick = () => { const i = lmI; $("lModal").classList.add("hidden"); labelDup(i); };
$("lmUni").onclick = () => { const i = lmI; $("lModal").classList.add("hidden"); labelUnify(i); };
// ---------- Etiquetas compartilhadas: todos os aparelhos veem a mesma lista (coleção "sh_etiquetas" no Firestore) ----------
(function () {
  if (typeof db === "undefined" || !db || !V.setDoc || !V.deleteDoc || !V.onSnapshot || !V.doc || !V.collection) return;   // sem nuvem: segue só local
  const COL = "sh_etiquetas", FLAG = "validamais-etq-cloud", baseSet = store.set.bind(store);
  const last = new Map();                 // id -> conteúdo que a nuvem já tem (para só enviar o que mudou)
  let ready = false, warned = false;
  const newId = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const body = l => { const o = JSON.parse(JSON.stringify(l)); delete o.id; return o; };
  const canon = o => JSON.stringify(Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {}));
  const fail = e => { console.error(e); if (!warned) { warned = true; toast("Etiquetas: não consegui sincronizar com a nuvem (confira as regras da coleção «sh_etiquetas»). Ficou só neste aparelho."); } };
  function ensure() {                     // todo item precisa de id próprio e de posição (ord) para ficar na mesma ordem em todos os aparelhos
    labels.forEach(l => { if (!l.id) l.id = newId(); });
    for (let i = 0; i < labels.length; i++) {
      if (typeof labels[i].ord === "number" && isFinite(labels[i].ord)) continue;
      let prev = 0, next = null;
      for (let j = i - 1; j >= 0; j--) if (typeof labels[j].ord === "number") { prev = labels[j].ord; break; }
      for (let j = i + 1; j < labels.length; j++) if (typeof labels[j].ord === "number") { next = labels[j].ord; break; }
      labels[i].ord = next === null ? prev + 1 : (prev + next) / 2;
    }
  }
  function push() {
    ensure(); if (!ready) return;
    const ids = new Set();
    labels.forEach(l => {
      ids.add(l.id); const j = canon(body(l));
      if (last.get(l.id) === j) return;
      last.set(l.id, j); V.setDoc(V.doc(db, COL, l.id), JSON.parse(j)).catch(fail);
    });
    [...last.keys()].forEach(id => { if (!ids.has(id)) { last.delete(id); V.deleteDoc(V.doc(db, COL, id)).catch(fail); } });
  }
  store.set = (k, v) => { baseSet(k, v); if (k === EK) push(); };
  function adopt(snap) {
    if (!ready && snap.metadata.fromCache && !snap.docs.length) return;      // ainda sem resposta do servidor
    const remote = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (!ready) {
      ready = true;
      if (!remote.length && labels.length && !localStorage.getItem(FLAG)) {  // nuvem vazia e este aparelho tem lista: sobe a dele
        baseSet(FLAG, 1); push(); return;
      }
      baseSet(FLAG, 1);
      if (labels.length && remote.length) baseSet(EK + "-bkp", labels);       // guarda cópia da lista antiga deste aparelho
    }
    remote.sort((a, b) => ((a.ord || 0) - (b.ord || 0)) || (a.id < b.id ? -1 : 1));
    last.clear(); remote.forEach(r => last.set(r.id, canon(body(r))));
    const sig = a => a.map(x => x.id + canon(body(x))).join("|");
    if (sig(remote) === sig(labels)) return;                                  // nada mudou (eco da nossa própria escrita)
    const modal = $("lModal"), aberto = modal && !modal.classList.contains("hidden"), cur = aberto && labels[lmI] ? labels[lmI].id : null;
    labels = remote; baseSet(EK, labels);
    if (aberto) { const ni = cur ? labels.findIndex(l => l.id === cur) : -1; if (ni < 0) modal.classList.add("hidden"); else lmI = ni; }
    renderLabels(); if (aberto && lmI >= 0 && labels[lmI]) lmDraw();
  }
  try { V.onSnapshot(V.collection(db, COL), { includeMetadataChanges: true }, adopt, fail); } catch (e) { fail(e); }
})();
(function () { const box = $("eLista"); let t = null, x0 = 0, y0 = 0;
  const stop = () => { clearTimeout(t); t = null; };
  box.addEventListener("pointerdown", e => { const r = e.target.closest(".crw"); if (eSelOn || !r || e.target.closest("[data-ldrop],[data-lchk],[data-ldup]")) return; x0 = e.clientX; y0 = e.clientY;
    const i = Number(r.dataset.li); t = setTimeout(() => { t = null; lmOpen(i); }, 500); });
  box.addEventListener("pointermove", e => { if (t && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) stop(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(n => box.addEventListener(n, stop));
  box.addEventListener("contextmenu", e => { if (e.target.closest(".crw")) e.preventDefault(); }); })();

// (apagar etiqueta: botão 🗑 em cada linha, com confirmação em dois toques e «Desfazer»)

// ---------- importar lista de produtos (nome + códigos) ----------
const HDR = { nome: /^(nome|produto|descri)/, bal: /(balan|plu)/, doa: /doa/, ean: /(ean|barra|gtin)/, cat: /(categ|setor)/ };
const catOf = s => { const n = norm(s); return CATS.find(c => norm(c) === n) || (/^(hortifruti|fruta|legume|verdura)/.test(n) ? "FLV" : null); };
const cleanNum = s => String(s || "").trim().replace(/^=/, "").replace(/"/g, "").replace(/\.0+$/, "");
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
  if (impBinario($("impText").value)) { impRows = []; $("impGo").disabled = true; $("impPrev").innerHTML = '<p class="bad">✖ Esse texto parece um arquivo PDF/binário, não uma lista. Toque em «Limpar texto» e cole as linhas (ou use um CSV).</p>'; return; }
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
const impBinario = t => /^\s*%PDF|^PK\u0003\u0004/.test(t) || /[\u0000-\u0008\u000e-\u001f\ufffd]/.test(t.slice(0, 4000));
$("impFile").onchange = async () => { const f = $("impFile").files[0]; if (!f) return; const buf = await f.arrayBuffer();
  const ini = new TextDecoder("latin1").decode(buf.slice(0, 8));
  if (/^%PDF|^PK/.test(ini) || /\.(pdf|xlsx?|docx?)$/i.test(f.name) && !/^[\x20-\x7e\r\n\t;,|]/.test(ini)) { $("impFile").value = ""; toast("Esse arquivo é PDF/Excel, não texto. Salve como CSV (ou copie e cole as linhas) e tente de novo."); return; }
  let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("windows-1252").decode(buf); }
  if (impBinario(t)) { $("impFile").value = ""; toast("Arquivo ilegível: não parece uma lista em texto/CSV."); return; }
  $("impText").value = t.replace(/^\ufeff/, ""); $("impFile").value = ""; impCheck(); };
$("impLimpa").onclick = () => { $("impText").value = ""; $("impPrev").innerHTML = ""; impRows = []; $("impGo").disabled = true; $("impGo").textContent = "Cadastrar"; };
$("impModel").onclick = () => download(new Blob(["\ufeffnome;codigo_balanca;codigo_doacao;ean;categoria\r\nMamão Papaya;123;45;;FLV\r\nBanana Prata;124;46;;FLV\r\nPão Francês;200;B1;;Padaria\r\n"], { type: "text/csv;charset=utf-8" }), "modelo-importacao-valida.csv");

if (db) startPresence(); else localStats();

// ---------- PWA ----------
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(r => r.update()).catch(console.error));

// ---------- versão do app + aviso de atualização ----------
// >>> a cada envio de atualização, troque este número (ex.: 2026.10.04-2) <<<
const APP_VERSION = window.APP_VERSION;   // definido em js/version.js, gerado por tools/build.mjs
window.vmVersion = APP_VERSION;
$("appVer").textContent = "v" + APP_VERSION.split("-").pop();
$("rodVer").textContent = "VERSÃO " + APP_VERSION;
$("rodOn").onclick = () => $("onChip").click();
// ---------- backup (arquivo .json) + lembrete semanal ----------
(function () {
  const BK = "validamais-bkp", BI = "validamais-bkp-ini", BS = "validamais-bkp-soneca", DIA = 864e5, SEMANA = 7 * DIA;
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const skip = k => k === "validamais-device" || k.indexOf("validamais-bkp") === 0;
  if (!rd(BI)) wr(BI, String(Date.now()));
  function pack() {
    const dados = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^valida/.test(k) && !skip(k)) dados[k] = localStorage.getItem(k); } } catch (e) {}
    return { app: "Valida+", versao: APP_VERSION, em: new Date().toISOString(), dados, produtosNuvem: db ? products.map(({ id, ...p }) => p) : undefined };
  }
  function fazer() {   // abre um quadro com 2 caminhos (cada botão é um toque direto: funciona em qualquer celular) e mostra o motivo se algo falhar
    const b = pack(), txt = JSON.stringify(b), blob = new Blob([txt], { type: "application/json" }), nome = `valida-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const bg = document.createElement("div"); bg.className = "askbg";
    bg.innerHTML = `<div class="ask" style="text-align:left"><div class="ai" style="text-align:center">💾</div><h3 style="text-align:center">Fazer backup</h3><p style="text-align:center">${Object.keys(b.dados).length} grupos de dados${b.produtosNuvem ? " · " + b.produtosNuvem.length + " produtos" : ""}</p>
      <div class="arow" style="flex-direction:column;gap:8px"><button type="button" class="ok" data-a="baixar">📥 Salvar arquivo no aparelho</button><button type="button" data-a="enviar">📤 Enviar (WhatsApp, Drive, e-mail…)</button><button type="button" data-a="fechar">Fechar</button></div>
      <p id="bkMsg" style="margin-top:10px;font-size:14px;text-align:center"></p></div>`;
    const msg = (t, bad) => { const m = bg.querySelector("#bkMsg"); m.textContent = t; m.style.color = bad ? "#ff8a80" : ""; };
    const feito = () => { wr(BK, String(Date.now())); document.querySelectorAll(".bkpbanner").forEach(x => x.remove()); };
    bg.onclick = async e => {
      if (e.target === bg) return bg.remove(); const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "fechar") return bg.remove();
      if (a.dataset.a === "baixar") { try { download(blob, nome); feito(); msg("✓ Arquivo " + nome + " salvo (veja em Downloads / Arquivos do celular)."); } catch (err) { msg("Não consegui salvar: " + (err && err.message || err), true); } return; }
      try {
        const file = new File([blob], nome, { type: "application/json" });
        if (!navigator.share) throw new Error("este aparelho não tem compartilhamento. Use «Salvar arquivo».");
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Backup Valida+", files: [file] });
        else await navigator.share({ title: "Backup Valida+ " + nome, text: txt });   // alguns celulares não aceitam arquivo .json: envia como texto
        feito(); msg("✓ Enviado.");
      } catch (err) { if (err && err.name === "AbortError") return; msg("Não deu para enviar (" + (err && (err.message || err.name) || "erro") + "). Use «Salvar arquivo no aparelho».", true); }
    };
    document.body.appendChild(bg);
  }
  function restaurar() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; let b;
      try { b = JSON.parse(await f.text()); if (b.app !== "Valida+" || !b.dados) throw 0; } catch (e) { return toast("Arquivo de backup inválido."); }
      const n = Object.keys(b.dados).length, quando = b.em ? new Date(b.em).toLocaleString("pt-BR") : "data desconhecida";
      const ok = await askConfirm({ icon: "♻️", title: "Restaurar backup?", text: quando, sub: `${n} grupos de dados serão restaurados neste aparelho. Os dados atuais serão substituídos.`, ok: "Restaurar", cancel: "Cancelar" });
      if (!ok) return;
      Object.keys(b.dados).forEach(k => { if (/^valida/.test(k) && !skip(k)) wr(k, b.dados[k]); });
      toast("Backup restaurado. Recarregando…"); setTimeout(() => location.reload(), 900);
    };
    inp.click();
  }
  function lembrar() {
    if (document.querySelector(".bkpbanner") || location.hash.indexOf("#conf=") === 0) return;
    const ult = Number(rd(BK)) || Number(rd(BI)) || Date.now(), ate = Number(rd(BS)) || 0;
    if (Date.now() - ult < SEMANA || Date.now() < ate) return;
    const dias = Math.floor((Date.now() - ult) / DIA), b = document.createElement("div"); b.className = "bkpbanner"; b.setAttribute("role", "alert");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(96px + var(--tb-h,0px) + env(safe-area-inset-bottom));z-index:99990;background:#7a5200;color:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:600 15px system-ui,sans-serif";
    b.innerHTML = `<div style="margin-bottom:10px">💾 ${rd(BK) ? `Faz ${dias} dias do último backup.` : `Você ainda não fez backup (${dias} dias de uso).`} Seus dados ficam só neste aparelho.</div><div style="display:flex;gap:8px"><button data-a="later" style="flex:1;min-height:46px;border:0;border-radius:12px;background:rgba(255,255,255,.2);color:#fff;font-weight:700;font-size:15px">Depois</button><button data-a="now" style="flex:1.4;min-height:46px;border:0;border-radius:12px;background:#fff;color:#7a5200;font-weight:800;font-size:15px">Fazer backup</button></div>`;
    b.onclick = e => { const a = e.target.closest("[data-a]"); if (!a) return; if (a.dataset.a === "later") { wr(BS, String(Date.now() + DIA)); b.remove(); } else fazer(); };
    document.body.appendChild(b);
  }
  window.vmBackup = fazer; window.vmRestaurar = restaurar;
  window.addEventListener("load", () => setTimeout(lembrar, 4000));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(lembrar, 1500); });
})();
// ---------- modo mão única ----------
(function () {
  const K = "validamais-mao1", root = document.documentElement;
  function med() { const tb = document.querySelector(".tabbar"), nb = $("dNow");
    root.style.setProperty("--tb-h", (tb ? tb.offsetHeight : 72) + "px"); root.style.setProperty("--nb-h", (nb && nb.offsetHeight ? nb.offsetHeight : 150) + "px"); }
  function build() {
    const h = document.querySelector("header"); if (!h || $("maoBtn")) return;
    const b = document.createElement("button"); b.id = "maoBtn"; b.type = "button"; b.textContent = "🖐️";
    b.style.cssText = "color:#fff;font-size:20px;min-width:44px;padding:0;line-height:1;border-radius:12px";
    const t = $("temaBtn"); t ? h.insertBefore(b, t) : h.appendChild(b);
    const ap = on => { document.body.classList.toggle("mao1", on); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Desligar modo mão única" : "Ligar modo mão única"); b.style.background = on ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.14)"; med(); setTimeout(med, 60); };
    let on = false; try { on = localStorage.getItem(K) === "1"; } catch (e) {}
    ap(on);
    b.onclick = () => { on = !on; try { localStorage.setItem(K, on ? "1" : "0"); } catch (e) {} ap(on); toast(on ? "Modo mão única ligado: lançamento embaixo e botões maiores. Deslize para trocar de aba." : "Modo mão única desligado."); };
    if (window.ResizeObserver) { const ro = new ResizeObserver(med); [document.querySelector(".tabbar"), $("dNow")].forEach(el => el && ro.observe(el)); }
    window.addEventListener("resize", med);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", build) : build();
})();
(function () {
  let shown = false;
  function banner(nova, nota) {
    if (shown) return; shown = true;
    const b = document.createElement("div");
    b.setAttribute("role", "alert");
    b.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:99999;background:#166534;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.45);font:600 15px system-ui,sans-serif";
    b.innerHTML = `<span style="flex:1">Nova versão disponível${nova ? " (v" + esc(nova.split("-").pop()) + ")" : ""}${nota ? `<small style="display:block;font-weight:500;font-size:13px;opacity:.92;margin-top:3px;line-height:1.3">${esc(nota)}</small>` : ""}</span><button style="background:#fff;color:#166534;border:0;border-radius:10px;padding:9px 14px;font-weight:800;font-size:15px">Atualizar</button>`;
    b.querySelector("button").onclick = async () => {
      b.firstChild.textContent = "Atualizando…";
      try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch (e) {}
      try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) {}
      location.reload();
    };
    document.body.appendChild(b);
  }
  async function check() {
    try {
      const v = await (await fetch("./version.json?chk=" + Date.now(), { cache: "no-store" })).json();
      if (v && v.versao && v.versao !== APP_VERSION) {
        banner(v.versao, v.nota || "");
      }
    } catch (e) {}
  }
  window.addEventListener("load", () => setTimeout(check, 1500));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  $("appVer").onclick = () => { toast("Versão " + APP_VERSION + " · verificando…"); check(); };
})();
let deferred; const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; } };
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("iosHint").classList.remove("hidden");
})();
