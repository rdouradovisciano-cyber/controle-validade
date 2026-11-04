/* app.js */
(() => {
"use strict";
if (window.__LOGIN_WAIT) return;
const C = window.VALIDA_CONFIG || {}, V = window.V || {}, fb = C.firebase || {};
const PER = "Perecíveis", KOR = "KÓRIN";
const CATS = ["Ovos","FLV","Padaria","Laticínios","Mercearia","Bebidas","Congelados","Higiene e limpeza","Outros", PER, KOR];
// setor escolhido na abertura (sessionStorage): "FLV" (tudo que não é Perecíveis, como sempre foi) ou "Perecíveis" (cadastros e validades próprios)
// perfil do aparelho (escolhido uma vez): "FLV" e "Perecíveis" entram direto e só nesse setor; "Admin" acessa os dois
const PERFIL_K = "validamais-perfil";
let PERFIL = (() => { try { const s = localStorage.getItem(PERFIL_K); return s === "FLV" || s === PER || s === "Admin" ? s : null; } catch (e) { return null; } })();
let SETOR = (() => { if (PERFIL === "FLV" || PERFIL === PER) return PERFIL; try { const s = sessionStorage.getItem("validamais-setor"); return s === PER || s === KOR ? s : "FLV"; } catch (e) { return "FLV"; } })();
const setorDe = p => p.category === PER ? PER : "FLV";   // Perecíveis tem cadastro próprio; FLV e KÓRIN usam o mesmo cadastro (categoria «FLV» e as demais)
// KÓRIN usa o mesmo banco do FLV; quais produtos são dele fica em sh_cfg/korin (e uma cópia neste aparelho)
const KORK = "validamais-korin-itens"; let korSet = {}, korNuvem = null; try { korSet = JSON.parse(localStorage.getItem(KORK) || "{}") || {}; } catch (e) {}
const korMapa = () => ({ ...korSet, ...(korNuvem || {}) }), korChave = p => norm(p.name || ""), isKor = p => !!korMapa()[korChave(p)];
const doSetor = p => { const s = setorDe(p); if (SETOR === PER) return s === PER; if (s === PER) return false; return SETOR === KOR ? isKor(p) : !isKor(p); };
let CATS_VIS, CATSET;   // CATSET = categoria gravada nos cadastros do setor atual
const derivaSetor = () => { CATS_VIS = SETOR === PER ? [PER] : CATS.filter(c => c !== PER && c !== KOR); CATSET = SETOR === PER ? PER : "FLV"; document.body.dataset.setor = SETOR; document.body.dataset.perfil = PERFIL || ""; };
derivaSetor();
const ADM_L = "validamais-admin-h";
const adminHash = async pin => { const b = new TextEncoder().encode("valida+|" + pin); try { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map(x => x.toString(16).padStart(2, "0")).join(""); } catch (e) { let h = 5381; for (const c of "valida+|" + pin) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return "x" + h; } };
function adminLer() {   // senha (hash) do Admin: nuvem quando houver, senão este aparelho. Devolve {h} ou {erro}
  return new Promise(res => {
    const local = () => { try { return localStorage.getItem(ADM_L) || ""; } catch (e) { return ""; } };
    const ini = Date.now(), tenta = () => {
      if (!cloud) return res({ h: local() });
      const d = window.vmDb && window.vmDb(); if (!d) { if (Date.now() - ini > 6000) return res({ erro: "Sem conexão com a nuvem. Tente de novo." }); return setTimeout(tenta, 250); }
      let fim = false, un = null; const t = setTimeout(() => { if (!fim) { fim = true; try { un && un(); } catch (e) {} res({ erro: "A nuvem não respondeu. Tente de novo." }); } }, 8000);
      un = V.onSnapshot(V.doc(d, "sh_cfg", "admin"), sn => { if (fim) return; fim = true; clearTimeout(t); try { un && un(); } catch (e) {} const h = sn.exists() ? (sn.data().h || "") : ""; try { if (h) localStorage.setItem(ADM_L, h); } catch (e) {} res({ h }); },
        err => { if (fim) return; fim = true; clearTimeout(t); res({ erro: "Não consegui ler a senha na nuvem." }); }); };
    tenta(); });
}
async function adminGravar(h) { try { localStorage.setItem(ADM_L, h); } catch (e) {} const d = window.vmDb && window.vmDb(); if (cloud && d) await V.setDoc(V.doc(d, "sh_cfg", "admin"), { h }); }
function pinModal({ titulo, texto, ok = "Confirmar", dois = false }) {   // devolve a senha digitada ou null
  return new Promise(res => { const bg = document.createElement("div"); bg.className = "askbg"; bg.style.cssText = "position:fixed;inset:0;z-index:2147483000";
    bg.innerHTML = `<div class="ask perfil"><div class="ai">🔐</div><h3>${titulo}</h3><p>${texto}</p><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="Senha (4 a 8 números)" id="pinA" style="width:100%;text-align:center;font-size:22px;letter-spacing:6px">${dois ? '<input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="Repita a senha" id="pinB" style="width:100%;text-align:center;font-size:22px;letter-spacing:6px;margin-top:8px">' : ""}<p id="pinE" style="color:#ff8f8f;margin:8px 0 0;min-height:18px"></p><div class="arow"><button type="button" class="secondary" data-n>Cancelar</button><button type="button" class="ok" data-o>${ok}</button></div></div>`;
    document.body.appendChild(bg); const a = bg.querySelector("#pinA"); setTimeout(() => a.focus(), 50);
    const go = () => { const v = a.value.trim(); if (!/^\d{4,8}$/.test(v)) { bg.querySelector("#pinE").textContent = "Use de 4 a 8 números."; return; } if (dois && bg.querySelector("#pinB").value.trim() !== v) { bg.querySelector("#pinE").textContent = "As senhas não são iguais."; return; } bg.remove(); res(v); };
    bg.onclick = e => { if (e.target.closest("[data-n]")) { bg.remove(); res(null); } else if (e.target.closest("[data-o]")) go(); };
    bg.onkeydown = e => { if (e.key === "Enter") go(); }; });
}
async function adminSenha(motivo) {   // true se a senha do Admin foi confirmada (ou criada, na primeira vez)
  const r = await adminLer(); if (r.erro) { toast(r.erro); return false; }
  if (!r.h) {   // ainda não existe senha de Admin: quem entrar primeiro cria
    const n = await pinModal({ titulo: "Criar senha do Admin", texto: "Esta senha protege o acesso Admin em todos os aparelhos. Guarde-a: só você deve saber.", ok: "Criar senha", dois: true }); if (!n) return false;
    try { await adminGravar(await adminHash(n)); } catch (e) { toast("Não consegui salvar a senha na nuvem."); return false; } toast("Senha do Admin criada."); return true; }
  for (let i = 0; i < 3; i++) { const n = await pinModal({ titulo: "Senha do Admin", texto: motivo === "troca" ? "Para trocar o perfil deste aparelho, digite a senha do Admin." : "Digite a senha do Admin para entrar.", ok: "Entrar" }); if (!n) return false;
    if (await adminHash(n) === r.h) return true; toast("Senha incorreta."); }
  return false;
}
function perfilEscolher(troca) {   // pergunta uma vez qual é o setor deste aparelho
  const bg = document.createElement("div"); bg.className = "askbg"; bg.id = "perfilBg";
  const op = (v, ic, t, s) => `<button type="button" class="perfop${PERFIL === v ? " on" : ""}" data-p="${v}"><span>${ic}</span><b>${t}</b><small>${s}</small></button>`;
  bg.innerHTML = `<div class="ask perfil"><div class="ai">👤</div><h3>${troca ? "Perfil deste aparelho" : "Qual é o seu setor?"}</h3><p>${troca ? "Escolha o novo perfil." : "Você escolhe uma vez e o app abre direto no seu setor."}</p>
    ${op("FLV", "🥬", "FLV", "Hortifruti")}${op(PER, "🧀", "Perecíveis", "Validades e etiquetas")}${op("Admin", "🛡️", "Admin", "Acesso a FLV e Perecíveis")}${troca ? '<button type="button" class="secondary" data-x style="margin-top:8px;width:100%">Cancelar</button>' : ""}</div>`;
  const aplica = v => { try { localStorage.setItem(PERFIL_K, v); sessionStorage.removeItem("validamais-setor"); } catch (err) {} location.reload(); };
  let ocupado = false;
  bg.onclick = async e => { if (troca && (e.target === bg || e.target.closest("[data-x]"))) return bg.remove();
    const b = e.target.closest("[data-p]"); if (!b || ocupado) return; const v = b.dataset.p; if (v === PERFIL) return bg.remove();
    ocupado = true;
    try {
      if (v === "Admin" || (troca && PERFIL !== "Admin")) { if (!(await adminSenha(v === "Admin" ? "Admin" : "troca"))) return; }   // Admin e troca de perfil exigem a senha do Admin
      aplica(v);
    } finally { ocupado = false; } };
  document.body.appendChild(bg);
}
if (!PERFIL) perfilEscolher(false);
const $ = id => document.getElementById(id);
const LK = "validamais-produtos-v1", LC = "validamais-ultima-categoria", TK = "validamais-tam";
let curTab = "Loja", tierF = "", openId = "", pesOpen = "", acaoF = "";   // pesOpen: pesável aberta (só ela mostra «Lançar etiqueta» e «Editar»)
//    // tierF: filtro por faixa de urgência (v/h/a/y); openId: linha de validade aberta
const LOJA = C.loja || "Sam's Club Radial Leste";
const EMPTY_FLV = '<div class="empty"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#9db8a4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 28h44l-5 22a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3z"/><path d="M22 28c0-9 4-16 10-16s10 7 10 16"/><path d="M32 12c0-4 3-7 8-7 0 5-3 8-8 7z"/></svg><p>Nenhum produto do FLV com validade para vencer no momento.</p></div>';
const SKEL = '<div class="skel" role="status" aria-label="Carregando produtos">' + [58, 72, 46, 64].map((w, k) => `<div class="product skelc" aria-hidden="true" style="--d:${k * 0.15}s"><div class="sk sk-t" style="width:${w}%"></div><div class="sk sk-m"></div><div class="sk-row"><div class="sk sk-d"></div><div class="sk sk-p"></div></div></div>`).join("") + '</div>';
let products = [], lixeira = [], outros = [], rawAll = [], db = null, scanner = null, toastTimer, carregando = false;   // carregando: Firebase ainda não respondeu (mostra silhuetas)
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
  ["main.app", "#sectorBox", "#fabWrap", "#fabScrim", "#side", "#sideBg", "#modal", "#toast"].forEach(q => { const el = document.querySelector(q); if (el) el.classList.add("hidden"); });
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
// ---------- nota curta por item (aparece no cartão aberto; vale para todos os aparelhos via sh_cfg/notas) ----------
const NTLK = "validamais-notas";
let notasNuvem = {};
const notaDe = id => { const l = store.get(NTLK, {})[id], c = notasNuvem[id], v = (c && c.em >= ((l && l.em) || 0)) ? c : (l || c); return v && v.t ? v : null; };
function notaSalva(id, texto) {
  const t = String(texto || "").trim().slice(0, 60), v = { t, por: myName().slice(0, 40), em: Date.now() };
  if (!t && !notaDe(id)) return;
  const m = store.get(NTLK, {}); m[id] = v; store.set(NTLK, m);
  if (db) V.setDoc(V.doc(db, "sh_cfg", "notas"), { n: { [id]: v } }, { merge: true }).catch(e => { console.warn(e); toast("Nota salva só neste aparelho (a nuvem recusou)."); });
  render();
}
// ícone por tipo de produto (só Perecíveis; dá para desligar em 🎨 Cores e prazos)
const ICK = "validamais-icones", iconesOn = () => store.get(ICK, true) !== false;
const FXK = "validamais-fx", fxOn = () => store.get(FXK, true) !== false, fxAplica = () => { document.documentElement.dataset.fx = fxOn() ? "on" : "off"; }; fxAplica();
const ICONES = [[/ravioli|\brana\b|massa|nhoque|lasanha|tortellini|capeletti|capelete|fettuccine|espaguete/, "🍝"], [/pop ?cheese/, "🧀"], [/b[uú]fala/, "🐃"], [/coalho/, "🍢"], [/requeij|cream cheese|polengh|polenghi|catupiry|cottage|ricota|ricotta|frescal|petit suisse/, "🥣"], [/queijo|qj|qjo|q\.j|muss|mozz|mussarela|muçarela|minas|parmes|provolone|prato|gorgonzola|brie|gouda|cheese|reino|canastra|colonial|meia cura|emmental|edam|azul|montanhes|le vin|su[ií]ço|grana|tilsit|raclette|pecorino|halloumi|padr[aã]o zero/, "🧀"], [/manteiga/, "🧈"], [/ovo/, "🥚"], [/iogurte|leite|vitamina|nata|coalhada|danone|creme de leite|kefir|bebida l[aá]ctea|molico|ninho/, "🥛"], [/camar[aã]o/, "🦐"], [/polvo|tent[aá]culo|lula/, "🐙"], [/peixe|salm[aã]o|til[aá]pia|bacalhau|atum|sardinha|merluza/, "🐟"], [/peru|blanquet/, "🦃"], [/frango|chester|coxa|sobrecoxa/, "🍗"], [/salsicha|linguica|linguiça|calabresa|hot ?dog|vienna|viena|frankfurt/, "🌭"], [/bacon|torresmo/, "🥓"], [/presunto|lombo|copa|pernil|apresuntado|fiambre|tender/, "🐖"], [/mortadela/, "🍖"], [/salame|salaminho|peperoni|pepperoni|pastrami/, "🍕"], [/carne|bife|picanha|alcatra|maminha|patinho|costela|hamb[uú]rguer|fil[eé]|bovin|su[ií]n/, "🥩"], [/guioza|gyoza/, "🥟"], [/sorvete|congelad|pizza|nuggets|empanad|polpa|açaí|acai|steak/, "🧊"], [/p[aã]o|bolo|torta|biscoito|massa folhada|croissant/, "🥖"], [/suco|refrigerante|[aá]gua|cerveja|vinho/, "🥤"], [/salada|alface|r[uú]cula|folha|verdura|legume/, "🥗"], [/doce|chocolate|sobremesa|pudim|mousse|gelatina/, "🍮"]];
// ícone escolhido à mão (vale para todos os lotes do produto e para todos os aparelhos: sh_cfg/icones)
const ICMK = "validamais-icones-map", icKey = n => norm(n).replace(/[.\/\[\]*`~]/g, "_").slice(0, 80) || "_";
let icoNuvem = {};
const icoEscolhido = p => { const k = icKey(p.name), l = store.get(ICMK, {})[k], c = icoNuvem[k], v = (c && c.em >= ((l && l.em) || 0)) ? c : (l || c); return v ? v.e : null; };   // "" = sem ícone
function iconeSalva(p, e) {   // e: emoji | "" (sem ícone) | null (automático)
  const k = icKey(p.name), v = { e: e === null ? null : e, em: Date.now() }, m = store.get(ICMK, {}); m[k] = v; store.set(ICMK, m);
  if (db) V.setDoc(V.doc(db, "sh_cfg", "icones"), { m: { [k]: v } }, { merge: true }).catch(x => { console.warn(x); toast("Ícone salvo só neste aparelho (a nuvem recusou)."); });
  render();
}
const ICO_OPC = ["🧀", "🥛", "🧈", "🥚", "🍝", "🥓", "🌭", "🍖", "🐖", "🦃", "🍗", "🥩", "🍕", "🐟", "🦐", "🧊", "🍦", "🥣", "🥫", "🍿", "🧆", "🍢", "🐃", "🐄", "🥖", "🥐", "🥗", "🥦", "🍅", "🍎", "🍓", "🍇", "🍫", "🍮", "🍯", "🥜", "🥤", "🧃", "🍔", "🥪", "🌮", "🍱", "🍣", "🧁", "📦", "⭐"];
function iconePicker(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "icoModal";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Escolher ícone"><div class="sheethead"><h2>Ícone do produto</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div><p class="note"><b>${esc(p.name)}</b><br>Vale para todos os lotes e todos os aparelhos.</p>
    <div class="icogrid">${ICO_OPC.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
    <div class="toolbar" style="margin-top:12px"><button type="button" class="secondary" data-auto>🔄 Automático</button><button type="button" class="secondary" data-nenhum>🚫 Sem ícone</button></div></section>`;
  document.body.appendChild(bg);
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return bg.remove(); const b = e.target.closest("[data-e]"); if (b) { iconeSalva(p, b.dataset.e); return bg.remove(); } if (e.target.closest("[data-auto]")) { iconeSalva(p, null); return bg.remove(); } if (e.target.closest("[data-nenhum]")) { iconeSalva(p, ""); bg.remove(); } };
}
const iconeDe = p => { if (!iconesOn() || !p || p.category !== PER) return ""; const esc1 = icoEscolhido(p); if (esc1 !== null && esc1 !== undefined) return esc1; const n = String(p.name || "").toLowerCase(); const m = ICONES.find(([r]) => r.test(n + " ")); return m ? m[1] : "📦"; };
// ---------- aparência e prazos personalizáveis (cores + dias do vermelho/amarelo + tamanho da letra) ----------
const VK = "validamais-visual", VIS_PAD = { red: 3, yel: null, cores: { v: "#8a3a45", h: "#bf4a52", a: "#c7514a", y: "#c9a22f", g: "#4a9a78" }, fonte: "normal" };
let visCloud = null;   // padrão da loja (Firestore sh_cfg/visual), definido pelo Admin
const visNorm = o => { const c = o || {}; return { red: Number(c.red) >= 1 ? Math.min(30, Number(c.red)) : VIS_PAD.red, yel: Number(c.yel) >= 1 ? Math.min(60, Number(c.yel)) : null, cores: { ...VIS_PAD.cores, ...(c.cores || {}) }, fonte: c.fonte === "grande" ? "grande" : "normal" }; };
const visCfg = () => visNorm(store.get(VK, null) || visCloud);
const limit = c => { const v = visCfg(); if (v.yel) return Math.max(v.yel, v.red); const b = c === PER ? 7 : (C.alertaDias && (C.alertaDias[c] ?? C.alertaDias.padrao)) ?? 3; return Math.max(b, v.red); };
function visAplica() {
  const v = visCfg(), r = document.documentElement.style, lum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return 0; const n = parseInt(m[1], 16), f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255); };
  Object.entries({ v: "cv", h: "ch", a: "ca", y: "cy", g: "cg" }).forEach(([k, n]) => { r.setProperty("--" + n, v.cores[k]); r.setProperty("--t" + n, lum(v.cores[k]) > .4 ? "#1a1405" : "#fff"); });
  document.documentElement.dataset.fonte = v.fonte;
}
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
  t.classList.remove("hidden"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), action ? 6000 : Math.max(2500, Math.min(7000, 1800 + String(msg).length * 55)));   // some sozinho; texto longo fica mais tempo; com «Desfazer», 6 s
}
const LIXO_MS = 3 * 864e5;   // lixeira: cadastros excluídos ficam 3 dias e depois somem de vez
const persist = () => { if (!db) store.set(LK, products.concat(lixeira, outros)); };
const LLK = "validamais-lixo-local";
function lixoLocalLer() { const agora = Date.now(); const l = store.get(LLK, []).filter(p => agora - Number(p.lixo) <= LIXO_MS); return l.map(p => ({ ...p, loc: true })); }
function lixoLocalGravar(l) { store.set(LLK, l.map(({ loc, ...r }) => r)); }
const RET_MS = 30 * 864e5;   // quanto tempo um produto fica em «Retirados da loja»
function separaLixo(arr) {
  arr = arr.filter(p => !String(p.name || "").startsWith("__AUTOTESTE__"));   // itens criados pelo autoteste nunca aparecem
  rawAll = arr;
  const agora = Date.now(), venc = arr.filter(p => (p.lixo && agora - Number(p.lixo) > LIXO_MS) || (p.retirado && p.retEm && agora - Number(p.retEm) > RET_MS));   // lixeira vencida e retirados há mais de 30 dias saem de vez
  outros = arr.filter(p => !doSetor(p) && !venc.includes(p));   // do outro setor: não aparece aqui (e é preservado no modo local)
  const meu = arr.filter(doSetor);
  products = meu.filter(p => !p.lixo && !venc.includes(p)).map(p => p.category === KOR ? { ...p, category: "FLV" } : p); lixeira = meu.filter(p => p.lixo && !venc.includes(p));
  if (db) { const loc = lixoLocalLer().filter(doSetor); if (loc.length) lixeira = lixeira.concat(loc); }   // lixeira deste aparelho (quando a nuvem não aceita o campo "lixo")
  if (venc.length) { if (db) venc.forEach(p => V.deleteDoc(V.doc(db, "products", p.id)).catch(() => {})); else persist(); }
}

// ---------- lista ----------
function fillCategories() {
  const opt = (id, first) => { const el = $(id); el.innerHTML = ""; el.add(new Option(first, "")); CATS_VIS.forEach(c => el.add(new Option(c, c))); };
  opt("category", "Selecione"); opt("categoryFilter", "Todas as categorias"); opt("exportCategory", "Selecione a categoria");
}
function sirene() {   // aba Validades pisca em branco, sem som, só quando há produto que vence hoje (os já vencidos não contam)
  const fx = fxOn(), n = products.filter(p => { const d = daysLeft(p.expiry); return !p.retirado && d !== null && (fx ? d <= 0 : d === 0); }).length, b = $("tbLoja");
  b.classList.toggle("siren", n > 0); $("sirN").textContent = n > 99 ? "99+" : n; b.title = n ? n + (fx ? " produto(s) vencido(s) ou vencendo hoje" : " produto(s) vencendo hoje") : "";
}
setInterval(() => { if (typeof sirene === "function") sirene(); }, 60000);
// ---------- histórico de produtos (o que entrou, mudou ou saiu — e quem) ----------
const PHK = "validamais-phbase", PLK = "validamais-phlog", PHF = ["name", "expiry", "quantity", "category", "barcode", "codigo_balanca", "codigo_doacao", "retirado"];
const PH_CORTE = (() => { let c = Number(localStorage.getItem("validamais-ph-corte") || 0); if (!c) { c = Date.now(); try { localStorage.setItem("validamais-ph-corte", String(c)); } catch (e) {} } return c; })();   // só entra no histórico o que for cadastrado depois deste momento
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
  // só produtos novos entram no histórico (saídas e alterações não são mais guardadas)
  phLog = phLog.filter(e => Date.now() - (e.t || 0) < HIST_MS); store.set(PLK, phLog);
  if (ev.length) { phLog = ev.concat(phLog).slice(0, 300); while (phLog.length > 1 && JSON.stringify(phLog).length > 900000) phLog.pop(); store.set(PLK, phLog); phBase = cur; store.set(PHK, cur); if (!$("phModal").classList.contains("hidden")) phDraw(); }
}
const phWhen = t => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function phDraw() {
  const q = norm($("phBusca").value || "");
  const rows = phLog.map((e, i) => ({ e, i })).filter(({ e }) => e.k === "add" && e.t >= PH_CORTE).filter(({ e }) => !q || e.it.some(x => norm(x.n || x.name || "").includes(q)));
  $("phList").innerHTML = rows.length ? rows.map(({ e, i }) => {
    const nm = x => esc(x.n || x.name || "?"), tit = e.k === "add" ? `＋ Entrou · ${e.n} produto(s)` : e.k === "del" ? `🗑 Saiu · ${e.n} produto(s)` : `✎ Alterado · ${e.n} produto(s)`;
    const lines = e.it.slice(0, 8).map(x => `<div>• ${nm(x)}${x.d ? " <small class='muted'>" + esc(x.d) + "</small>" : x.expiry ? " <small class='muted'>validade " + fmt(x.expiry) + "</small>" : ""}</div>`).join("") + (e.n > 8 ? `<div class="muted">… e mais ${e.n - 8}</div>` : "");
    return `<div class="phe ${e.k}"><b>${tit}</b><small class="muted">${phWhen(e.t)} · ${esc(e.who)}</small>${lines}${e.k === "del" ? (e.rest ? '<small class="muted">✓ já restaurado</small>' : `<button type="button" class="secondary" data-phr="${i}">↩ Restaurar ${e.it.length > 1 ? "estes " + e.it.length : "este"}</button>`) : ""}</div>`;
  }).join("") : '<p class="muted">Nenhum produto novo ainda. Quando alguém cadastrar um produto, ele aparece aqui.</p>';
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
  { const cf = $("categoryFilter"), oth = [...new Set(products.map(p => p.category).filter(c => c && c !== CATSET))].sort(), sig = oth.join("|");
    if (cf.dataset.sig !== sig) { const cur = cf.value; cf.innerHTML = ""; cf.add(new Option("Todos os setores", "")); [CATSET, ...oth].forEach(c => cf.add(new Option(c, c)));
      cf.value = [...cf.options].some(o => o.value === cur) ? cur : CATSET; cf.dataset.sig = sig; }
    cf.classList.toggle("hidden", !oth.length); document.querySelector("#tabLoja .filters").classList.toggle("hidden", !oth.length); $("verTodos").classList.toggle("hidden", !!oth.length); }
  const q = $("search").value.trim().toLowerCase(), cat = $("categoryFilter").value, st = $("statusFilter").value;
  const base = products.filter(p => !p.retirado && (!cat || p.category === cat)), ex = base.filter(p => status(p) === "expired").length, so = base.filter(p => status(p) === "soon").length;
  const ainda = carregando && !products.length;   // Firebase ainda não respondeu: não mostra "0"
  $("countAll").textContent = ainda ? "–" : products.length;
  { const nr = products.filter(p => p.retirado).length; $("verRet").classList.toggle("hidden", !nr && !retView); $("verRet").textContent = retView ? "← Voltar às validades" : `📦 Retirados da loja (${nr})`; $("verRetTop").classList.toggle("hidden", !retView); }
  { const vt = $("verTodos"); if (vt) vt.textContent = ainda ? "Conectando…" : cat ? `Ver todos os ${products.length} cadastrados` : "Voltar ao " + SETOR; }
  // os dois atalhos saíram da tela: ficam no menu ⋮; o link só aparece quando é preciso voltar
  { $("verTodos").classList.toggle("hidden", !!cat);
    const nr2 = products.filter(p => p.retirado).length; if ($("mnTodosT")) $("mnTodosT").textContent = `Ver todos os ${products.length} cadastrados`; }
  document.querySelectorAll("#tabLoja .stats .stat").forEach((e, i) => e.classList.toggle("on", (i === 1 && st === "soon") || (i === 2 && st === "expired"))); $("countSoon").textContent = ainda ? "–" : so; $("countExpired").textContent = ainda ? "–" : ex;
  { const fora = cat ? products.filter(p => !p.retirado && p.category !== cat && daysLeft(p.expiry) !== null && daysLeft(p.expiry) >= 0 && daysLeft(p.expiry) <= 1).length : 0;
    $("outAlert").classList.toggle("hidden", !fora); $("outAlert").textContent = `⚠ ${fora} produto(s) de OUTROS setores vencem em até 1 dia — toque para ver todos`; }
  $("topAlert").classList.toggle("hidden", !(ex || so));
  $("topAlert").textContent = `Atenção: ${ex} vencido(s) e ${so} vencendo em breve.`;
  sirene();
  // escala de atenção: vencido · vence hoje · 1 a 3 dias (vermelho, ação imediata) · até o prazo de alerta (amarelo; 7 dias em Perecíveis)
  const prioDe = p => { const dl = daysLeft(p.expiry); if (dl === null || p.retirado) return ""; if (dl < 0) return "v"; if (dl === 0) return "h"; if (status(p) !== "soon") return ""; return dl <= visCfg().red ? "a" : "y"; };
  const PRIOI = { v: "⛔", h: "🚨", a: "⚠️", y: "⏳" };
  { const c = { v: 0, h: 0, a: 0, y: 0 }, lim = limit(cat || CATSET); base.forEach(p => { const k = prioDe(p); if (k) c[k]++; });
    const t = $("tiers"); if (t) { t.classList.toggle("hidden", retView); t.querySelectorAll("[data-t]").forEach(b => { b.querySelector("b").textContent = ainda ? "–" : c[b.dataset.t]; b.classList.toggle("on", tierF === b.dataset.t); b.classList.toggle("zero", !c[b.dataset.t]); });
      const ly = t.querySelector('[data-t="y"] span'); if (ly) ly.textContent = "Até " + lim + " dias";
      const IC = { v: "⛔", h: "🚨", a: "⚠️", y: "⏳" }; $("tiersSum").innerHTML = ["v", "h", "a", "y"].map(k => `<i class="${c[k] ? "nz" : "z"}${tierF === k ? " on" : ""}">${IC[k]}${ainda ? "–" : c[k]}</i>`).join("");
      const ab = tiersAberto(); t.classList.toggle("aberto", ab); $("tiersBar").setAttribute("aria-expanded", ab ? "true" : "false"); $("tiersTog").textContent = ab ? "▴ recolher" : "▾ ver"; } }
  const cnt = {}; products.forEach(p => { if (p.barcode) cnt[p.barcode] = (cnt[p.barcode] || 0) + 1; });
  const hoje = products.filter(p => !p.retirado && daysLeft(p.expiry) === 0 && (!cat || p.category === cat));
  $("todayBanner").classList.toggle("hidden", !hoje.length);
  $("todayBanner").textContent = `⚠ VENCEM HOJE (${hoje.length}): ` + hoje.slice(0, 5).map(p => p.name).join(", ") + (hoje.length > 5 ? "…" : "");
  if (!hoje.length) alarmed = false; else if (!alarmed && actx) { alarmed = true; alarm(); }
  const rows = retView ? products.filter(p => p.retirado).sort((a, b) => (Number(b.retEm) || 0) - (Number(a.retEm) || 0)) : products.filter(p => q ? ((p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q) || String(p.codigo_balanca || "") === q || String(p.codigo_doacao || "").toLowerCase() === q)   // buscando: procura em TODOS os setores, com ou sem validade
      : (!p.retirado && (!cat || p.category === cat) && !((cat === "FLV" || cat === PER) && daysLeft(p.expiry) === null) && (!st || status(p) === st) && (!tierF || prioDe(p) === tierF) && (!acaoF || (daysLeft(p.expiry) ?? 9) <= 0)))
    .sort((a, b) => cat ? (a.expiry || "9999").localeCompare(b.expiry || "9999")
      : (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }) || (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  let lastG = ""; const gcnt = {}; rows.forEach(p => { const k = retView ? "x" : (prioDe(p) || "ok"); gcnt[k] = (gcnt[k] || 0) + 1; });
  $("list").innerHTML = rows.length ? rows.map(p => { const dl = daysLeft(p.expiry), cls = dl === null ? "none" : dl <= 0 ? "expired" : status(p);
    if (p.retirado) return `<article class="product retirado"><div class="ctop"><h3>${esc(p.name)}</h3><span class="upd">${esc(p.category)}</span></div><div class="vbox"><div class="vd"><small>RETIRADO DA LOJA</small><b>${p.retEm ? new Date(Number(p.retEm)).toLocaleDateString("pt-BR") : "—"}</b></div><div class="vr"><span class="pill">${p.retPor ? "por " + esc(p.retPor) : ""}</span><small>validade era ${fmt(p.expiry)}</small></div></div><div class="actions"><button class="secondary" data-volta="${esc(p.id)}">↩ Voltar para a loja</button></div></article>`;
    const pr = prioDe(p), g = pr || "ok", lim = limit(cat || CATSET); let hd = "";
    if (cat && !q && !tierF && g !== lastG) { lastG = g; const GN = { v: "⛔ Vencidos", h: "🚨 Vence hoje", a: "🔴 Vence em 1 a " + visCfg().red + " dia" + (visCfg().red > 1 ? "s" : "") + " — agir já", y: "🟡 De " + (visCfg().red + 1) + " a " + lim + " dias", ok: "✅ Dentro do prazo" }; hd = `<div class="pgh g${g}"><span>${GN[g]}</span><i>${gcnt[g]}</i></div>`; }
    const big = dl === null ? "—" : dl < 0 ? "VENCIDO" : dl === 0 ? "HOJE" : dl === 1 ? "AMANHÃ" : String(dl), small = dl === null ? "sem validade" : dl < 0 ? "há " + (-dl) + (dl < -1 ? " dias" : " dia") : dl <= 1 ? "" : "dias";
    return hd + `<article class="pitem${pr ? " pr" + pr : " prok"}${openId === p.id ? " open" : ""}" data-id="${esc(p.id)}"><div class="pi-main"><div class="pi-txt"><b class="pi-nome">${iconeDe(p) ? `<span class="ico" data-id="${esc(p.id)}">${iconeDe(p)}</span>` : ""}${esc(p.name)}${notaDe(p.id) ? `<i class="pi-nt" title="${esc(notaDe(p.id).t)}">📝</i>` : ""}</b><small class="pi-sub">Qtd ${esc(p.quantity)} · vence ${fmt(p.expiry)}${cnt[p.barcode] > 1 ? " · " + cnt[p.barcode] + " lotes" : ""}${PERFIL === "Admin" ? " · 👤 " + esc(p.por || "—") : ""}</small></div><div class="pi-badge"><b>${big}</b>${small ? `<span>${small}</span>` : ""}</div></div><div class="pi-act"><label class="pi-nota"><span>📝</span><input type="text" maxlength="60" data-nota="${esc(p.id)}" value="${esc((notaDe(p.id) || {}).t || "")}" placeholder="Nota (ex.: gôndola 3, já na promoção)" autocomplete="off" enterkeyhint="done"></label><small class="pi-cod">Cód.: ${esc(p.barcode || (p.codigo_balanca ? "PLU " + p.codigo_balanca : "—"))} · ${esc(p.category)}</small><div class="actions"><button class="secondary" data-edit="${esc(p.id)}">Editar</button><button class="secondary of" data-of="${esc(p.id)}">🏷️ Oferta</button><button class="primary" data-ret="${esc(p.id)}">Retirar</button></div></div></article>`;
  }).join("") : (carregando && !products.length ? SKEL : cat === "FLV" && !q && !st ? EMPTY_FLV : '<p class="muted">Nenhum produto encontrado. Use "Bipar código" ou "Cadastro manual".</p>');
  $("acaoBar").classList.toggle("hidden", !acaoF);
  { const urg = base.filter(p => { const k = prioDe(p); return k === "v" || k === "h" || k === "a"; }).length; try { if (base.some(p => prioDe(p) === "v") && fxOn() && !window.__sirV) { window.__sirV = 1;   // o Chrome só deixa vibrar depois do primeiro toque na tela: espera esse toque
      document.addEventListener("pointerdown", () => { try { if (fxOn() && navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 450]); } catch (e) {} }, { once: true, passive: true }); } } catch (e) {} try { if (navigator.setAppBadge) { if (urg > 0) navigator.setAppBadge(urg).catch(() => {}); else navigator.clearAppBadge && navigator.clearAppBadge().catch(() => {}); } } catch (e) {} }   // número no ícone do app = itens em vermelho
  { const n = rows.length, lt = $("listTotal"); lt.classList.toggle("hidden", !n); lt.textContent = retView ? `${n} ${n === 1 ? "item retirado" : "itens retirados"}` : `${n} ${n === 1 ? "item" : "itens"} na lista`; }
  if (typeof renderPesaveis === "function") renderPesaveis();
}

// ---------- oferta / etiqueta promocional (desconto de última hora) ----------
const OFK = "validamais-ofpreco";   // último preço normal digitado, por produto (só neste aparelho)
let ofP = null, ofD = 30;
function ofSugestao(p) { const dl = daysLeft(p.expiry); return dl !== null && dl <= 1 ? 50 : 30; }
// código de barras EAN-13 (SVG) para a etiqueta; devolve "" se o código não for um EAN-13 válido
function ean13Svg(code) {
  if (!/^\d{13}$/.test(code || "")) return "";
  const dig = code.split("").map(Number); if ((10 - dig.slice(0, 12).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0) % 10) % 10 !== dig[12]) return "";
  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"],
    R = L.map(c => c.split("").map(x => x === "0" ? "1" : "0").join("")), G = R.map(c => c.split("").reverse().join("")),   // G = R espelhado
    par = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"][dig[0]];
  let b = "101"; for (let k = 0; k < 6; k++) b += (par[k] === "L" ? L : G)[dig[k + 1]]; b += "01010"; for (let k = 0; k < 6; k++) b += R[dig[k + 7]]; b += "101";
  let x = "", k = 0; while (k < b.length) { if (b[k] === "1") { let n = 1; while (b[k + n] === "1") n++; x += `<rect x="${k}" y="0" width="${n}" height="40"/>`; k += n; } else k++; }
  return `<svg viewBox="0 0 95 40" preserveAspectRatio="none" aria-hidden="true" shape-rendering="crispEdges">${x}</svg>`;
}
const OFH = "validamais-ofhd", OFT = "validamais-oftam", OFO = "validamais-ofobs";
function ofHtml(p, d, preco, hd, obs) {
  const hoje = new Date(), por = preco > 0 ? Math.round(preco * (100 - d)) / 100 : 0, bar = ean13Svg(String(p.barcode || "")), cod = p.codigo_doacao || p.codigo_balanca || "";
  const [pi, pc] = por ? brl(por).split(",") : ["", ""], [di, dc] = preco > 0 ? brl(preco).split(",") : ["", ""];
  const dt = String(hoje.getDate()).padStart(2, "0") + "/" + String(hoje.getMonth() + 1).padStart(2, "0") + "/" + hoje.getFullYear();
  const val = (p.expiry ? `VÁLIDO ATÉ ${fmt(p.expiry)} OU ENQUANTO DURAREM OS ESTOQUES` : "VÁLIDO ENQUANTO DURAREM OS ESTOQUES");
  return `<div class="o3"><div><div class="o3-top"><b class="o3-hd">${esc(hd || "")}</b><span class="o3-cod">${esc(cod)}</span></div><div class="o3-nome">${esc(p.name)}</div></div>` +
    `<div class="o3-mid"><div class="o3-de">${preco > 0 ? `<small>DE:</small><div class="o3-dep"><em>R$</em><b>${di}</b><sup>,${dc}</sup></div>` : ""}</div>` +
    `<div class="o3-por">${por ? `<small>POR:</small><div class="o3-pv" data-n="${pi.length}"><em>R$</em><b>${pi}</b><sup>,${pc}</sup></div>` : `<small>OFERTA</small><div class="o3-pct">${d}<sup>%</sup><span>OFF</span></div>`}</div></div>` +
    `<div class="o3-bot"><div class="o3-left">${obs ? `<div class="o3-un">${esc(obs)}</div>` : ""}${bar ? `<div class="o3-bar">${bar}<span>${esc(String(p.barcode))}</span></div>` : ""}</div><div class="o3-val">${val}</div><span class="o3-dt">${dt}</span></div></div>`;
}
function ofRender() {
  if (!ofP) return;
  const preco = parseFloat(String($("ofPreco").value).replace(",", ".")) || 0;
  document.querySelectorAll("#ofChips button").forEach(b => b.classList.toggle("on", Number(b.dataset.d) === ofD && !$("ofOutro").value));
  $("ofOutro").classList.toggle("on", !!$("ofOutro").value);
  $("ofCard").innerHTML = ofHtml(ofP, ofD, preco, $("ofHd").value.trim().toUpperCase(), $("ofObs").value.trim().toUpperCase());
}
function ofertaAbrir(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  ofP = p; ofD = ofSugestao(p); $("ofOutro").value = ""; $("ofObs").value = store.get(OFO, {})[p.barcode || p.id] || ""; $("ofHd").value = store.get(OFH, "") || (p.category === PER ? "PERECÍVEIS" : "HORTIFRUTI");
  const dl = daysLeft(p.expiry), sv = store.get(OFK, {})[p.barcode || p.id];
  $("ofPreco").value = sv ? String(sv).replace(".", ",") : "";
  $("ofInfo").textContent = `${p.name} · ${dl === null ? "sem validade" : dl <= 0 ? "vence hoje" : dl === 1 ? "vence amanhã" : "vence em " + dl + " dias"} · sugestão: ${ofD}% de desconto`;
  $("ofModal").classList.remove("hidden"); ofTamMarca(); ofRender();
}
function ofFecha() { $("ofModal").classList.add("hidden"); ofP = null; }
$("ofX").onclick = $("ofFecha").onclick = ofFecha;
$("ofChips").onclick = e => { const b = e.target.closest("button[data-d]"); if (!b) return; ofD = Number(b.dataset.d); $("ofOutro").value = ""; ofRender(); };
$("ofOutro").oninput = () => { const v = $("ofOutro").value.replace(/\D/g, ""); $("ofOutro").value = v; const n = Number(v); if (n >= 1 && n <= 90) ofD = n; ofRender(); };
const ofTamMarca = () => document.querySelectorAll("#ofTam button").forEach(b => b.classList.toggle("on", b.dataset.t === store.get(OFT, "full")));
$("ofTam").onclick = e => { const b = e.target.closest("button[data-t]"); if (!b) return; store.set(OFT, b.dataset.t); ofTamMarca(); };
$("ofObs").oninput = () => { const m = store.get(OFO, {}); m[ofP ? (ofP.barcode || ofP.id) : "_"] = $("ofObs").value.slice(0, 80); store.set(OFO, m); ofRender(); };
$("ofHd").oninput = () => { store.set(OFH, $("ofHd").value.slice(0, 30)); ofRender(); };
$("ofPreco").oninput = () => { $("ofPreco").value = $("ofPreco").value.replace(/[^\d,.]/g, ""); ofRender(); };
$("ofPrintBtn").onclick = () => {
  if (!ofP) return;
  const preco = parseFloat(String($("ofPreco").value).replace(",", ".")) || 0;
  logAtv("oferta", `${ofP.name} · ${ofD}% de desconto`);
  if (preco > 0) { const m = store.get(OFK, {}); m[ofP.barcode || ofP.id] = preco; store.set(OFK, m); }
  const box = $("ofPrint"); box.innerHTML = `<div class="ofcard print ${store.get(OFT, "full") === "full" ? "full" : "small"}">${ofHtml(ofP, ofD, preco, $("ofHd").value.trim().toUpperCase(), $("ofObs").value.trim().toUpperCase())}</div>`;
  document.body.classList.add("printOf");
  const fim = () => { document.body.classList.remove("printOf"); box.innerHTML = ""; window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim); setTimeout(() => { try { window.print(); } catch (e) { fim(); } }, 60);
};

// ---------- modal e formulário ----------
function show(title, scan) {
  $("modalTitle").textContent = title; $("modal").classList.remove("hidden");
  $("modal").classList.toggle("scanning", !!scan); $("scannerArea").classList.toggle("hidden", !scan); $("productForm").classList.toggle("hidden", !!scan);
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
  $("category").value = CATSET; $("saveNext").classList.remove("hidden"); toggleCodes();
  $("productForm").classList.remove("lote"); $("loteInfo").classList.add("hidden"); $("loteEdit").classList.add("hidden");
}
function toggleCodes() {
  const flv = $("category").value === "FLV"; $("expiry").required = !flv; $("expLabel").textContent = flv ? "Data de validade (opcional)" : "Data de validade *"; $("semCodigo").classList.toggle("hidden", !!$("barcode").value.trim() && !["FLV", "Padaria"].includes($("category").value)); }
let scanBusy = Promise.resolve();
async function liberaCamera(s) {
  if (s) { try { await s.stop(); } catch {} try { s.clear(); } catch {} }
  // garantia: solta a câmera mesmo se stop() falhar (senão ela segue ligada e deixa o app lento)
  try { document.querySelectorAll("#reader video").forEach(v => { const m = v.srcObject; if (m && m.getTracks) m.getTracks().forEach(k => { try { k.stop(); } catch {} }); v.srcObject = null; v.remove(); }); } catch {}
  try { const r = $("reader"); if (r && !scanner) r.innerHTML = ""; } catch {}
}
function stopScanner() {                                  // volta na hora; a câmera é solta em segundo plano
  const s = scanner; scanner = null;
  $("torchBtn").classList.add("hidden");
  scanBusy = scanBusy.then(() => liberaCamera(s)).catch(() => {});
  return scanBusy;
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
  const cnt = new Map(); products.forEach(p => { const nm = (p.name || "").trim(); if (!nm) return; const nn = norm(nm), o = cnt.get(nn) || { nome: nm, n: 0, ean: new Set(), plu: new Set(), doa: new Set(), lots: [] }; o.n++; if (p.barcode) o.ean.add(p.barcode); if (p.codigo_balanca) o.plu.add(p.codigo_balanca); if (p.codigo_doacao) o.doa.add(p.codigo_doacao); if (p.expiry) o.lots.push({ q: p.quantity, e: p.expiry, ret: !!p.retirado }); cnt.set(nn, o); });
  const items = [...cnt.values()], par = items.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (similarKeys(nameKey(items[i].nome), nameKey(items[j].nome))) par[find(j)] = find(i);
  const g = new Map(); items.forEach((it, i) => { const r = find(i); (g.get(r) || g.set(r, []).get(r)).push(it); });
  return [...g.values()].filter(a => a.length > 1);
}
function dupInfo(x) {   // EAN, códigos e o que há na loja (lotes com quantidade e validade), para decidir qual nome é o certo
  const cods = [x.ean && x.ean.size ? "EAN " + [...x.ean].join(" / ") : "sem EAN", x.plu && x.plu.size ? "PLU " + [...x.plu].join(" / ") : "", x.doa && x.doa.size ? "Cód. " + [...x.doa].join(" / ") : ""].filter(Boolean).join(" · ");
  const ls = (x.lots || []).filter(l => !l.ret).sort((a, b) => String(a.e).localeCompare(String(b.e))), ret = (x.lots || []).length - ls.length;
  const loja = ls.length ? "Na loja: " + ls.slice(0, 4).map(l => `${esc(l.q)} un · vence ${fmt(l.e)}`).join(" | ") + (ls.length > 4 ? ` | +${ls.length - 4}` : "") : "Na loja: nenhum lote com validade";
  return `<small class="dupi">${esc(cods)}</small><small class="dupi">${loja}${ret ? ` · ${ret} retirado(s)` : ""}</small>`;
}
function dupReview() {
  const bg = document.createElement("div"); bg.className = "askbg";
  const paint = () => { const gs = dupGroups(); bg.dataset.g = JSON.stringify(gs.map(a => a.map(x => x.nome)));
    bg.innerHTML = `<div class="ask" style="max-height:86dvh;overflow:auto;text-align:left"><div class="ai" style="text-align:center">🔍</div><h3 style="text-align:center">Cadastros parecidos</h3>` +
      (gs.length ? `<p style="text-align:center">Escolha o nome certo de cada grupo. Os outros serão renomeados.</p>` + gs.map((a, gi) => `<div class="dupg">${a.map((x, ni) => `<div class="dupr"><span><b>${esc(x.nome)}</b> <small>${x.n} cadastro(s)</small>${dupInfo(x)}</span><button type="button" data-g="${gi}" data-n="${ni}">Usar este</button></div>`).join("")}</div>`).join("")
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
// ---------- histórico de atividade (Admin vê quem entrou e o que fez; gravado na coleção "acessos", que as regras já aceitam) ----------
const ATK = "validamais-atv";
function logAtv(a, txt, extra) {
  try { const rec = { tipo: "atv", t: Date.now(), quem: myName().slice(0, 40), perfil: PERFIL || "", setor: SETOR || "", dev: myId, a, txt: String(txt || "").slice(0, 140), ...(extra || {}) };
    if (db) V.addDoc(V.collection(db, "acessos"), rec).catch(e => console.warn("atividade:", e && (e.code || e.message)));
    else { const l = store.get(ATK, []); l.unshift(rec); store.set(ATK, l.slice(0, 300)); } } catch (e) { console.warn(e); }
}
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
  store.set(LC, data.category); logAtv(id ? "editou" : "cadastrou", `${data.name} · vence ${fmt(data.expiry)} · qtd ${data.quantity}`);
  if (db) {
    const ts = V.serverTimestamp();
    const p = id ? V.updateDoc(V.doc(db, "products", id), { ...data, updatedAt: ts })
                 : V.addDoc(V.collection(db, "products"), { ...data, createdAt: ts, updatedAt: ts });
    p.catch(e => { console.error(e); toast(data.category === PER ? "Erro ao salvar. O Firebase precisa aceitar a categoria «Perecíveis» nas regras." : "Erro ao salvar na nuvem. Confira as regras do Firestore."); });
  } else {
    if (id) products = products.map(x => x.id === id ? { ...x, ...data, updatedAt: Date.now() } : x); else products.push({ ...data, id: uid(), updatedAt: Date.now() });
    persist(); render();
  }
  closeModal(); toast("Produto salvo."); { const nm = norm(data.name || ""); vmOk(() => [...document.querySelectorAll("#list article.product, #list article.pitem")].find(a => norm((a.querySelector("h3, .pi-nome") || {}).textContent || "") === nm)); } if (next) openScan();
}
let retView = false;
const RLK = "validamais-retlocal"; let retLoc = store.get(RLK, {});
// dados que a nuvem recusou ficam marcados só neste aparelho
function retOverlay() { products.forEach(p => { if (p.retirado == null && retLoc[p.id]) { p.retirado = true; p.retEm = retLoc[p.id].em; p.retPor = retLoc[p.id].por; } }); }
// efeito ao retirar: o cartão desliza para fora e a lista fecha o espaço (some em ~0,4 s)
function efeitoSai(id) {
  const el = [...document.querySelectorAll("#list .pitem")].find(x => x.dataset.id === id);
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  el.style.maxHeight = el.offsetHeight + "px"; void el.offsetHeight; el.classList.add("saindo");
  return new Promise(r => setTimeout(r, 420));
}
const MOTIVOS = ["Vencido", "Quebra/estragou", "Vendido em oferta", "Vendido"], ENGANO = ["Lançado por engano"];   // "engano" só apaga o lote da lista, sem registro
async function retirar(id, sai, semPerguntar) {
  const p = products.find(x => x.id === id); if (!p) return;
  if (sai && !semPerguntar) { const ok = await askConfirm({ icon: "📦", title: "Retirar produto", text: p.name + " · vence " + fmt(p.expiry), subtitle: "Por que está saindo?", motivos: MOTIVOS.concat(ENGANO), motivo: (daysLeft(p.expiry) !== null && daysLeft(p.expiry) <= 0) ? "Vencido" : "Vendido", okMap: { [ENGANO[0]]: "Remover" }, ok: "Retirar", cancel: "Cancelar" }); if (ok !== true) return; if (window.vmMotivo === ENGANO[0]) return remover(id); }
  if (sai) await efeitoSai(id);
  { const mot = sai ? (semPerguntar ? "Outro" : (window.vmMotivo || "Outro")) : ""; logAtv(sai ? "retirou" : "devolveu", `${p.name} · vence ${fmt(p.expiry)}${mot ? " · " + mot : ""}`, sai ? { motivo: mot, qtd: Number(p.quantity) || 0, prod: String(p.name || "").slice(0, 80), cat: p.category || "", dl: daysLeft(p.expiry) ?? 99 } : null); }
  const em = Date.now(), por = myName(), campos = sai ? { retirado: true, retEm: em, retPor: por } : { retirado: false };
  const salvarLocal = () => { if (sai) retLoc[id] = { em, por }; else delete retLoc[id]; store.set(RLK, retLoc); Object.assign(p, campos); render(); };
  const fim = (nuvem, motivo) => toast((sai ? "✓ " + p.name + " retirado da loja" : p.name + " voltou para a loja") + (nuvem ? "." : " (só neste aparelho: a nuvem recusou" + (motivo ? " — " + motivo : "") + ")."), "Desfazer", () => retirar(id, !sai, true));
  if (db && !(!sai && retLoc[id])) {
    try { await V.updateDoc(V.doc(db, "products", id), { ...campos, updatedAt: V.serverTimestamp() }); if (!sai) { delete retLoc[id]; store.set(RLK, retLoc); } fim(true); }
    catch (e) { console.error(e); salvarLocal(); fim(false, e && (e.code || e.message)); }
  } else { salvarLocal(); fim(true); }
}
let retSyncRodou = 0;
async function retSync(manual) {   // manda para a nuvem as retiradas que ficaram só neste aparelho (quando a nuvem passar a aceitar)
  const ids = Object.keys(retLoc); if (!db || !ids.length || (!manual && Date.now() - retSyncRodou < 60000)) return { ok: 0, falha: 0 }; retSyncRodou = Date.now();
  let ok = 0, falha = 0;
  for (const id of ids) { const r = retLoc[id], p = rawAll.find(x => x.id === id);
    if (!p) { delete retLoc[id]; continue; }   // produto não existe mais
    try { await V.updateDoc(V.doc(db, "products", id), { retirado: true, retEm: r.em, retPor: r.por, updatedAt: V.serverTimestamp() }); delete retLoc[id]; ok++; } catch (e) { falha++; } }
  store.set(RLK, retLoc); if (ok) { toast(ok + " retirada(s) enviada(s) para todos os aparelhos."); } return { ok, falha };
}
async function remover(id) {   // tira só o lote da lista, sem registrar como retirado; o cadastro (nome e códigos) é preservado
  const p = products.find(x => x.id === id); if (!p) return; logAtv("removeu", `${p.name} (só da lista)`);
  const outros = rawAllAtivos().filter(x => x.id !== id && sameProd(x, p) && setSet(x) === setSet(p)), campos = ["barcode", "name", "category", "expiry", "quantity", "por", "codigo_balanca", "codigo_doacao"];
  const copia = {}; campos.forEach(k => { if (p[k] !== undefined) copia[k] = p[k]; });
  const falha = e => { console.error(e); toast("Não foi possível remover."); };
  if (outros.length) {   // há outro registro do produto: este lote pode sair de vez
    if (db) { try { await V.deleteDoc(V.doc(db, "products", id)); } catch (e) { return falha(e); } } else { products = products.filter(x => x.id !== id); persist(); render(); }
    toast(`${p.name} removido da lista.`, "Desfazer", () => { if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...copia, createdAt: ts, updatedAt: ts }).catch(falha); } else { products.push({ ...copia, id: uid() }); persist(); render(); } toast("Lote restaurado."); });
  } else {   // é o único registro: guarda o cadastro e só apaga a validade
    const exp = p.expiry; const set = ex => { if (db) return V.updateDoc(V.doc(db, "products", id), { expiry: ex, updatedAt: V.serverTimestamp() }); p.expiry = ex; persist(); render(); };
    try { await set(""); } catch (e) { return falha(e); }
    toast(`${p.name} removido da lista (o cadastro continua).`, "Desfazer", () => { Promise.resolve(set(exp)).then(() => toast("Lote restaurado.")).catch(falha); });
  }
}
const TIERK = "validamais-tiers-aberto", tiersAberto = () => store.get(TIERK, false);
$("tiers").onclick = e => { if (e.target.closest("#tiersBar")) { store.set(TIERK, !tiersAberto()); render(); return; } const b = e.target.closest("[data-t]"); if (!b) return; tierF = tierF === b.dataset.t ? "" : b.dataset.t; render(); };
$("verRet").onclick = $("verRetTop").onclick = () => { retView = !retView; render(); window.scrollTo(0, 0); };

// ---------- scanner ----------
// toque com resposta: os botões afundam (CSS). A vibração a cada toque saiu na v288.
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(50); } catch {} }; // pulso tátil de 50 ms
let actx, alarmed = false, sector = "";
const audio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} };
function tone(f, t, d) { if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = .25; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + d); }
function beep() { audio(); tone(1000, 0, .09); }
// sinal sonoro + vibração por resultado: ok (produto conhecido) = 1 bip curto · novo (precisa cadastrar) = 2 bips subindo · erro = tom grave longo
function sinal(k) {
  audio(); const v = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} };
  if (k === "erro") { tone(260, 0, .3); v([220]); }
  else if (k === "novo") { tone(780, 0, .08); tone(1180, .11, .13); v([40, 70, 40]); }
  else { tone(1000, 0, .09); v(60); }
}
function alarm() { /* sem som nem vibração: o aviso de vencimento agora é só a aba piscando */ }
function loteMode(k) {          // produto já cadastrado: só pede validade e quantidade deste lote
  if (!k || !k.name) return;
  $("productForm").classList.add("lote");
  $("loteInfo").textContent = `Produto já cadastrado: ${k.name}${k.barcode ? " · cód. " + k.barcode : ""}. Informe só a validade e a quantidade deste lote.`;
  $("loteInfo").classList.remove("hidden"); $("loteEdit").classList.remove("hidden");
}
$("loteEdit").onclick = () => { $("productForm").classList.remove("lote"); $("loteInfo").classList.add("hidden"); $("loteEdit").classList.add("hidden"); };
// Etiquetas de gôndola trazem o EAN-13 + o preço (6 dígitos) no mesmo código de barras (ex.: 7898205078770 000798 = R$ 7,98). Só vale o EAN: os 13 primeiros dígitos.
const eanOk = d => { let t = 0; for (let i = 0; i < 12; i++) t += Number(d[i]) * (i % 2 ? 3 : 1); return (10 - t % 10) % 10 === Number(d[12]); };
const limpaCodigo = c => { c = String(c == null ? "" : c).trim(); return /^[013-9]\d{17,19}$/.test(c) && eanOk(c.slice(0, 13)) ? c.slice(0, 13) : c; };
async function onCode(code) {
  code = limpaCodigo(code);
  if (scanMode === "doacao") return donationScan(code);
  if (scanMode === "etiqueta") return labelScan(code);
  if (scanMode === "cadastro") return cadScan(code);
  if (scanMode === "contagem") return contagemScan(code);
  sinal((isScale(code) ? products.some(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(String(Number(parseScale(code).item)))) : products.some(p => p.barcode === code)) ? "ok" : "novo");
  stopScanner(); resetForm();
  if (isScale(code)) {                                   // etiqueta de balança: o código de balança identifica o produto
    const plu = String(Number(parseScale(code).item)), k = products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(plu));
    logScan(code, k); show(k ? `Novo lote de «${k.name}»` : "Produto novo: cadastre agora");
    $("barcode").value = (k && k.barcode) || ""; $("name").value = (k && k.name) || ""; $("category").value = (k && k.category) || CATSET;
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
  scanMode = ["doacao", "etiqueta", "cadastro", "contagem"].includes(mode) ? mode : "loja";
  resetForm(); show({ doacao: "Bipar itens da doação", etiqueta: "Bipar para etiqueta", cadastro: "Bipar para o cadastro", contagem: "Bipar para a contagem" }[scanMode] || "Ler código de barras", true);
  $("scanManual").textContent = scanMode === "loja" ? "Digitar código" : "Cancelar";
  ["retryScan", "torchBtn"].forEach(i => $(i).classList.add("hidden"));
  $("scanMsg").textContent = "Aponte a câmera traseira para o código de barras. Se não ler, digite o código abaixo."; $("manualCode").value = "";
  await stopScanner();
  const F = V.Html5QrcodeSupportedFormats, s = new V.Html5Qrcode("reader", { verbose: false,
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF] });
  scanner = s;
  try {
    await s.start({ facingMode: "environment" }, {
      fps: scanMode === "doacao" ? 8 : 10,
      qrbox: (w, h) => ({ width: Math.floor(w * .85), height: Math.floor(Math.min(w, h) * .4) }),
      videoConstraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] }
    }, onCode, () => {});
    if (scanner !== s) { scanBusy = scanBusy.then(() => liberaCamera(s)).catch(() => {}); return; }  // modal fechado durante a abertura
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
$("list").addEventListener("change", e => { const n = e.target.closest && e.target.closest("[data-nota]"); if (n) notaSalva(n.dataset.nota, n.value); });
$("list").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches && e.target.matches("[data-nota]")) { e.preventDefault(); e.target.blur(); } });
$("list").onclick = e => { const ic = e.target.closest(".ico"); if (ic) { iconePicker(ic.dataset.id); return; } if (e.target.closest(".pi-nota")) return; const b = e.target.closest("button"); if (!b) { const it = e.target.closest(".pitem"); if (it) { openId = openId === it.dataset.id ? "" : it.dataset.id; document.querySelectorAll("#list .pitem").forEach(x => x.classList.toggle("open", x.dataset.id === openId)); } return; } if (b.dataset.edit) edit(b.dataset.edit); if (b.dataset.of) ofertaAbrir(b.dataset.of); if (b.dataset.ret) retirar(b.dataset.ret, true); if (b.dataset.volta) retirar(b.dataset.volta, false); };
$("manualOpen").onclick = () => openForm(); $("fab").onclick = () => openScan(curTab === "Doacao" ? "doacao" : curTab === "Pesaveis" ? "etiqueta" : curTab === "Etiquetas" ? "etiqueta" : curTab === "Cadastros" ? "cadastro" : curTab === "Contagem" ? "contagem" : "loja"); $("retryScan").onclick = () => openScan(scanMode);
$("scanManual").onclick = () => { stopScanner(); if (scanMode !== "loja") closeModal(); else openForm(); };
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
// ---------- sem internet: o app segue funcionando e avisa o que está aguardando envio ----------
const NUVEM_K = "validamais-cache-nuvem"; let pendN = 0, foiOff = !navigator.onLine;
function offBar() {
  let b = $("offBar"); if (!b) { b = document.createElement("div"); b.id = "offBar"; b.setAttribute("role", "status"); document.body.appendChild(b); }
  const off = !navigator.onLine, n = pendN;
  if (off) foiOff = true;
  b.textContent = off ? "📴 Sem internet. O app continua funcionando" + (n ? ` · ${n} alteração${n > 1 ? "ões" : ""} aguardando envio` : "") : n ? `⏳ Enviando ${n} alteração${n > 1 ? "ões" : ""}…` : "";
  b.classList.toggle("on", !!b.textContent);
  if (!off && !n && foiOff) { foiOff = false; toast("✓ Conexão voltou. Tudo enviado."); }
}
window.addEventListener("offline", offBar); window.addEventListener("online", () => { setTimeout(offBar, 1500); });
if (cloud && V.initializeApp) {
  try {
    const app = V.initializeApp(fb);
    db = V.initializeFirestore(app, { localCache: V.persistentLocalCache({ tabManager: V.persistentMultipleTabManager() }) });
    carregando = true; $("list").innerHTML = SKEL;   // silhuetas até chegar o primeiro dado (no máximo 6 s, para não ficar preso sem internet)
    setTimeout(() => { if (carregando) { carregando = false; render(); } }, 6000);
    // abertura rápida: mostra na hora a última lista guardada neste aparelho; a nuvem substitui em seguida
    try { const c = JSON.parse(localStorage.getItem(NUVEM_K) || "null"); if (c && Array.isArray(c.l) && c.l.length) { separaLixo(c.l); lixoBtn(); carregando = false; render(); setSync("conectando…"); } } catch (e) {}
    V.onSnapshot(V.collection(db, "products"), { includeMetadataChanges: true }, snap => {
      const docsN = snap.docs.map(d => ({ id: d.id, ...d.data() })); pendN = snap.docs.filter(d => d.metadata.hasPendingWrites).length; offBar();
      try { localStorage.setItem(NUVEM_K, JSON.stringify({ t: Date.now(), l: docsN.map(({ foto, ...r }) => r) }, (k, v) => v && typeof v.toMillis === "function" ? v.toMillis() : v)); } catch (e) {}
      separaLixo(docsN); lixoBtn(); window.__hReady = !snap.metadata.fromCache; if (window.__hReady || snap.docs.length) carregando = false;   // há dados no cache (mesmo que nenhum seja deste setor): não segura a tela esperando a nuvem
      render();   // repinta sempre que qualquer aparelho altera algo
      if (window.__hReady) { setTimeout(() => { try { limparFotosNuvem(); } catch (e) { console.warn(e); } }, 2000); retSync(); notifVerifica(); }
      setSync(snap.metadata.hasPendingWrites ? "alterações aguardando envio…" : snap.metadata.fromCache ? (navigator.onLine ? "conectando…" : "offline (dados salvos no aparelho)") : "sincronizado");
    }, err => { console.error(err); carregando = false; render(); setSync("erro de sincronização (confira as regras do Firestore)"); toast("Erro ao ler os dados da nuvem."); });
  } catch (e) { console.error(e); db = null; setSync("falha ao iniciar o Firebase"); }
} else { setTimeout(() => notifVerifica(), 1500); separaLixo(store.get(LK, []).map(({ foto, ...r }) => r)); persist(); setSync("modo local neste aparelho (configure o Firebase para sincronizar)"); render(); }

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
function pintaSetor() {   // botões do topo e itens do menu ⋮ conforme o setor atual
  const ch = $("setorChip"); if (ch) ch.querySelectorAll("[data-s]").forEach(b => { b.hidden = false; b.classList.toggle("on", b.dataset.s === SETOR); b.setAttribute("aria-pressed", b.dataset.s === SETOR); b.onclick = () => trocaSetor(b.dataset.s); });
  const outros = ["FLV", PER, KOR].filter(x => x !== SETOR), nome = x => x === KOR ? "KÓRIN" : x;
  [["mnSetor", "mnSetorT", outros[0]], ["mnSetor2", "mnSetor2T", outros[1]]].forEach(([b, t, alvo]) => { if ($(b)) { $(t).textContent = "Ir para " + nome(alvo); $(b).onclick = () => { trocaSetor(alvo); if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } }; } }); }
function rotulosSetor() {   // Perecíveis: «código de doação» vira «código interno»
  [["label[for=cDoacao]", "Código interno", "Código de doação"], ["label[for=cDon]", "Código interno", "Código de doação"]].forEach(([q, per, flv]) => { const e = document.querySelector(q); if (!e) return; const t = SETOR === PER ? per : flv; const n = [...e.childNodes].find(c => c.nodeType === 3); if (n) n.textContent = t; else e.textContent = t; }); }
pintaSetor();
$("categoryFilter").value = CATSET; store.set(LC, CATSET); render();
{ const sf = $("statusFilter"), stt = document.querySelectorAll("#tabLoja .stats .stat");
  stt[0].onclick = () => { sf.value = ""; render(); }; stt[1].onclick = () => { sf.value = sf.value === "soon" ? "" : "soon"; render(); }; stt[2].onclick = () => { sf.value = sf.value === "expired" ? "" : "expired"; render(); }; }
$("phClose").onclick = () => $("phModal").classList.add("hidden"); $("phBusca").oninput = phDraw;
$("phList").onclick = e => { const b = e.target.closest("[data-phr]"); if (b) phRestore(Number(b.dataset.phr)); };
$("outAlert").onclick = () => { $("categoryFilter").value = ""; render(); window.scrollTo(0, 0); };
$("verTodos").onclick = () => { $("categoryFilter").value = $("categoryFilter").value ? "" : CATSET; render(); };
document.addEventListener("pointerdown", () => {   // libera o som do alerta no primeiro toque (sem redesenhar a lista, senão o primeiro toque num botão se perde)
  audio(); try { const cat = $("categoryFilter").value; if (!alarmed && actx && products.some(p => !p.retirado && daysLeft(p.expiry) === 0 && (!cat || p.category === cat))) { alarmed = true; alarm(); } } catch (e) { console.warn(e); } }, { once: true });
rotulosSetor();
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
const newRec = (p, field, v, ts) => ({ name: p.name, barcode: p.barcode || "", category: p.category || CATSET, expiry: "", quantity: 1, por: myName(), codigo_balanca: "", codigo_doacao: "", [field]: v, ...(ts ? { createdAt: ts, updatedAt: ts } : {}) });
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
function registerProduct({ name, category = CATSET, barcode = "", codigo_balanca = "", codigo_doacao = "" }) {   // grava no cadastro compartilhado
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
  const v = limpaCodigo($("eanCode").value.replace(/\D/g, ""));
  if (!/^\d{6,14}$/.test(v)) { toast("Digite o código de barras só com números (6 a 14 dígitos)."); return $("eanCode").focus(); }
  eanClose(); lastScan = { c: "", t: 0 }; donationScan(v);        // mesmo caminho da leitura pela câmera: cadastro (se novo) e quantidade
}
$("eanGo").onclick = eanGo;
$("eanCode").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); eanGo(); } };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("eanModal").classList.contains("hidden")) eanClose(); });

// ---------- aba Doação ----------
const UK = "validamais-dunid", HK = "validamais-doacoes", NK = "validamais-dnomes";
const chaveSetor = b => SETOR === "FLV" ? b : b + "-" + (SETOR === PER ? "per" : "kor");
let DK = chaveSetor("validamais-doacao");
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
  ["Loja", "Doacao", "Pesaveis", "Etiquetas", "Inventario", "Cadastros", "Contagem"].forEach(n => { const p = $("tab" + n); if (p) p.classList.toggle("hidden", n !== t); const nb = $("nav" + n); if (nb) nb.classList.toggle("active", n === t); });
  [["Loja", t === "Loja"], ["Doacao", t === "Doacao"], ["Pesaveis", t === "Pesaveis"], ["Etiquetas", t === "Etiquetas"], ["Cadastros", t === "Cadastros"], ["Contagem", t === "Contagem"]].forEach(([n, on]) => { const b = $("tb" + n); if (b) b.classList.toggle("active", on); });
  document.body.dataset.tab = t; document.body.dataset.grp = t;
  if (t === "Doacao" && typeof dView === "function") dView("lista");
  if (t === "Pesaveis" && typeof renderPesaveis === "function") renderPesaveis();
  if (t === "Contagem" && typeof kPaint === "function") kPaint();
}
function dCodTxt(i) {   // kg: código de doação · un: código de barras (ou, sem ele, o de doação); nunca o de balança
  const pr = products.find(x => norm(x.name || "") === norm(i.nome)) || {};
  return i.unidade === "un"
    ? ((pr.barcode || i.bar) ? "Cód. barras: " + esc(pr.barcode || i.bar) : pr.codigo_doacao ? "Cód. doação: " + esc(pr.codigo_doacao) : "")
    : ((pr.codigo_doacao || i.cod) ? "Cód. doação: " + esc(pr.codigo_doacao || i.cod) : "");
}
const burnTxt = (t, off) => [...String(t)].map((c, k) => c === " " ? " " : `<span class="bc" style="animation-delay:${off + k * 38}ms">${esc(c)}</span>`).join("");
function renderDon() {
  if (typeof dTop6Render === "function") dTop6Render();
  $("dKg").textContent = fq(sumU("kg")); $("dUn").textContent = fq(sumU("un")); $("dKg").parentElement.style.display = sumU("kg") > 0 ? "" : "none"; $("dUn").parentElement.style.display = sumU("un") > 0 ? "" : "none"; $("dItens").textContent = don.itens.length;
  $("dLista").innerHTML = don.itens.length ? don.itens.map((i, x) => `<div class="ditem${window.dNovo===i.key?" novo":""}${(window.dLastKey&&don.itens.some(z=>z.key===window.dLastKey)?i.key===window.dLastKey:x===don.itens.length-1)?" ult":""}${dSel && norm(i.nome) === norm(dSel) ? " cur" : ""}">${dIco(i.nome)}<div class="dn"><b${window.dBurn===i.key?` class="burn" style="--n:${[...i.nome].length}"`:""}>${window.dBurn===i.key?burnTxt(i.nome,350):esc(i.nome)}</b>${dCodTxt(i) ? `<span class="dcod">${dCodTxt(i)}</span>` : ""}<small>${i.lanc} lançamento(s)${(i.cx || i.sem) ? `<span class="dtara">${i.cx ? i.cx + " com TARA" : ""}${i.cx && i.sem ? " · " : ""}${i.sem ? i.sem + " sem TARA" : ""}</span>` : ""}</small></div><div class="dq" data-edit="${x}" role="button" tabindex="0" title="Tocar para corrigir a quantidade"><span class="cnum" data-v="${i.qtd}">${fq(i.qtd)}</span> <span>${esc(i.unidade)}</span></div><button class="cdel" data-drop="${x}" aria-label="Remover ${esc(i.nome)}">✕</button></div>`).reverse().join("") : '<p class="empty">Nada lançado ainda.<br>' + (SETOR === PER ? "Toque em Buscar para escolher o produto." : "Toque num produto abaixo para começar.") + '</p>';
  { const b = $("dCont"); if (b) { b.classList.toggle("hidden", !don.cont); if (don.cont) $("dContT").textContent = `➕ Continuando a doação de ${dataBR(don.cont.data)}. O que você lançar soma nela.` + (don.pausa && don.pausa.itens.length ? ` Sua lista de hoje (${don.pausa.itens.length} itens) fica guardada.` : ""); } }
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
    $("dT6").innerHTML=f.list.map((o,i)=>{ const same=dFamKey(o.n)===f.k, rest=(same?dBase(o.n).split(/\s+/).slice(1).join(" "):dBase(o.n)); return `<button type="button" data-tv="${i}">${balIco(o.n, f.w)}${pkTag(o.n)}${esc(rest?dTitle(rest.split(" ")[0])+(rest.includes(" ")?" "+rest.split(" ").slice(1).join(" ").toLowerCase():""):"Comum")}<small>${uDe(o)}</small></button>`; }).join("")+`<button type="button" class="dback" data-tback="1">← voltar</button>`;
  } else { box._open=-1; { const tg=!ed; $("dT6L").textContent=ed?"✎ TOQUE NUM ATALHO PARA EDITAR":"⭐ ATALHOS "+(colp?"▴":"▾"); $("dT6L").classList.toggle("tg",tg); if(tg){ $("dT6L").setAttribute("role","button"); $("dT6L").tabIndex=0; $("dT6L").setAttribute("aria-label",colp?"Mostrar atalhos":"Recolher atalhos"); } else { $("dT6L").removeAttribute("role"); $("dT6L").removeAttribute("tabindex"); $("dT6L").removeAttribute("aria-label"); } } $("dT6").classList.remove("var");
    $("dT6").innerHTML=top.map((f,i)=>`<button type="button" class="${ed?"ed":""}" data-t6="${i}">${balIcoTop(f.w)}${esc(dTitle(f.w))}<small>${f.list.length>1?f.list.length+" tipos"+(ed?"":" ›"):(f.list[0]?f.list[0].u:"")}</small></button>`).join("")+(ed&&top.length<9?'<button type="button" class="dnew" data-tnew="1">＋ Novo</button>':""); } }
function dPickVar(o){ const box=$("dTop6"); box._open=-1; buzz(); const p=products.find(x=>norm(dBase(x.name))===norm(dBase(o.n)))||prodFor(o.n); selectProd(p?p.name:o.n,o.c||"",uDe(o)); }
$("dT6").onclick=e=>{ const box=$("dTop6"), f=box._f||[];
  if(window.dEditBal){ if(e.target.closest("[data-tnew]")) return dBalOpen(-1); const b=e.target.closest("[data-t6]"); if(b) dBalOpen(Number(b.dataset.t6)); return; }
  if(e.target.closest("[data-tback]")){ box._open=-1; dTop6Render(); return; }
  const v=e.target.closest("[data-tv]"); if(v){ const o=(f[box._open]||{list:[]}).list[Number(v.dataset.tv)]; if(o) dPickVar(o); return; }
  const b=e.target.closest("[data-t6]"); if(!b) return; const fam=f[Number(b.dataset.t6)]; if(!fam) return;
  if(fam.list.length>1){ buzz(); box._open=Number(b.dataset.t6); dTop6Render(); } else dPickVar(fam.list[0]); };
// ícone do balão pelo nome (🍅 tomate, 🍋 limão…); sem palavra conhecida, mostra a inicial num círculo
const MAMAO_SVG = '<svg class="bsv" viewBox="4 1 24 29" aria-hidden="true"><path d="M16 3c6 3 10 10 9 17-1 6-5 9-9 9s-8-3-9-9C6 13 10 6 16 3z" fill="#f59a23"/><path d="M16 8c3.5 2.5 6 7 5.5 11.5C21 23 18.5 25 16 25s-5-2-5.5-5.5C10 15 12.5 10.5 16 8z" fill="#ff6b3d"/><g fill="#1c1c1c"><circle cx="14" cy="16" r="1.3"/><circle cx="18" cy="16" r="1.3"/><circle cx="16" cy="19" r="1.3"/><circle cx="14" cy="21.5" r="1.1"/><circle cx="18" cy="21.5" r="1.1"/></g><path d="M16 3c-.6-1.4-.2-2.2.8-2.8" stroke="#4c9a2a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const AMEIXA_SVG = '<svg class="bsv" viewBox="3 2 26 28" aria-hidden="true"><path d="M16 7c-6 0-11 4.5-11 11s5 11 11 11 11-4.5 11-11S22 7 16 7z" fill="#6d2a8f"/><path d="M16 8.5c-.8 4 .8 9 0 19" stroke="#4a1a66" stroke-width="1.2" fill="none"/><ellipse cx="11.5" cy="14" rx="2.6" ry="4" fill="#fff" opacity=".25" transform="rotate(20 11.5 14)"/><path d="M16 7c0-2 1-3.5 2.5-4" stroke="#8a5a2b" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M18.5 4.5c2-1.3 4.2-.9 5 .3-1.6 1.3-3.8 1.3-5-.3z" fill="#4c9a2a"/></svg>', ROMA_SVG = '<svg class="bsv" viewBox="4 1 24 29" aria-hidden="true"><circle cx="16" cy="18" r="11" fill="#c4202e"/><polygon points="11,8.5 12,3.5 14.3,6.5 16,3 17.7,6.5 20,3.5 21,8.5" fill="#8f1420"/><ellipse cx="11" cy="16" rx="2.4" ry="4" fill="#fff" opacity=".22" transform="rotate(20 11 16)"/></svg>', GOIABA_SVG = '<svg class="bsv" viewBox="3 2 26 28" aria-hidden="true"><path d="M16 7c-6 0-11 4.5-11 11s5 11 11 11 11-4.5 11-11S22 7 16 7z" fill="#d96a73"/><ellipse cx="16" cy="19" rx="6" ry="7" fill="#f9d2d4" opacity=".7"/><ellipse cx="11.5" cy="14" rx="2.4" ry="3.6" fill="#fff" opacity=".3" transform="rotate(20 11.5 14)"/><path d="M16 7c0-2 1-3 2.5-3.6" stroke="#6b4a2b" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M18.5 4.2c2-1.2 4.2-.8 5 .4-1.6 1.2-3.8 1.2-5-.4z" fill="#3f8f2a"/></svg>';
const PIM_VERM = '<svg class="bsv" viewBox="4 1 24 29" aria-hidden="true"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#d4262c"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#8f1420" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#3f8f2a" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#3f8f2a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>', PIM_AMAR = '<svg class="bsv" viewBox="4 1 24 29" aria-hidden="true"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#f6c21c"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#b38600" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#3f8f2a" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#3f8f2a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>', PIM_LARA = '<svg class="bsv" viewBox="4 1 24 29" aria-hidden="true"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#f28a1e"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#a85a00" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#3f8f2a" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#3f8f2a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>', ABOBRINHA_SVG = '<svg class="bsv" viewBox="2 2 28 28" aria-hidden="true"><g transform="rotate(-35 16 16)"><rect x="9" y="3" width="14" height="26" rx="7" fill="#3f8a3a"/><path d="M13 6v20M16 5v22M19 6v20" stroke="#8fcf6a" stroke-width="1" opacity=".55"/><rect x="13.5" y="1" width="5" height="4" rx="1.5" fill="#2b6a2a"/></g></svg>';
const CHUCHU_SVG = '<svg class="bsv" viewBox="3 2 26 28" aria-hidden="true"><path d="M16 4c5.5 0 10.5 5 10.5 12 0 5.5-4 10.5-10.5 12-6.5-1.500-10.500-6.500-10.500-12C5.500 9 10.500 4 16 4z" fill="#b9dc8a"/><path d="M16 5c-1.500 7-1.500 15 0 22" stroke="#7fae54" stroke-width="1.300" fill="none"/><path d="M11 10c-1.500 4-1 9 1 13M21 10c1.500 4 1 9-1 13" stroke="#8fbf62" stroke-width=".9" fill="none" opacity=".7"/><ellipse cx="11.500" cy="12" rx="2" ry="3.500" fill="#fff" opacity=".3" transform="rotate(15 11.500 12)"/><path d="M16 4V2" stroke="#6b8f3a" stroke-width="2" stroke-linecap="round"/></svg>';
const CEBOLA_ROXA = '<svg class="bsv" viewBox="3 1 26 29" aria-hidden="true"><path d="M16 3c1 3 1.5 4 4 6 4 2.5 7 6 7 10.5C27 25 22 29 16 29S5 25 5 19.5C5 15 8 11.5 12 9c2.5-2 3-3 4-6z" fill="#8e3b8f"/><path d="M16 6c-3 5-4 14 0 22M12 10c-3 4-3 12 1 17M20 10c3 4 3 12-1 17" stroke="#d9a3d9" stroke-width=".9" fill="none" opacity=".7"/><path d="M16 3.5c-.3-1 .2-1.800 1-2.300" stroke="#8a6a3a" stroke-width="1.500" fill="none" stroke-linecap="round"/></svg>', BATATA_ROXA = '<svg class="bsv" viewBox="3 2 26 28" aria-hidden="true"><g transform="rotate(-35 16 16)"><path d="M16 2c5 1 7.500 6 7.500 13S21 28 16 30c-5-2-7.500-8-7.500-15S11 3 16 2z" fill="#7a3d86"/><path d="M13 7c-1 5-1 12 1 19M19 8c1 4 1 11-1 18" stroke="#b980c4" stroke-width=".9" fill="none" opacity=".7"/><ellipse cx="13.500" cy="11" rx="1.500" ry="3" fill="#fff" opacity=".25"/></g></svg>', BETERRABA_SVG = '<svg class="bsv" viewBox="3 1 26 30" aria-hidden="true"><path d="M16 9C14.500 5.500 12.500 4 10.500 3.500M16 9c1-3.500 3-5.500 6-6" stroke="#3f8f2a" stroke-width="2.200" fill="none" stroke-linecap="round"/><circle cx="16" cy="17.500" r="9.500" fill="#9c1f4f"/><path d="M16 26.500c0 1.800.8 3 2 3.800" stroke="#7a1840" stroke-width="1.800" fill="none" stroke-linecap="round"/><ellipse cx="11.500" cy="14.500" rx="2.200" ry="3.800" fill="#fff" opacity=".25" transform="rotate(20 11.500 14.500)"/></svg>';
const MARACUJA_SVG = '<svg class="bsv" viewBox="3 3 26 26" aria-hidden="true"><circle cx="16" cy="16" r="12.500" fill="#5b2a6a"/><circle cx="16" cy="16" r="10.700" fill="#f1e3b0"/><circle cx="16" cy="16" r="8.200" fill="#f6b21c"/><g fill="#2a1a10"><circle cx="13" cy="13.500" r="1.200"/><circle cx="17.500" cy="12.500" r="1.200"/><circle cx="19.500" cy="16.500" r="1.200"/><circle cx="16" cy="19.500" r="1.200"/><circle cx="12.500" cy="18" r="1.200"/><circle cx="16" cy="15.800" r="1.100"/></g></svg>';
const PIMENTOES_FAN = '<svg class="bsv wide" viewBox="0 0 48 40" aria-hidden="true"><g transform="translate(24 39) rotate(-34) scale(.98) translate(-16 -29)"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#58a83a"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#2f6f1f" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#2f6f1f" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#2f6f1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></g><g transform="translate(24 39) rotate(34) scale(.98) translate(-16 -29)"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#f6c21c"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#b38600" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#2f6f1f" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#2f6f1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></g><g transform="translate(24 39) rotate(0) scale(.98) translate(-16 -29)"><path d="M16 8c-3-2-9-1-10 5-1 7 2 14 7 15 2 .5 3-1 3-1s1 1.5 3 1c5-1 8-8 7-15-1-6-7-7-10-5z" fill="#d4262c"/><path d="M16 8c-2 4-2 14 0 19M12 9c-3 5-2 13 1 18M20 9c3 5 2 13-1 18" stroke="#8f1420" stroke-width=".9" fill="none" opacity=".6"/><path d="M16 8V4" stroke="#2f6f1f" stroke-width="2.4" stroke-linecap="round"/><path d="M13 5.5c1-1.4 5-1.4 6 0" stroke="#2f6f1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></g></svg>';
const BICO = [[/maracuja/,MARACUJA_SVG],[/taiti|tahiti|\blima\b/,"🍋‍🟩"],[/cebola.*roxa|roxa.*cebola/,CEBOLA_ROXA],[/batata.*roxa/,BATATA_ROXA],[/batata doce/,"🍠"],[/beterraba/,BETERRABA_SVG],[/chuchu/,CHUCHU_SVG],[/pimentao.*vermelh/,PIM_VERM],[/pimentao.*amarel/,PIM_AMAR],[/pimentao.*laranja/,PIM_LARA],[/abobrinha|abob (italiana|brasileira|verde)/,ABOBRINHA_SVG],[/gran+y? ?smith|maca verde/,"🍏"],[/\broma\b/,ROMA_SVG],[/ameixa/,AMEIXA_SVG],[/goiaba/,GOIABA_SVG],[/tomate/,"🍅"],[/maca/,"🍎"],[/limao|lima\b/,"🍋"],[/banana/,"🍌"],[/melancia/,"🍉"],[/melao/,"🍈"],[/uva/,"🍇"],[/laranja|tangerina|mexerica|ponkan/,"🍊"],[/morang/,"🍓"],[/abacaxi/,"🍍"],[/mamao|papaya/,MAMAO_SVG],[/manga/,"🥭"],[/pera\b/,"🍐"],[/pessego|nectarina|damasco/,"🍑"],[/cereja/,"🍒"],[/kiwi/,"🥝"],[/coco/,"🥥"],[/abacate/,"🥑"],[/legume|batata|inhame|mandioca|aipim/,"🥔"],[/cenoura/,"🥕"],[/milho/,"🌽"],[/pepino|abobrinha|chuchu/,"🥒"],[/brocol|couve flor/,"🥦"],[/alho/,"🧄"],[/cebola/,"🧅"],[/berinjela/,"🍆"],[/pimentao/,"🫑"],[/pimenta/,"🌶️"],[/cogumelo|champignon/,"🍄"],[/abobora/,"🎃"],[/beterraba/,"🟣"],[/tropical/,"🌴"],[/verdura|folha|alface|couve|rucula|espinafre|repolho|agriao|salsa|cheiro|erva|coentro|cebolinha|hortela/,"🥬"]];
// pacote fechado (ex.: «Tahiti 1kg», «pct 500g», «bandeja»): selo no canto do balão
function pkTag(n) { const s = String(n || ""), m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (m) return `<span class="pk">📦 ${m[1].replace(".", ",")}${m[2].toLowerCase()}</span>`;
  return /\b(pacote|pct|bandeja|saco|caixa|embalad[oa]s?|unid(ade)?s?)\b/i.test(s) ? '<span class="pk">📦</span>' : ""; }
function balIcoTop(w) { return norm(String(w || "")) === "tomate" ? `<span class="bi">🍅</span>` : balIco(w); }   // balão Tomate: ícone de tomate
function balIco(w, fb, soft) { const n = norm(String(w || "")); for (const [re, e] of BICO) if (re.test(n)) return `<span class="bi">${e}</span>`;
  if (fb) return balIco(fb);
  if (soft) return "";
  return `<span class="bi bl">${esc((String(w || "?").trim().charAt(0) || "?").toUpperCase())}</span>`; }
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
$("dT6L").onclick=()=>{ if(window.dEditBal||$("dTop6")._open>=0) return; $("dBalCol").onclick(); };   // tocar no título recolhe/mostra os atalhos
$("dT6L").onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("dT6L").onclick(); } };
$("dBalEdit").onclick=()=>{ window.dEditBal=!window.dEditBal; $("dTop6")._open=-1; dTop6Render(); };
$("dBalAuto").onclick=()=>{ if(!confirm("Voltar aos atalhos automáticos? Os seus atalhos serão apagados.")) return; store.set("validamais-dbal",null); dTop6Render(); };
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
const dIco = n => { const h = balIco(n, null, true); return h ? `<span class="di">${h}</span>` : ""; };   // ícone da fruta na linha lançada
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
async function donationScan(code) {          // pausa a leitura enquanto processa (a câmera contínua pesava o aparelho)
  const s = scanner; let pausou = false;
  try { if (s && !(Date.now() - lastScan.t < 2500 && code === lastScan.c)) { s.pause(false); pausou = true; } } catch {}
  try { return await donationScanRun(code); }
  finally { if (pausou) { setTimeout(() => { try { if (scanner === s) s.resume(); } catch {} }, 350); } }
}
async function donationScanRun(code) {
  const now = Date.now(); if (code === lastScan.c && now - lastScan.t < 2500) return;   // ignora leitura repetida do mesmo código
  lastScan = { c: code, t: now };
  if (nrResolve || qtResolve || pkResolve) return;   // há um cadastro ou uma pergunta aberta
  const names = store.get(NK, {}); let key, unidade, qtd, regd = null, donCod = "", precoTot = 0, notaPeso = "";
  if (isScale(code)) { const s = parseScale(code); key = "B" + s.item; unidade = "kg"; qtd = s.kg; precoTot = s.total || 0;
    if (!(qtd > 0) && !(precoTot > 0)) { sinal("erro"); toast("Etiqueta de balança sem peso legível. Ajuste a configuração 'balanca' no config.js."); return; } }
  else { key = code; unidade = "un"; qtd = 1; }
  let nome = (unidade === "un" && (products.find(p => p.barcode === code) || {}).name) || (unidade === "kg" && (products.find(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(key.slice(1))) || {}).name) || names[key];
  sinal(nome ? "ok" : "novo");
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
  addDon(nome, unidade, qtd, (!scaleLbl && unidade === "un") ? (plu || donCod || code) : "", (!scaleLbl && unidade === "un") ? code : "");
  lastScan.t = Date.now();
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
  $("dSug").innerHTML = list.map(n => `<button type="button" data-sel="${esc(n)}">${balIco(n, null, true)}${esc(n)}</button>`).join("") +
    (exact ? "" : `<button type="button" data-sel="${esc(raw.slice(0, 60))}">＋ Usar «${esc(raw.slice(0, 60))}» como novo produto</button>`);
}
$("dBusca").oninput = dSuggest;
$("dBusca").onkeydown = e => { if (e.key === "Enter") { const b = $("dSug").querySelector("[data-sel]"); if (b) b.click(); } };
$("dSug").onclick = e => { const b = e.target.closest("[data-sel]"); if (b) selectProd(b.dataset.sel); };
const ehUn = n => /^abacaxi|\bunid(ade)?s?\b|\bun\b/.test(norm(n));   // nome que já diz «unidade» é vendido por unidade
const unitOf = n => store.get(UK, {})[norm(n)] || (ehUn(n) ? "un" : "kg");
const uDe = o => store.get(UK, {})[norm(o.n)] || (ehUn(o.n) ? "un" : o.u);
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
function askConfirm({ icon = "⚠️", title, big, bigUnit, text, sub, ok = "Confirmar", cancel = "Cancelar", alt = "", motivos = null, motivo = "", okMap = null, subtitle = "" }) {   // alt: terceira opção (devolve "alt")
  return new Promise(res => {
    if (window.npClose) window.npClose();
    const bg = document.createElement("div"); bg.className = "askbg";
    bg.innerHTML = `<div class="ask" role="alertdialog" aria-modal="true"><div class="ai">${icon}</div><h3>${esc(title)}</h3>` +
      (big ? `<div class="big">${esc(big)} <small>${esc(bigUnit || "")}</small></div>` : "") +
      (text ? `<p><b>${esc(text)}</b></p>` : "") + (subtitle ? `<p class="asub">${esc(subtitle)}</p>` : "") + (motivos ? `<div class="amot" role="radiogroup" aria-label="Motivo">${motivos.map(m => `<button type="button" data-m="${esc(m)}" class="${m === motivo ? "on" : ""}">${esc(m)}</button>`).join("")}</div>` : "") + (sub ? `<p>${esc(sub)}</p>` : "") +
      `<div class="arow"><button type="button" data-a="0">${esc(cancel)}</button><button type="button" class="ok" data-a="1">${esc(ok)}</button></div>` + (alt ? `<button type="button" class="askalt" data-a="2">${esc(alt)}</button>` : "") + `</div>`;
    window.vmMotivo = motivo; const done = v => { bg.remove(); res(v); };
    bg.onclick = e => { const mb = e.target.closest("[data-m]"); if (mb) { window.vmMotivo = mb.dataset.m; bg.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x === mb)); if (okMap) bg.querySelector(".ok").textContent = okMap[mb.dataset.m] || ok; return; } const b = e.target.closest("[data-a]"); if (b) done(b.dataset.a === "2" ? "alt" : b.dataset.a === "1"); else if (e.target === bg) done(null); };
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
  addDon(dSel, dUnit, q, dCodSel, "", meta);
  taraOn = true;   // sem aviso preto: a lista já mostra o item, o +peso e o total
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
$("dLimpar").onclick = () => { if (don.cont) return contCancela(); if (don.itens.length && confirm("Apagar toda a lista da doação atual?")) { const antes = don; don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon();
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

// ---------- revisão de códigos: marca "revisar" (guardada neste aparelho) e aviso de código repetido ----------
const RVK = "validamais-revisar", TNOME = { ean: "EAN", plu: "Balança", doa: "Doação" };
const revOn = n => !!store.get(RVK, {})[norm(n || "")];
function revSet(n, on) { const m = store.get(RVK, {}), k = norm(n || ""); if (!k) return; if (on) m[k] = Date.now(); else delete m[k]; store.set(RVK, m); }
function codMapa() {   // "tipo:código" -> nomes (sem repetir) que usam esse código
  const m = new Map(), add = (t, c, n) => { c = String(c || "").trim(); if (!c) return; if (t === "plu" && /^\d+$/.test(c)) c = String(Number(c)); if (t === "doa") c = c.toUpperCase();
    const k = t + ":" + c; if (!m.has(k)) m.set(k, new Map()); m.get(k).set(norm(n), n); };
  products.forEach(p => { if (!p.name) return; add("ean", p.barcode, p.name); add("plu", p.codigo_balanca, p.name); add("doa", p.codigo_doacao, p.name); });
  return m; }
const codChave = (t, c) => { c = String(c || "").trim(); if (!c) return ""; if (t === "plu" && /^\d+$/.test(c)) c = String(Number(c)); if (t === "doa") c = c.toUpperCase(); return t + ":" + c; };
function repetidosDe(nomes, cods, mapa) {   // nomes: nomes (normalizados) do próprio produto; devolve [{t, c, outros}] dos códigos que outro produto também usa
  const r = [], vistos = new Set(); cods.forEach(([t, c]) => { const k = codChave(t, c); if (!k || vistos.has(k)) return; vistos.add(k);
    const o = [...(mapa.get(k) || new Map())].filter(([nk]) => !nomes.has(nk)).map(([, nm]) => nm); if (o.length) r.push({ t, c: String(c).trim(), outros: o }); });
  return r; }
const dupTxt = l => l.map(d => `${TNOME[d.t]} ${d.c} também em ${d.outros.slice(0, 3).join(", ")}${d.outros.length > 3 ? " +" + (d.outros.length - 3) : ""}`).join(" · ");
function dupLabel(l, mapa) {   // etiqueta: o código mostrado também é de outro produto (no cadastro ou em outra etiqueta da lista)?
  const t = l.kg ? "plu" : "ean", c = l.orig || l.code; if (!c) return [];
  const r = repetidosDe(new Set([norm(l.nome)]), [[t, c]], mapa || codMapa()), outros = new Set(r.flatMap(x => x.outros));
  labels.forEach(o => { if (o !== l && !l.dup && !o.dup && (o.orig || o.code) === c && norm(o.nome) !== norm(l.nome)) outros.add(o.nome); });
  return outros.size ? [{ t, c, outros: [...outros] }] : []; }
function dupGrupo(x, mapa) {   // cadastro: algum código (EAN, balança, doação) também é de outro produto?
  const nomes = new Set(x.l.map(r => norm(r.name))), cods = []; x.l.forEach(r => cods.push(["ean", r.barcode], ["plu", r.codigo_balanca], ["doa", r.codigo_doacao]));
  const r = repetidosDe(nomes, cods, mapa);
  return r; }
function filtBar(el, ativo, nRev, nDup) {
  el.hidden = !ativo && !nRev && !nDup;
  el.innerHTML = el.hidden ? "" : `<button type="button" class="fpill${ativo === "rev" ? " on" : ""}" data-f="rev">🚩 Revisar <b>${nRev}</b></button><button type="button" class="fpill${ativo === "dup" ? " on" : ""}" data-f="dup">⚠ Repetidos <b>${nDup}</b></button>`; }
// ---------- aba Cadastros: cadastrar e editar produtos digitando (EAN até 13 dígitos) ----------
let cadEdit = null, cFiltro = "";
try { indexedDB.deleteDatabase("validamais-fotos-kor"); } catch (e) {}   // recurso de foto removido: apaga o que ficou guardado neste aparelho
   // chave do produto em edição
const cadKey = p => p.barcode ? "b" + p.barcode + "|" + norm(p.name || "") : "n" + norm(p.name || "");   // mesmo EAN com nomes diferentes = produtos diferentes (linhas separadas)
function cadGroups() { const m = new Map(); products.forEach(p => { if (!p.name) return; const k = cadKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return [...m.entries()].map(([k, l]) => ({ k, l, p: l[0], name: l[0].name, barcode: l.map(x => x.barcode).find(Boolean) || "", plu: l.map(x => x.codigo_balanca).find(Boolean) || "", don: l.map(x => x.codigo_doacao).find(Boolean) || "" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); }
function cadPaint() {
  const q = norm($("cBusca").value.trim()), all = cadGroups(), mapa = codMapa();
  all.forEach(x => { x.dup = dupGrupo(x, mapa); x.rev = revOn(x.name); });
  filtBar($("cFilt"), cFiltro, all.filter(x => x.rev).length, all.filter(x => x.dup.length).length);
  const g = all.filter(x => !q || norm(x.name).includes(q) || x.barcode.includes(q) || x.plu === q || x.don.toLowerCase() === q).filter(x => !cFiltro || (cFiltro === "rev" ? x.rev : x.dup.length));
  lixoBtn(); $("cCount").textContent = all.length + (q ? " · " + g.length + " achados" : "");
  const ini = x => { const c = x.name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  let ult = "", letras = [];
  const row = x => `<div class="cadrow${x.rev ? " rv" : ""}"><div class="ci"><b>${esc(x.name)}</b><small>EAN ${x.barcode ? esc(x.barcode) : "—"}${SETOR === KOR ? "" : ` · PLU ${x.plu ? esc(x.plu) : "—"} · ${SETOR === PER ? "Interno" : "Doação"} ${x.don ? esc(x.don) : "—"}`}</small>${PERFIL === "Admin" ? `<small class="porx">👤 ${esc(x.l.map(l => l.por).find(Boolean) || "autor não registrado")} · ${dayOf(x.l[0])}</small>` : ""}${x.dup.length ? `<small class="duptxt">⚠ ${esc(dupTxt(x.dup))}</small><button type="button" class="dpres" data-cres="${esc(x.k)}">Resolver código repetido</button>` : ""}</div><button type="button" class="crev${x.rev ? " on" : ""}" data-crev="${esc(x.k)}" aria-label="${x.rev ? "Tirar a marca de revisar" : "Marcar para revisar"}: ${esc(x.name)}" aria-pressed="${x.rev ? "true" : "false"}">🚩</button><button class="secondary" data-ced="${esc(x.k)}">Editar</button><button class="cdel" data-cdel="${esc(x.k)}" aria-label="Excluir ${esc(x.name)}">✕</button></div>`;
  $("cLista").innerHTML = g.length ? g.map(x => { const l = ini(x); let h = ""; if (l !== ult) { ult = l; letras.push(l); h = `<div class="cadlt" id="cl-${l === "#" ? "num" : l}">${l}</div>`; } return h + row(x); }).join("") : '<p class="empty">Nenhum produto encontrado.</p>';
  const rail = $("cIdx"); rail.hidden = g.length < 12 || letras.length < 2; $("cLista").classList.toggle("cadidx", !rail.hidden);
  rail.innerHTML = rail.hidden ? "" : letras.map(l => `<button type="button" tabindex="-1" data-l="${l}">${l}</button>`).join("");
}
function cadPula(l) { const e = $("cl-" + (l === "#" ? "num" : l)); if (!e) return; const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 0;
  window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - h - 4); }
(function () { const r = $("cIdx"); let ativo = false;
  const letraEm = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest && e.closest("#cIdx button") ? e.closest("#cIdx button").dataset.l : null; };
  r.addEventListener("pointerdown", ev => { ativo = true; try { r.setPointerCapture(ev.pointerId) } catch (e) {} const l = letraEm(ev.clientX, ev.clientY); if (l) cadPula(l); ev.preventDefault(); });
  r.addEventListener("pointermove", ev => { if (!ativo) return; const l = letraEm(ev.clientX, ev.clientY); if (l) cadPula(l); });
  const fim = () => { ativo = false; }; r.addEventListener("pointerup", fim); r.addEventListener("pointercancel", fim); })();
function korMarca(nomes, on) {
  const upd = {}; nomes.forEach(n => { const k = korChave({ name: n }); if (k) upd[k] = on ? 1 : 0; });
  if (!Object.keys(upd).length) return;
  korSet = { ...korSet, ...upd }; try { localStorage.setItem(KORK, JSON.stringify(korSet)); } catch (e) {}
  if (db) { korNuvem = { ...(korNuvem || {}), ...upd }; V.setDoc(V.doc(db, "sh_cfg", "korin"), { m: upd }, { merge: true }).catch(e => { console.warn(e); toast("Itens do KÓRIN salvos só neste aparelho (a nuvem recusou)."); }); }
  const todos = db ? rawAll : products.concat(lixeira, outros); separaLixo(todos); lixoBtn(); render(); try { cadPaint(); kPaint(); } catch (e) {}
}
function korEscolher() {
  const todos = (db ? rawAll : products.concat(lixeira, outros)).filter(p => p.name && !p.lixo && setorDe(p) === "FLV"), m = new Map();
  todos.forEach(p => { const k = korChave(p); if (k && !m.has(k)) m.set(k, p.name); });
  const atual = korMapa(), vazio = !Object.values(atual).some(Boolean), dica = new Set();
  if (vazio) { [KCK, KRK].forEach(k => store.get(k, []).forEach(i => dica.add(norm(i.n)))); store.get(KBK, []).forEach(b => b.itens.forEach(i => dica.add(norm(i.n)))); store.get(KRH, []).forEach(r => r.itens.forEach(i => dica.add(norm(i.n)))); }
  const sel = new Set([...m.keys()].filter(k => atual[k] || dica.has(k)));
  const itens = [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR", { sensitivity: "base" }));
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "korEscModal";
  const paint = () => { const q = norm(bg.querySelector("#kqBusca") ? bg.querySelector("#kqBusca").value : ""), y = bg.querySelector(".kqlist") ? bg.querySelector(".kqlist").scrollTop : 0;
    const vis = itens.filter(([k, n]) => !q || k.includes(q));
    bg.querySelector(".kqlist").innerHTML = vis.length ? vis.map(([k, n]) => `<label class="kqrow"><input type="checkbox" data-k="${esc(k)}"${sel.has(k) ? " checked" : ""}><span>${esc(n)}</span></label>`).join("") : '<p class="note">Nada encontrado.</p>';
    bg.querySelector("#kqN").textContent = sel.size + " marcado" + (sel.size === 1 ? "" : "s"); bg.querySelector(".kqlist").scrollTop = y; };
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Itens do KÓRIN"><div class="sheethead"><h2>🗂️ Itens do KÓRIN</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note">Marque os produtos que são do KÓRIN. Só eles aparecem aqui e saem do FLV.${vazio && dica.size ? " Já marquei os que aparecem nas suas contagens." : ""}</p>
    <input id="kqBusca" type="search" placeholder="Buscar produto" autocomplete="off" style="width:100%;box-sizing:border-box"><div class="kqlist"></div>
    <div class="toolbar" style="margin-top:10px"><button type="button" class="primary big" id="kqSalva">Salvar <span id="kqN"></span></button></div></section>`;
  document.body.appendChild(bg); paint();
  bg.querySelector("#kqBusca").oninput = paint;
  bg.onchange = e => { const c = e.target.closest("[data-k]"); if (c) { c.checked ? sel.add(c.dataset.k) : sel.delete(c.dataset.k); bg.querySelector("#kqN").textContent = sel.size + " marcado" + (sel.size === 1 ? "" : "s"); } };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) { bg.remove(); return; }
    if (e.target.closest("#kqSalva")) { const on = [], off = []; m.forEach((n, k) => { const era = !!atual[k], ficou = sel.has(k); if (ficou && !era) on.push(n); else if (!ficou && era) off.push(n); }); bg.remove(); if (on.length) korMarca(on, true); if (off.length) korMarca(off, false); toast("✓ " + sel.size + " itens do KÓRIN."); } };
}
$("cKorEsc").onclick = korEscolher;
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
    if (SETOR === KOR && mine[0] && norm(mine[0].name) !== norm(name)) { const antigo = mine[0].name; setTimeout(() => { korMarca([antigo], false); korMarca([name], true); }, db ? 700 : 0); }
    toast("Cadastro atualizado.");
  } else {
    const rec = { ...f, category: CATSET, expiry: "", quantity: 1, por: myName() };
    if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...rec, createdAt: ts, updatedAt: ts }).catch(fail); }
    else { products.push({ ...rec, id: uid(), updatedAt: Date.now() }); persist(); render(); }
    if (SETOR === KOR) korMarca([name], true);
    toast("«" + name + "» cadastrado.");
  }
  cadReset(); setTimeout(cadPaint, db ? 600 : 0);
};
$("cFilt").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; cFiltro = cFiltro === b.dataset.f ? "" : b.dataset.f; cadPaint(); };
$("cLista").onclick = e => { const b = e.target.closest("[data-ced],[data-cdel],[data-crev],[data-cres]"); if (!b) return;
  if (b.dataset.cres !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.cres); if (x) dupResolver(x); return; }
  if (b.dataset.crev !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.crev); if (!x) return; const on = !revOn(x.name); revSet(x.name, on); cadPaint(); toast(on ? "Marcado para revisar." : "Marca de revisão removida."); return; }
  if (b.dataset.ced !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.ced); if (x) cadAbrir(x); return; }
  const x = cadGroups().find(y => y.k === b.dataset.cdel); if (x) cadExcluir(x); };
function cadAbrir(x) { cadEdit = x.k;
  $("cNome").value = x.name; $("cEan").value = x.barcode; $("cPlu").value = x.plu; $("cDon").value = x.don; $("cEanN").textContent = x.barcode.length + "/13";
  $("cTitulo").textContent = "Editando cadastro"; $("cSalvar").textContent = "Salvar alterações"; $("cCancela").hidden = false; window.scrollTo(0, 0); }
function cadApagar(x) {   // manda o cadastro e todos os lotes para a lixeira (3 dias) e tira a marca de revisar
  const agora = Date.now();
  x.l.forEach(p => { if (db) V.updateDoc(V.doc(db, "products", p.id), { lixo: agora, updatedAt: V.serverTimestamp() }).catch(() => {
    // as regras da nuvem não aceitam o campo "lixo": guarda uma cópia neste aparelho e apaga na nuvem
    const { id, ...dados } = p; const cp = { ...dados, id, lixo: agora }; delete cp.updatedAt; delete cp.createdAt;
    lixoLocalGravar(lixoLocalLer().concat([cp]));
    V.deleteDoc(V.doc(db, "products", id)).catch(() => toast("Não foi possível excluir."));
  }); });
  if (!db) { x.l.forEach(p => { p.lixo = agora; }); lixeira = lixeira.concat(x.l); products = products.filter(p => !x.l.includes(p)); persist(); render(); lixoBtn(); }
  if (!products.some(p => p.name && norm(p.name) === norm(x.name) && !x.l.includes(p))) revSet(x.name, false);
  if (cadEdit === x.k) cadReset(); }
function lixoBtn() { const b = $("cLixo"); if (!b) return; b.hidden = !lixeira.length; b.textContent = "🗑 Lixeira (" + lixoGrupos().length + ")"; }
function lixoGrupos() {
  const m = new Map(); lixeira.forEach(p => { const k = norm(p.name || "") + "|" + (p.barcode || ""); const g = m.get(k) || { k, name: p.name || "(sem nome)", barcode: p.barcode || "", l: [], t: 0 }; g.l.push(p); g.t = Math.max(g.t, Number(p.lixo) || 0); m.set(k, g); });
  return [...m.values()].sort((a, b) => b.t - a.t);
}
function lixoRestaurar(g) {
  if (db) g.l.forEach(p => {
    if (p.loc) { const { id, lixo, loc, ...d } = p; const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...d, createdAt: ts, updatedAt: ts }).then(() => lixoLocalGravar(lixoLocalLer().filter(q => q.id !== id))).catch(() => toast("Não foi possível restaurar.")); }
    else V.updateDoc(V.doc(db, "products", p.id), { lixo: V.deleteField(), updatedAt: V.serverTimestamp() }).catch(() => toast("Não foi possível restaurar.")); });
  else { g.l.forEach(p => { delete p.lixo; }); lixeira = lixeira.filter(p => !g.l.includes(p)); products = products.concat(g.l); persist(); render(); }
}
function lixoApagar(g) {
  if (db) g.l.forEach(p => { if (p.loc) lixoLocalGravar(lixoLocalLer().filter(q => q.id !== p.id)); else V.deleteDoc(V.doc(db, "products", p.id)).catch(() => toast("Não foi possível excluir.")); });
  else { lixeira = lixeira.filter(p => !g.l.includes(p)); persist(); }
}
function lixoAbrir() {
  if (!lixeira.length) { toast("A lixeira está vazia."); return; }
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "lixoModal";
  const desenha = () => { const gs = lixoGrupos();
    bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Lixeira"><div class="sheethead"><h2>🗑 Lixeira</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
      <p class="note">Cadastros excluídos ficam aqui por <b>3 dias</b>. Depois somem de vez.</p>
      ${gs.map((g, i) => { const dias = Math.max(1, Math.ceil((g.t + LIXO_MS - Date.now()) / 864e5));
        return `<div class="dprow"><b>${esc(g.name)}</b><small>${g.barcode ? "EAN " + esc(g.barcode) + " · " : ""}${g.l.length > 1 ? g.l.length + " lotes · " : ""}some em ${dias} dia${dias > 1 ? "s" : ""}</small>
        <div class="dpbtns"><button type="button" class="primary" data-rest="${i}">Restaurar</button><button type="button" class="secondary" data-del="${i}">Excluir de vez</button></div></div>`; }).join("") || '<p class="note">Lixeira vazia.</p>'}</section>`; return gs; };
  let gs = desenha(); document.body.appendChild(bg);
  const fecha = () => { bg.remove(); setTimeout(() => { lixoBtn(); cadPaint(); }, db ? 600 : 0); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return fecha();
    const b = e.target.closest("[data-rest],[data-del]"); if (!b) return; const g = gs[Number(b.dataset.rest ?? b.dataset.del)]; if (!g) return;
    if (b.dataset.rest !== undefined) { lixoRestaurar(g); toast("«" + g.name + "» restaurado."); }
    else { if (!confirm(`Excluir «${g.name}» de vez?\n\nIsto não pode ser desfeito.`)) return; lixoApagar(g); toast("Excluído de vez."); }
    lixeira = lixeira.filter(p => !g.l.includes(p)); gs = desenha(); if (!gs.length) fecha(); }; }
function cadExcluir(x) {
  if (!confirm(`Excluir «${x.name}»${x.l.length > 1 ? " e seus " + x.l.length + " lotes" : ""}?\n\nFica 3 dias na lixeira, onde dá para restaurar.`)) return false;
  cadApagar(x); toast("Cadastro enviado para a lixeira."); setTimeout(cadPaint, db ? 600 : 0); return true; }
// código repetido: mostra todos os produtos que usam o código e deixa escolher onde ele fica
const CAMPO = { ean: "barcode", plu: "codigo_balanca", doa: "codigo_doacao" };
function dupResolver(x) {
  const mapa = codMapa(), dups = dupGrupo(x, mapa); if (!dups.length) { toast("Esse código não está mais repetido."); return; }
  const d = dups[0], campo = CAMPO[d.t], chave = codChave(d.t, d.c), nomes = new Set([x.name, ...d.outros].map(norm));
  const itens = cadGroups().filter(g => nomes.has(norm(g.name)) && g.l.some(r => codChave(d.t, r[campo]) === chave));
  if (itens.length < 2) { toast("Esse código não está mais repetido."); return; }
  const linha = g => `<div class="dprow" data-g="${esc(g.k)}"><b>${esc(g.name)}</b><small>EAN ${g.barcode ? (d.t === "ean" ? `<mark>${esc(g.barcode)}</mark>` : esc(g.barcode)) : "—"} · PLU ${g.plu ? (d.t === "plu" ? `<mark>${esc(g.plu)}</mark>` : esc(g.plu)) : "—"} · Doação ${g.don ? (d.t === "doa" ? `<mark>${esc(g.don)}</mark>` : esc(g.don)) : "—"}</small>
    <div class="dpbtns"><button type="button" class="primary" data-keep="${esc(g.k)}">Manter este e excluir os outros</button><button type="button" class="secondary" data-edit="${esc(g.k)}">Editar</button><button type="button" class="secondary" data-del="${esc(g.k)}">Excluir</button></div></div>`;
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "dupModal";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Código repetido"><div class="sheethead"><h2>${TNOME[d.t]} ${esc(d.c)} repetido</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note">Este código está em ${itens.length} produtos. Escolha qual cadastro fica: <b>os outros são excluídos</b> (com os lotes deles).${dups.length > 1 ? ` Este produto tem mais ${dups.length - 1} código(s) repetido(s).` : ""}</p>${itens.map(linha).join("")}</section>`;
  document.body.appendChild(bg);
  const fecha = () => { bg.remove(); setTimeout(cadPaint, db ? 600 : 0); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return fecha();
    const k = (e.target.closest("[data-keep],[data-edit],[data-del]") || {}).dataset; if (!k) return;
    const find = id => itens.find(g => g.k === id);
    if (k.keep !== undefined) { const fica = find(k.keep), fora = itens.filter(g => g !== fica);
      if (!confirm(`Manter «${fica.name}» e EXCLUIR ${fora.length > 1 ? "estes " + fora.length + " cadastros" : "este cadastro"}?\n\n${fora.map(g => "• " + g.name + (g.l.length > 1 ? " (" + g.l.length + " lotes)" : "")).join("\n")}\n\nFicam 3 dias na lixeira, onde dá para restaurar.`)) return;
      fora.forEach(cadApagar); toast(fora.length > 1 ? fora.length + " cadastros excluídos. Ficou «" + fica.name + "»." : "Cadastro excluído. Ficou «" + fica.name + "»."); return fecha(); }
    if (k.edit !== undefined) { const g = find(k.edit); bg.remove(); cadAbrir(g); return; }
    if (k.del !== undefined) { const g = find(k.del); if (cadExcluir(g)) bg.remove(); } }; }
$("navCadastros").addEventListener("click", cadPaint);
if ($("cLixo")) $("cLixo").onclick = lixoAbrir;
// ---------- Cadastros: preencher o código lendo com a câmera ----------
async function cadScan(code) {
  stopScanner(); closeModal();
  const d = String(code).replace(/\D/g, "");
  sinal(!d || (!isScale(d) && d.length > 13) || (!isScale(d) && !cadEdit && products.some(p => p.barcode === d)) ? "erro" : "ok");
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
// ---------- continuar uma doação anterior: abre o lançamento na tela normal de doação e, ao finalizar, atualiza o mesmo lançamento ----------
function romContinuar() {
  if (!curRom) return; if (!hid(curRom) && !(db && curRom._id)) return toast("Aguarde o salvamento da doação e tente de novo.");
  if (don.cont) return toast("Já há uma doação anterior em continuação. Finalize ou cancele primeiro.");
  const pausa = don.itens.length ? { itens: don.itens, inicio: don.inicio } : null;
  don = { itens: curRom.itens.map(i => ({ key: norm(i.nome) + "|" + i.unidade, nome: i.nome, unidade: i.unidade, qtd: i.qtd, lanc: i.lanc || 1, cod: i.cod || "" })), inicio: new Date().toISOString(), cont: { id: hid(curRom), _id: curRom._id || "", data: curRom.data }, pausa };
  store.set(DK, don); $("donaRomaneio").classList.add("hidden"); $("donaEntrada").classList.remove("hidden"); try { if (typeof dView === "function") dView("lista"); } catch (e) {}
  renderDon(); window.scrollTo(0, 0); toast(`Doação de ${dataBR(curRom.data)} aberta: pode acrescentar itens.`);
}
function contCancela() {
  if (!don.cont || !confirm(`Cancelar a continuação da doação de ${dataBR(don.cont.data)}? O que você acrescentou agora será descartado (a doação original fica como estava).`)) return;
  const p = don.pausa; don = p ? { itens: p.itens, inicio: p.inicio } : { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon(); toast("Continuação cancelada.");
}
function finalizaCont() {
  logAtv("doação", `continuou uma doação anterior (+ itens)`);
  const c = don.cont, itens = don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" })).sort(byName);
  const tot = u => Math.round(itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0) * 1000) / 1000, campos = { itens, totalKg: tot("kg"), totalUn: tot("un"), editada: true };
  const ant = (curRom && hid(curRom) === c.id ? curRom : null) || histList.find(x => hid(x) === c.id) || {}, rec = { ...ant, data: c.data, ...campos, _id: c._id || ant._id };
  const local = () => { const m = store.get(EDK, {}); if (c._id) { m[c._id] = campos; store.set(EDK, m); } };
  if (db && c._id) V.updateDoc(V.doc(db, "doacoes", c._id), campos).catch(err => { console.error(err); local(); toast("Salvo só neste aparelho: o Firebase não permitiu alterar a doação na nuvem."); });
  else { const l = store.get(HK, []), y = l.find(z => String(z.em) === c.id); if (y) { Object.assign(y, campos); store.set(HK, l); } }
  const p = don.pausa; don = p ? { itens: p.itens, inicio: p.inicio } : { itens: [], inicio: new Date().toISOString() }; store.set(DK, don);
  renderDon(); showRomaneio(rec); if (!db) reloadLocalHist(); renderTop(); toast(`Doação de ${dataBR(c.data)} atualizada.`);
}
$("rCont").onclick = romContinuar; $("dContX").onclick = contCancela;
function finalizeDon() {
  if (don.cont) return finalizaCont();
  logAtv("doação", `${don.itens.length} item(ns) lançado(s)`);
  const rec = { data: iso(new Date()), por: myName().slice(0, 40), totalKg: Math.round(sumU("kg") * 1000) / 1000, totalUn: Math.round(sumU("un") * 1000) / 1000,
    itens: don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc, cod: cod || "" })).sort(byName) };
  if (db) V.addDoc(V.collection(db, "doacoes"), { ...rec, em: V.serverTimestamp() }).then(r => { rec._id = r.id; }).catch(e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras). O romaneio foi gerado."); });
  else { const hh = store.get(HK, []), em = Date.now(); rec.em = em; hh.unshift({ ...rec }); store.set(HK, hh.slice(0, 50)); }
  don = { itens: [], inicio: new Date().toISOString() }; store.set(DK, don); renderDon(); showRomaneio(rec); renderTop();
  setTimeout(doaFesta, 150);
}
// confete dourado ao finalizar a doação: um jato curto sai do TOTAL do romaneio e o total dá um pequeno pulo (some com "reduzir movimento")
function doaFesta() {
  try {
    const alvo = document.querySelector("#romBody .romtotal"); if (!alvo || !alvo.animate || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const r = alvo.getBoundingClientRect(), ox = Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2)), oy = Math.min(innerHeight - 90, Math.max(90, r.top + r.height / 2));
    const cores = ["#f3d87a", "#e5c158", "#c9a227", "#fff6cf", "#b8860b"], box = document.createElement("div");
    box.setAttribute("aria-hidden", "true"); Object.assign(box.style, { position: "fixed", left: "0", top: "0", width: "0", height: "0", zIndex: 130, pointerEvents: "none" });
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 34; i++) {
      const p = document.createElement("i"), ang = rnd(-165, -15) * Math.PI / 180, dist = rnd(140, 320), dur = rnd(1000, 1600), g = rnd(110, 200), w = rnd(5, 9), redondo = Math.random() < .3;
      Object.assign(p.style, { position: "absolute", left: ox + "px", top: oy + "px", width: w + "px", height: (redondo ? w : w * rnd(1.4, 2.2)) + "px", background: cores[i % cores.length], borderRadius: redondo ? "50%" : "2px", opacity: "0" });
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, giro = rnd(-540, 540), fr = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; fr.push({ offset: t, opacity: t < .08 ? t / .08 : t > .7 ? Math.max(0, 1 - (t - .7) / .3) : 1,
        transform: `translate(${(dx * t).toFixed(1)}px,${(dy * Math.sqrt(t) * (1 - t * .15) + g * t * t).toFixed(1)}px) rotate(${(giro * t).toFixed(0)}deg)` }); }
      p.animate(fr, { duration: dur, delay: rnd(0, 120), easing: "cubic-bezier(.2,.7,.4,1)", fill: "both" }); box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 1900);
    alvo.animate([{ transform: "scale(1)", textShadow: "0 0 0 rgba(229,193,88,0)" }, { transform: "scale(1.14)", textShadow: "0 0 18px rgba(229,193,88,.9)", offset: .35 }, { transform: "scale(1)", textShadow: "0 0 0 rgba(229,193,88,0)" }], { duration: 560, delay: 120, easing: "cubic-bezier(.3,1.4,.5,1)" });
  } catch (_) {}
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
 $("tbPesaveis").onclick = () => go("Pesaveis");
 $("navLoja").onclick = () => go("Loja"); $("navContagem").onclick = () => go("Contagem"); $("navDoacao").onclick = () => go("Doacao"); $("navEtiquetas").onclick = () => go("Etiquetas"); $("navInventario").onclick = () => go("Inventario"); $("navCadastros").onclick = () => go("Cadastros"); $("dScan").onclick = () => openScan("doacao");
// ----- top 3 mais doados (últimos 30 dias, compacto) -----
let topDb = [];
// recalcula os balões «Mais doados» (o painel antigo de top 3 foi removido)
function renderTop() { try { dTop6Render(); } catch (e) {} }
if (db) V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(40)), s => { topDb = s.docs.map(d => withEdits({ ...d.data(), _id: d.id })); renderTop(); }, console.error);
renderDon(); renderKey(); renderTop();
// ---------- contagem do KÓRIN: lista de produtos e quantidades, enviada por WhatsApp (texto) ou PDF ----------
const KCK = "validamais-contagem-kor";
let kList = store.get(KCK, []), kPick = null;   // kPick: produto escolhido {n, b} esperando a quantidade
const KRK = "validamais-korin-rec-aberto", KBK = "validamais-korin-base", KRH = "validamais-korin-rec-hist";
let kModo = "cont";   // cont = contagem do estoque · rec = recebimento (chegou mercadoria) · vend = comparação
const kSave = () => store.set(kModo === "rec" ? KRK : KCK, kList);
const kOrd = () => kList.slice().sort((a, b) => a.n.localeCompare(b.n, "pt-BR", { sensitivity: "base" }) || a.u.localeCompare(b.u));
const kTot = () => { const m = {}; kList.forEach(i => { m[i.u] = (m[i.u] || 0) + i.q; }); return Object.keys(m).map(u => fq(m[u]) + " " + u).join(" · ") || "0"; };
function kPaint() {
  $("kSumP").textContent = kList.length; $("kSumT").textContent = kTot();
  $("kLista").innerHTML = kList.length ? kOrd().map(i => `<div class="krow"><div class="kn"><b>${esc(i.n)}</b>${i.b ? `<small>EAN ${esc(i.b)}</small>` : ""}</div><button type="button" class="kq" data-ked="${esc(i.n)}|${i.u}">${fq(i.q)} ${esc(i.u)}</button><button type="button" class="kx" data-kdel="${esc(i.n)}|${i.u}" aria-label="Remover ${esc(i.n)}">✕</button></div>`).join("") : '<p class="empty">${SETOR === KOR && !products.length ? "Nenhum item do KÓRIN ainda. Em Cadastros, toque em «Escolher itens do KÓRIN»." : "Nada contado ainda."}</p>';
}
function kEscolhe(p) { kPick = p; $("kSel").hidden = !p; $("kSug").innerHTML = ""; if (!p) return; $("kBusca").value = ""; $("kSelNome").textContent = p.n; $("kQtd").value = ""; $("kQtd").focus(); }
function kSug() {
  const q = norm($("kBusca").value.trim()); if (!q) { $("kSug").innerHTML = ""; return; }
  const hits = cadGroups().filter(x => norm(x.name).includes(q) || x.barcode.includes(q)).slice(0, 8);
  $("kSug").innerHTML = hits.map((x, i) => `<div class="pick" data-kp="${i}"><b>${esc(x.name)}</b>${x.barcode ? ` <small class="muted">${esc(x.barcode)}</small>` : ""}</div>`).join("") + `<div class="pick" data-kp="novo">➕ Usar «${esc($("kBusca").value.trim())}» sem cadastro</div>`;
  $("kSug")._hits = hits; }
$("kBusca").oninput = kSug;
$("kBusca").onkeydown = e => { if (e.key === "Enter") { const b = $("kSug").querySelector("[data-kp]"); if (b) b.click(); } };
$("kSug").onclick = e => { const b = e.target.closest("[data-kp]"); if (!b) return; const nome = $("kBusca").value.trim().replace(/\s+/g, " ");
  if (b.dataset.kp === "novo") { if (nome) kEscolhe({ n: nome, b: "" }); return; }
  const x = ($("kSug")._hits || [])[Number(b.dataset.kp)]; if (x) kEscolhe({ n: x.name, b: x.barcode || "" }); };
function kAdd() {
  if (!kPick) return toast("Escolha o produto primeiro.");
  const q = Math.round(Number(String($("kQtd").value).replace(",", ".")) * 1000) / 1000, u = $("kUn").value;
  if (!(q > 0)) { toast("Digite a quantidade."); return $("kQtd").focus(); }
  const ja = kList.find(i => norm(i.n) === norm(kPick.n) && i.u === u);
  if (ja) { ja.q = Math.round((ja.q + q) * 1000) / 1000; toast("Somado: «" + ja.n + "» agora tem " + fq(ja.q) + " " + u + "."); } else { kList.push({ n: kPick.n, b: kPick.b, q, u }); }
  kSave(); kEscolhe(null); kPaint(); $("kBusca").focus(); }
$("kAdd").onclick = kAdd; $("kCancela").onclick = () => kEscolhe(null);
$("kQtd").onkeydown = e => { if (e.key === "Enter") kAdd(); };
$("kLista").onclick = e => { const d = e.target.closest("[data-kdel]"), ed = e.target.closest("[data-ked]"); const chave = (d || ed || {}).dataset; if (!chave) return;
  const [n, u] = (d ? d.dataset.kdel : ed.dataset.ked).split("|"); const i = kList.findIndex(x => x.n === n && x.u === u); if (i < 0) return;
  if (d) { const it = kList.splice(i, 1)[0]; kSave(); kPaint(); toast("«" + it.n + "» removido.", "Desfazer", () => { kList.splice(Math.min(i, kList.length), 0, it); kSave(); kPaint(); }); return; }
  const v = prompt("Quantidade de «" + n + "» (" + u + ")", String(kList[i].q).replace(".", ",")); if (v === null) return;
  const q = Math.round(Number(String(v).replace(",", ".")) * 1000) / 1000; if (!(q > 0)) return toast("Quantidade inválida."); kList[i].q = q; kSave(); kPaint(); };
$("kLimpa").onclick = () => { if (!kList.length) return; if (!confirm("Limpar toda a contagem?")) return; kList = []; kSave(); kPaint(); };
// ----- recebimento e vendas do KÓRIN: tinha (estoque de referência) + chegou (recebimentos) − agora (contagem atual) = vendeu -----
const kChave = i => norm(i.n) + "|" + i.u;
const kD = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const kDM = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const kQ = t => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function kModoSet(m) {
  kModo = m; kList = store.get(m === "rec" ? KRK : KCK, []); kEscolhe(null);
  document.querySelectorAll("#kModo [data-m]").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  const vend = m === "vend"; $("kEntrada").hidden = vend; $("kListaBox").hidden = vend; $("kVend").hidden = !vend;
  $("kTitulo").textContent = m === "rec" ? "Abastecimento · KÓRIN" : "Contagem · KÓRIN";
  $("kNota").textContent = m === "rec" ? "Vai abastecer a loja? Busque o produto (ou bipe), digite quanto vai colocar e adicione. Ao terminar, toque em Fechar abastecimento." : "Busque o produto (ou bipe), digite a quantidade e adicione. Depois envie a lista.";
  $("kBase").hidden = m !== "cont"; $("kFecha").hidden = m !== "rec"; $("kLimpa").textContent = m === "rec" ? "Limpar abastecimento" : "Limpar contagem";
  kPaint(); if (vend) kVendPaint(); }
$("kModo").onclick = e => { const b = e.target.closest("[data-m]"); if (b) kModoSet(b.dataset.m); };
$("kBase").onclick = () => { if (!kList.length) return toast("Conte o estoque primeiro.");
  if (!confirm("Salvar esta contagem (" + kList.length + " produtos) como o «ANTES»? A lista será zerada para você contar o que tem hoje.")) return;
  const b = store.get(KBK, []); b.unshift({ id: uid().slice(0, 8), t: Date.now(), por: kNome(), itens: kList.map(i => ({ ...i })) }); store.set(KBK, b.slice(0, 12)); kList = []; kSave(); kPaint(); toast("📌 Salvo como «antes». A lista foi zerada: agora conte o que tem na loja hoje."); };
$("kFecha").onclick = () => { if (!kList.length) return toast("Nada para abastecer ainda.");
  if (!confirm("Fechar este abastecimento (" + kList.length + " produtos)? Ele entra na conta das vendas.")) return;
  const h = store.get(KRH, []); h.unshift({ id: uid().slice(0, 8), t: Date.now(), por: kNome(), itens: kList.map(i => ({ ...i })) }); store.set(KRH, h.slice(0, 40));
  kList = []; kSave(); kPaint(); toast("✔ Abastecimento guardado. Veja em Vendas."); };
function kCalc(base) {
  const todos = store.get(KRH, []), rec = todos.filter(r => r.t > base.t || kInc.has(r.id)), velhos = todos.filter(r => r.t <= base.t && !kInc.has(r.id)), atual = store.get(KCK, []), m = new Map();
  const ent = i => { const k = kChave(i); return m.get(k) || (m.set(k, { n: i.n, u: i.u, b: i.b || "", tinha: 0, chegou: 0, agora: 0, contado: false }), m.get(k)); };
  base.itens.forEach(i => { ent(i).tinha += i.q; }); rec.forEach(r => r.itens.forEach(i => { ent(i).chegou += i.q; })); atual.forEach(i => { const e = ent(i); e.agora += i.q; e.contado = true; });
  const depois = kDepois(), r3 = x => Math.round(x * 1000) / 1000;   // depois: a contagem de hoje já inclui o que abasteci · antes: abasteço depois de contar
  const rows = [...m.values()].map(e => ({ ...e, vendeu: r3(depois ? e.tinha + e.chegou - e.agora : e.tinha - e.agora), fica: r3(depois ? e.agora : e.agora + e.chegou) })).sort((a, b) => a.n.localeCompare(b.n, "pt-BR", { sensitivity: "base" }));
  return { rec, velhos, atual, rows }; }
let kVSel = "";
const kInc = new Set();   // abastecimentos fechados antes da referência que o usuário quis incluir
const kDepois = () => store.get("validamais-korin-conta", "antes") === "depois";
function kVendPaint() {
  const box = $("kVend"), bases = store.get(KBK, []);
  if (!bases.length) { box.innerHTML = '<h2 class="h2">Vendas · KÓRIN</h2><p class="note">Para comparar:</p><ol class="note" style="margin:0 0 10px 18px;padding:0"><li>Em <b>Contagem</b>, conte o que tem na loja e toque em <b>📌 Salvar como estoque de referência</b>.</li><li>Quando chegar mercadoria, registre em <b>Abastecimento</b> o que vai colocar e feche.</li><li>Depois conte de novo em <b>Contagem</b> e volte aqui.</li></ol>'; return; }
  if (!bases.some(b => b.id === kVSel)) kVSel = bases[0].id;
  const base = bases.find(b => b.id === kVSel), c = kCalc(base);
  const vend = c.rows.filter(r => r.vendeu > 0), conf = c.rows.filter(r => r.vendeu < 0), semC = c.rows.filter(r => !r.contado);
  const fmtU2 = rows => { const t = {}; rows.forEach(r => { t[r.u] = (t[r.u] || 0) + r.fica; }); return Object.keys(t).map(u => fq(t[u]) + " " + u).join(" · ") || "0"; };
  const fmtU = (arr) => { const t = {}; arr.forEach(r => { t[r.u] = (t[r.u] || 0) + r.vendeu; }); return Object.keys(t).map(u => fq(t[u]) + " " + u).join(" · ") || "0"; };
  box.innerHTML = `<h2 class="h2">Vendas · KÓRIN</h2>
  <label class="note" for="kVBase">Comparar com o estoque de</label><select id="kVBase" style="width:100%;margin-bottom:8px">${bases.map(b => `<option value="${b.id}"${b.id === kVSel ? " selected" : ""}>${kD(b.t)} · ${b.itens.length} produtos${b.por ? " · " + esc(b.por) : ""}</option>`).join("")}</select>
  <button type="button" class="secondary" id="kVData" style="min-height:36px;padding:4px 12px;font-size:13px;margin-bottom:6px">📅 Mudar a data do «antes»</button>
  <p class="note" style="margin:6px 0 4px">A contagem de hoje foi feita:</p>
  <div class="vspre" id="kConta" style="margin:0 0 8px"><button type="button" data-c="antes" class="${kDepois() ? "" : "on"}">Antes de abastecer</button><button type="button" data-c="depois" class="${kDepois() ? "on" : ""}">Depois de abastecer</button></div>
  <p class="note" style="margin:0 0 8px">Abastecido desde a contagem anterior: <b>${c.rec.length}</b> abastecimento${c.rec.length === 1 ? "" : "s"} · Contagem de hoje: <b>${c.atual.length}</b> produtos</p>
  ${c.rec.length ? `<div class="kvrec">${c.rec.map(r => `<span>${kQ(r.t)} · ${r.itens.length} itens<button type="button" data-krdel="${r.id}" aria-label="Apagar abastecimento">✕</button></span>`).join("")}</div>` : ""}
  ${c.velhos.length ? `<p class="note" style="margin:0 0 8px;color:#e5b92b">${c.velhos.length} abastecimento${c.velhos.length === 1 ? "" : "s"} fechado${c.velhos.length === 1 ? "" : "s"} <b>antes</b> do «antes» (não entra${c.velhos.length === 1 ? "" : "m"} na conta): ${c.velhos.map(r => `<button type="button" class="secondary" data-krinc="${r.id}" style="min-height:30px;padding:2px 10px;font-size:12px;margin:2px">+ incluir ${kQ(r.t)}</button>`).join("")}</p>` : ""}
  ${!c.atual.length ? '<p class="note" style="color:#e5b92b">Falta a contagem de hoje: conte o que tem na loja na aba Contagem.</p>' : ""}
  <div class="csum"><div><span>VENDEU</span><b>${esc(fmtU(vend))}</b></div><div><span>TOTAL AGORA</span><b>${esc(fmtU2(c.rows))}</b></div></div>
  ${c.rows.map(r => `<div class="kvr${r.vendeu < 0 ? " cf" : ""}"><div class="kvn"><b>${esc(r.n)}</b>${!r.contado ? "<small>não contado hoje</small>" : r.vendeu < 0 ? "<small>conferir: tem mais do que devia</small>" : ""}</div><div class="kvg"><div><small>${kDM(base.t)}</small>${fq(r.tinha)}</div><div><small>Hoje</small>${fq(r.agora)}</div><div class="kvv"><small>Vendeu</small><b>${fq(r.vendeu)}</b></div><div><small>Abasteci</small>${r.chegou ? "+" + fq(r.chegou) : "–"}</div><div class="kvt"><small>Total agora</small><b>${fq(r.fica)}</b></div></div></div>`).join("")}
  ${conf.length || semC.length ? `<p class="note" style="margin-top:8px">${semC.length ? semC.length + " produto(s) sem contagem agora (aparecem como vendidos por inteiro). " : ""}${conf.length ? conf.length + " com sobra para conferir." : ""}</p>` : ""}
  <div class="toolbar" style="margin-top:12px"><button type="button" class="primary big" id="kVZap">Enviar no WhatsApp</button><button type="button" class="primary big" id="kVPdf">Enviar em PDF</button></div>
  <div class="toolbar" style="margin-top:8px"><button type="button" class="secondary big" id="kVNova">📌 Novo estoque de referência</button></div>
  <p class="note" style="margin:6px 0 0">«Novo estoque de referência» usa a contagem atual como ponto de partida do próximo período.</p>`;
  box.querySelector("#kConta").onclick = e => { const b = e.target.closest("[data-c]"); if (b) { store.set("validamais-korin-conta", b.dataset.c); kVendPaint(); } };
  box.querySelector("#kVBase").onchange = e => { kVSel = e.target.value; kVendPaint(); };
  box.onclick = e => { if (e.target.id === "kVData") { const bs = store.get(KBK, []), b0 = bs.find(x => x.id === kVSel); if (!b0) return;
      const v = prompt("Em que dia foi feita a contagem «antes»? (dia/mês, ex.: 28/10)", new Date(b0.t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })); if (v === null) return;
      const m = String(v).match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?/); if (!m) return toast("Data inválida. Use dia/mês, por exemplo 28/10.");
      const hoje = new Date(); let ano = m[3] ? Number(m[3]) : hoje.getFullYear(); if (ano < 100) ano += 2000; let dt = new Date(ano, Number(m[2]) - 1, Number(m[1]), 12, 0);
      if (!m[3] && dt > hoje) dt = new Date(ano - 1, Number(m[2]) - 1, Number(m[1]), 12, 0);
      if (isNaN(dt) || dt.getMonth() !== Number(m[2]) - 1) return toast("Data inválida. Use dia/mês, por exemplo 28/10.");
      b0.t = dt.getTime(); store.set(KBK, bs); kVendPaint(); toast("📅 «Antes» agora é de " + kD(b0.t) + "."); return; }
    const inc = e.target.closest("[data-krinc]"); if (inc) { kInc.add(inc.dataset.krinc); kVendPaint(); return; } const d = e.target.closest("[data-krdel]"); if (d) { if (!confirm("Apagar este abastecimento?")) return; store.set(KRH, store.get(KRH, []).filter(r => r.id !== d.dataset.krdel)); kVendPaint(); return; }
    if (e.target.id === "kVNova") { const at = store.get(KCK, []); if (!at.length) return toast("Faça a contagem atual primeiro."); if (!confirm("Usar a contagem de hoje (mais o que foi abastecido, se contou depois) como novo «antes» e zerar a contagem?")) return;
      const b = store.get(KBK, []); const nb = { id: uid().slice(0, 8), t: Date.now(), por: kNome(), itens: at.map(i => ({ ...i })) }; b.unshift(nb); store.set(KBK, b.slice(0, 12)); kVSel = nb.id; kInc.clear(); store.set(KCK, []); kList = []; kVendPaint(); toast("📌 Novo «antes» salvo. A contagem foi zerada para o próximo período."); return; }
    if (e.target.id === "kVPdf") { const bs = store.get(KBK, []).find(x => x.id === kVSel); if (!bs) return; const cc = kCalc(bs), dep = kDepois();
      (async () => { try { const pdf = new V.jsPDF(); pdf.setFontSize(18); pdf.setFont("helvetica", "bold"); pdf.text("RELATÓRIO KÓRIN", 14, 16);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`Loja: ${LOJA}   Feito por: ${kNome()}`, 14, 23);
        pdf.text(`${kDM(bs.t)}: contagem de ${kD(bs.t)}   Hoje: ${kD(Date.now())}`, 14, 29);
        const tv = {}, tf = {}; cc.rows.forEach(r => { if (r.vendeu > 0) tv[r.u] = (tv[r.u] || 0) + r.vendeu; tf[r.u] = (tf[r.u] || 0) + r.fica; });
        const sm = t => Object.keys(t).map(u => fq(t[u]) + " " + u).join(" · ") || "0";
        V.autoTable(pdf, { startY: 34, styles: { fontSize: 10, cellPadding: 2.5 }, headStyles: { fillColor: [70, 60, 20] }, footStyles: { fillColor: [235, 230, 205], textColor: [40, 35, 10] },
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold" } }, didParseCell: d => { if (d.column.index > 0 && (d.section === "head" || d.section === "foot")) d.cell.styles.halign = "right"; },
          head: [["PRODUTO", kDM(bs.t), "HOJE", "VENDEU", "ABASTECI", "TOTAL AGORA"]],
          body: cc.rows.filter(r => r.tinha || r.agora || r.chegou).map(r => [r.n + (!r.contado ? " (não contado hoje)" : r.vendeu < 0 ? " (conferir)" : ""), fq(r.tinha), fq(r.agora), fq(r.vendeu), r.chegou ? "+" + fq(r.chegou) : "-", fq(r.fica)]),
          foot: [["TOTAL", "", "", sm(tv), "", sm(tf)]] });
        const blob = pdf.output("blob"), file = new File([blob], "Contagem frango KÓRIN Sam's Radial.pdf", { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Relatório KÓRIN", files: [file] }); else download(blob, file.name);
      } catch (er) { if (er.name !== "AbortError") { console.error(er); toast("Não foi possível gerar o PDF."); } } })(); return; }
    if (e.target.id === "kVZap") { const bs = store.get(KBK, []).find(x => x.id === kVSel); if (!bs) return; const cc = kCalc(bs), dep = kDepois();
      const lin = cc.rows.filter(r => r.tinha || r.agora || r.chegou).map(r => `*${r.n}*\n${kDM(bs.t)}: ${fq(r.tinha)} · Hoje: ${fq(r.agora)}${r.chegou ? " · Abasteci: +" + fq(r.chegou) : ""}\n${r.vendeu < 0 ? "⚠ Conferir (tem mais do que devia: " + fq(-r.vendeu) + ")" : "Vendeu: " + fq(r.vendeu)} ${r.vendeu < 0 ? "" : r.u} · Total agora: ${fq(r.fica)} ${r.u}\n`);
      const t = ["*RELATÓRIO KÓRIN*", "Loja: " + LOJA, "Feito por: " + kNome(), "", "Antes: contagem de " + kD(bs.t), "Hoje: contagem de " + kD(Date.now()), "Abastecido: " + (cc.rec.length ? cc.rec.reduce((n, r) => n + r.itens.length, 0) + " itens em " + cc.rec.length + " abastecimento" + (cc.rec.length === 1 ? "" : "s") : "nada"), "", ...lin, `*TOTAL VENDIDO: ${fmtU(cc.rows.filter(r => r.vendeu > 0))}*`].join("\n");
      if (navigator.share) navigator.share({ title: "Relatório KÓRIN", text: t }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank"); } };
}
function contagemScan(code) {
  stopScanner(); closeModal();
  const d = String(code).replace(/\D/g, ""), x = cadGroups().find(g => (d && g.barcode === d) || (isScale(d) && g.plu && Number(g.plu) === Number(String(Number(parseScale(d).item)))));
  sinal(x ? "ok" : "erro"); if (!x) { toast("Código não cadastrado. Digite o nome para contar."); $("kBusca").focus(); return; }
  kEscolhe({ n: x.name, b: x.barcode || "" }); }
const kQuando = () => new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kNome = () => String(myName()).replace(/\s*[\(\[]?\s*admin\s*[\)\]]?/gi, "").replace(/\s+/g, " ").trim();   // só o nome (sem «admin»)
function kTexto() { const l = kOrd();   // cada produto em negrito, quantidade em negrito logo abaixo, uma linha em branco entre eles
  return [kModo === "rec" ? "*ABASTECIMENTO KÓRIN*" : "*CONTAGEM KÓRIN*", "Data: " + kQuando(), "Loja: " + LOJA, (kModo === "rec" ? "Feito por: " : "Contado por: ") + kNome(), "", ...l.map(i => `*${i.n}*\n*${fq(i.q)} ${i.u}*${i.b ? " · EAN " + i.b : ""}\n`), `*TOTAL: ${l.length} produto${l.length === 1 ? "" : "s"} · ${kTot()}*`].join("\n"); }
$("kZap").onclick = async () => { if (!kList.length) return toast("A contagem está vazia.");
  const t = kTexto(); if (navigator.share) { try { await navigator.share({ title: "Contagem KÓRIN", text: t }); } catch (e) { if (e.name !== "AbortError") toast("Não foi possível compartilhar."); } }
  else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank"); };
$("kPdf").onclick = async () => { if (!kList.length) return toast("A contagem está vazia.");
  try { const l = kOrd(), pdf = new V.jsPDF(); pdf.setFontSize(18); pdf.setFont("helvetica", "bold"); pdf.text(kModo === "rec" ? "ABASTECIMENTO KÓRIN" : "CONTAGEM KÓRIN", 14, 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`Data: ${kQuando()}   Loja: ${LOJA}   ${kModo === "rec" ? "Feito" : "Contado"} por: ${kNome()}`, 14, 23);
    V.autoTable(pdf, { startY: 28, styles: { fontSize: 10, cellPadding: 2.5 }, headStyles: { fillColor: [70, 60, 20] }, footStyles: { fillColor: [235, 230, 205], textColor: [40, 35, 10] },
      head: [["CÓDIGO", "PRODUTO", "QUANTIDADE"]], body: l.map(i => [i.b || "-", i.n, `${fq(i.q)} ${i.u}`]), foot: [["", "TOTAL", `${l.length} produto${l.length === 1 ? "" : "s"} · ${kTot()}`]] });
    const blob = pdf.output("blob"), file = new File([blob], "contagem-korin-" + iso(new Date()) + ".pdf", { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "Contagem KÓRIN", files: [file] }); else download(blob, file.name);
  } catch (e) { if (e.name !== "AbortError") { console.error(e); toast("Não foi possível gerar o PDF."); } } };
// ---------- Saúde do app: confere os cadastros e testa se a nuvem aceita cada setor ----------
const ST_NOME = "__AUTOTESTE__";
const setSet = p => setorDe(p) === PER ? PER : "FLV";
function saudeCalc() {
  const grupos = cadGroups(), sec = [], atual = SETOR === PER ? PER : "FLV";
  const lk = (n, set, ean) => `<button type="button" class="shn" data-sn="${esc(n)}" data-ss="${esc(set)}">${esc(n)}</button>`;
  const semCod = grupos.filter(x => !x.barcode && !x.plu && !x.don);
  sec.push({ t: "Cadastros sem nenhum código", d: "Toque no nome para abrir o cadastro e preencher EAN, balança ou código interno.", n: semCod.length, it: semCod.map(x => lk(x.name, atual)) });
  // códigos repetidos (todos os setores)
  const m = new Map(), lots = rawAllAtivos();
  lots.forEach(p => { const set = setSet(p); [["ean", p.barcode], ["plu", p.codigo_balanca], ["doa", p.codigo_doacao]].forEach(([t, c]) => { const k = codChave(t, c); if (!k) return; const o = m.get(k) || { t, c: String(c).trim(), e: new Map() }; o.e.set(set + "|" + norm(p.name), { n: p.name, set }); m.set(k, o); }); });
  const rep = []; m.forEach(o => { if (o.e.size < 2) return; const ents = [...o.e.values()], cruza = new Set(ents.map(e => e.set)).size > 1;
    rep.push(`<div class="shg"><b>${TNOME[o.t]} ${esc(o.c)}</b>${cruza ? " <small>(entre setores)</small>" : ""}${ents.map(e => `<div class="shrow">${lk(e.n, e.set)}${cruza ? `<small> · ${esc(e.set)}</small>` : ""}<button type="button" class="shact" data-a="lim" data-t="${o.t}" data-c="${esc(o.c)}" data-n="${esc(e.n)}" data-s="${esc(e.set)}">Tirar daqui</button></div>`).join("")}</div>`); });
  sec.push({ t: "Códigos repetidos", d: "O mesmo código em produtos diferentes. «Tirar daqui» apaga o código só daquele produto (ele continua cadastrado).", n: rep.length, it: rep });
  // mesmo nome, cadastros separados
  const porNome = new Map(); grupos.forEach(x => { const k = norm(x.name); (porNome.get(k) || porNome.set(k, []).get(k)).push(x); });
  const iguais = [];
  porNome.forEach(l => { if (l.length < 2) return; const nome = l[0].name, eans = new Set(l.map(x => x.barcode).filter(Boolean)), plus = new Set(l.map(x => x.plu).filter(Boolean)), dons = new Set(l.map(x => x.don).filter(Boolean)), podeJuntar = eans.size <= 1 && plus.size <= 1 && dons.size <= 1;
    iguais.push(`<div class="shg"><b>${esc(nome)}</b> <small>${l.length} cadastros</small>${l.map(x => `<div class="shrow"><small>EAN ${x.barcode ? esc(x.barcode) : "—"}${x.plu ? " · PLU " + esc(x.plu) : ""}${x.don ? " · cód. " + esc(x.don) : ""}</small><button type="button" class="shact" data-a="ren" data-n="${esc(x.name)}" data-b="${esc(x.barcode)}" data-s="${atual}">Renomear</button></div>`).join("")}${podeJuntar ? `<button type="button" class="shact pri" data-a="jun" data-n="${esc(nome)}" data-s="${atual}">Juntar em um só</button>` : '<small class="note">EANs diferentes: provavelmente são produtos diferentes. Renomeie para diferenciar.</small>'}</div>`); });
  sec.push({ t: "Mesmo nome em cadastros separados", d: "Aparecem como linhas repetidas em Cadastros.", n: iguais.length, it: iguais });
  const par = dupGroups();
  sec.push({ t: "Nomes parecidos", d: "Podem ser o mesmo produto escrito de formas diferentes.", n: par.length, it: par.length ? [par.map(a => a.map(x => esc(x.nome)).join(" ≈ ")).slice(0, 6).join("<br>"), `<button type="button" class="shact pri" data-a="uni">Escolher o nome certo</button>`] : [] });
  const fora = {}; products.forEach(p => { if (p.category && !CATS.includes(p.category)) fora[p.category] = (fora[p.category] || 0) + 1; });
  sec.push({ t: "Categoria fora da lista", d: "Produtos com uma categoria que o app não conhece.", n: Object.keys(fora).length, it: Object.keys(fora).map(c => esc(c) + " (" + fora[c] + ")") });
  return sec;
}
function saudeSet(lots, campos) {
  lots.forEach(p => { if (db) V.updateDoc(V.doc(db, "products", p.id), { ...campos, updatedAt: V.serverTimestamp() }).catch(e => { console.error(e); toast("Erro ao salvar na nuvem."); }); Object.assign(p, campos); });
  if (!db) { persist(); render(); }
}
async function saudeAcao(d, repaint) {
  const lotes = () => rawAllAtivos().filter(p => norm(p.name) === norm(d.n) && setSet(p) === d.s);
  if (d.a === "lim") { const campo = CAMPO[d.t], alvo = lotes().filter(p => codChave(d.t, p[campo]) === codChave(d.t, d.c));
    const r = await askConfirm({ icon: "🧹", title: "Tirar o código deste produto?", text: `${TNOME[d.t]} ${d.c}`, sub: `de «${d.n}» (${d.s}). O produto continua cadastrado, só sem esse código.`, ok: "Tirar código", cancel: "Cancelar" });
    if (r !== true) return; saudeSet(alvo, { [campo]: "" }); toast(`Código tirado de «${d.n}».`); }
  else if (d.a === "ren") { const alvo = lotes().filter(p => (p.barcode || "") === (d.b || "")); const novo = (prompt("Novo nome para este cadastro:", d.n) || "").trim().slice(0, 120);
    if (!novo || novo === d.n) return; saudeSet(alvo, { name: novo }); toast(`Renomeado para «${novo}».`); }
  else if (d.a === "jun") { const alvo = lotes(), pick = f => alvo.map(p => p[f]).find(Boolean) || "";
    const r = await askConfirm({ icon: "🔗", title: "Juntar em um só?", text: `«${d.n}»`, sub: "Os cadastros passam a usar os mesmos códigos. Os lotes e validades continuam como estão.", ok: "Juntar", cancel: "Cancelar" });
    if (r !== true) return; saudeSet(alvo, { barcode: pick("barcode"), codigo_balanca: pick("codigo_balanca"), codigo_doacao: pick("codigo_doacao") }); toast("Cadastros juntados."); }
  else if (d.a === "uni") { dupReview(); const mo = new MutationObserver(() => { if (!document.querySelector(".askbg")) { mo.disconnect(); repaint(); } }); mo.observe(document.body, { childList: true }); return; }
  repaint();
}
const rawAllAtivos = () => (db ? rawAll : products.concat(lixeira, outros)).filter(p => p.name && !p.lixo);
function saudeLocal() {   // o que existe só neste aparelho
  const l = [], n = (a) => Array.isArray(a) ? a.length : 0;
  if (Object.keys(retLoc).length) l.push(`Retiradas da loja: ${Object.keys(retLoc).length} (a nuvem recusou o campo «retirado»)`);
  if (n(lixoLocalLer())) l.push(`Lixeira local: ${n(lixoLocalLer())} item(ns) (a nuvem não aceitou o campo «lixo»)`);
  if (kList.length) l.push(`Contagem do KÓRIN: ${kList.length} produto(s)`);
  [["validamais-etiquetas-per", "Etiquetas de Perecíveis"], ["validamais-etiquetas-kor", "Etiquetas do KÓRIN"]].forEach(([k, t]) => { if (n(store.get(k, []))) l.push(`${t}: ${n(store.get(k, []))} item(ns)`); });
  [["validamais-doacao-per", "Doação de Perecíveis"], ["validamais-doacao-kor", "Doação do KÓRIN"]].forEach(([k, t]) => { const d = store.get(k, null); if (d && n(d.itens)) l.push(`${t} (rascunho): ${n(d.itens)} item(ns)`); });
  return l;
}
const erroTxt = e => { const c = (e && (e.code || e.message)) || String(e); return /permission-denied/.test(c) ? "recusado pelas regras do Firebase" : /timeout|sem resposta/.test(c) ? "sem resposta da nuvem em 10 s (sem internet?)" : /unavailable|network/.test(c) ? "sem conexão com a nuvem" : c; };
async function autoteste(log) {
  const com = (p, ms = 10000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("sem resposta"), { code: "timeout" })), ms))]);
  const passo = async (nome, fn, soAviso) => { const t = Date.now(); try { const x = await fn(); log(nome, "ok", (x ? x + " · " : "") + (Date.now() - t) + " ms"); return true; } catch (e) { log(nome, soAviso ? "aviso" : "erro", (soAviso ? soAviso + " (" + erroTxt(e) + ")" : erroTxt(e))); return false; } };
  await passo("Guardar e ler dados neste aparelho", () => { store.set("validamais-teste", Date.now()); if (!store.get("validamais-teste", null)) throw new Error("não leu"); try { localStorage.removeItem("validamais-teste"); } catch (e) {} });
  if (!db) { log("Nuvem", "aviso", "o app está em modo local: não há Firebase configurado neste aparelho"); return; }
  const ids = [];
  for (const cat of ["FLV", PER]) {
    let id = null;
    const rec = () => { const ts = V.serverTimestamp(); return { barcode: "", name: ST_NOME + " " + Date.now(), category: cat, expiry: iso(new Date(Date.now() + 3 * 864e5)), quantity: 1, por: "autoteste", codigo_balanca: "", codigo_doacao: "", createdAt: ts, updatedAt: ts }; };
    const ok = await passo(`A nuvem aceita cadastro do setor ${cat === PER ? "Perecíveis" : "FLV"}`, async () => { const r = await com(V.addDoc(V.collection(db, "products"), rec())); id = r.id; ids.push(id); });
    if (!ok || !id) { if (cat === PER) log("→ O que fazer", "info", "as regras do Firebase precisam aceitar a categoria «Perecíveis» (me peça o texto das regras)."); continue; }
    await passo(`Alterar o cadastro de teste (${cat === PER ? "Perecíveis" : "FLV"})`, () => com(V.updateDoc(V.doc(db, "products", id), { name: ST_NOME + " alterado", updatedAt: V.serverTimestamp() })));
    await passo(`Retirar da loja em ${cat === PER ? "Perecíveis" : "FLV"} (aparece para todos)`, () => com(V.updateDoc(V.doc(db, "products", id), { retirado: true, retEm: Date.now(), retPor: "autoteste", updatedAt: V.serverTimestamp() })), "a retirada desse setor fica só neste aparelho");
    await passo(`Lixeira compartilhada em ${cat === PER ? "Perecíveis" : "FLV"}`, () => com(V.updateDoc(V.doc(db, "products", id), { lixo: Date.now(), updatedAt: V.serverTimestamp() })), "a lixeira desse setor fica só neste aparelho");
    await passo(`Apagar o cadastro de teste (${cat === PER ? "Perecíveis" : "FLV"})`, () => com(V.deleteDoc(V.doc(db, "products", id))));
  }
  const eid = "autoteste" + Date.now();
  await passo("Etiquetas compartilhadas (sh_etiquetas)", async () => { await com(V.setDoc(V.doc(db, "sh_etiquetas", eid), { nome: ST_NOME, ord: 1 })); await com(V.deleteDoc(V.doc(db, "sh_etiquetas", eid))); });
  for (const id of ids) { try { await V.deleteDoc(V.doc(db, "products", id)); } catch (e) {} }   // limpeza de segurança
}
// ---------- memória e armazenamento (só no Saúde do app, que é Admin) ----------
let memHtml = "";
const fmtB = n => n >= 1073741824 ? (n / 1073741824).toFixed(2).replace(".", ",") + " GB" : n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
async function memCalc() {
  const bar = (u, t) => { const pc = Math.min(100, Math.max(1, Math.round(u / t * 100))); return `<div class="memb"><i style="width:${pc}%"></i></div><small class="note">${fmtB(u)} usados · ${fmtB(Math.max(0, t - u))} livres de ${fmtB(t)} (${pc}%)</small>`; };
  let h = "";
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota) h += `<div class="memi"><b>Armazenamento do app neste aparelho</b>${bar(e.usage || 0, e.quota)}</div>`; } } catch (e) {}
  try { let ls = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || "").length) * 2; } h += `<div class="memi"><b>Dados guardados no navegador (configurações, rascunhos)</b>${bar(ls, 5242880)}</div>`; } catch (e) {}
  try { const m = performance.memory; if (m && m.jsHeapSizeLimit) h += `<div class="memi"><b>Memória em uso pelo app agora</b>${bar(m.usedJSHeapSize, m.jsHeapSizeLimit)}</div>`; } catch (e) {}
  try { const j = JSON.stringify(products).length; h += `<div class="memi"><b>Cadastros na nuvem (estimativa)</b>${bar(j * 1.6, 1073741824)}<small class="note">${products.length} produtos. Cota gratuita do Firebase: 1 GB. É uma estimativa pelo tamanho dos dados; o valor exato só aparece no painel do Firebase.</small></div>`; } catch (e) {}
  if (navigator.deviceMemory) h += `<small class="note">Memória (RAM) deste celular: cerca de ${navigator.deviceMemory} GB.</small>`;
  return h || '<small class="note">Este aparelho não informa o uso de memória.</small>';
}
function saudeAbrir() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "saudeModal";
  const cloud = $("syncState") ? $("syncState").textContent : "";
  const paint = () => { const sec = saudeCalc(), probs = sec.filter(s => s.n).length, loc = saudeLocal(), y = bg.querySelector(".sheet") ? bg.querySelector(".sheet").scrollTop : 0, run = bg.querySelector("#shRes") ? bg.querySelector("#shRes").innerHTML : "";
    bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Saúde do app"><div class="sheethead"><h2>🩺 Saúde do app</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note">Setor <b>${esc(SETOR)}</b> · ${cadGroups().length} cadastros · ${db ? "Firebase ligado" : "modo local"}${cloud && db ? " · " + esc(cloud) : ""}</p>
    <div class="shsum ${probs ? "aten" : "ok"}">${probs ? "⚠ " + probs + " ponto(s) de atenção" : "✓ Nada para corrigir"}</div>
    ${sec.map(s => `<div class="shsec"><div class="shh"><span class="shb ${s.n ? "aten" : "ok"}">${s.n ? s.n : "✓"}</span><b>${esc(s.t)}</b></div>${s.n ? `<small class="note">${esc(s.d)}</small><div class="shit">${s.it.slice(0, 10).map(h => `<div>${h}</div>`).join("")}${s.it.length > 10 ? `<div class="muted">+ ${s.it.length - 10} outros (resolva estes e abra de novo)</div>` : ""}</div>` : ""}</div>`).join("")}
    <div class="shsec"><div class="shh"><span class="shb info">ⓘ</span><b>Guardado só neste aparelho</b></div>${loc.length ? `<div class="shit">${loc.map(t => `<div>${esc(t)}</div>`).join("")}</div><small class="note">Outros celulares não veem isso.</small>` : '<small class="note">Nada. Tudo o que importa está na nuvem.</small>'}</div>
    <div class="shsec"><div class="shh"><span class="shb info">ⓘ</span><b>Memória e armazenamento</b></div><div id="shMem">${memHtml || '<small class="note">Calculando…</small>'}</div></div>
    <div class="shsec"><div class="shh"><b>Autoteste da nuvem</b></div><small class="note">Cria um item de teste em cada setor, altera, apaga e diz se o Firebase aceitou. Não deixa nada para trás.</small>
      <button type="button" class="primary big" id="shRun" style="margin-top:10px">Rodar autoteste</button><div id="shRes" class="shit">${run}</div></div></section>`;
    bg.querySelector(".sheet").scrollTop = y; };
  paint(); document.body.appendChild(bg); memCalc().then(h => { memHtml = h; const m = bg.querySelector("#shMem"); if (m) m.innerHTML = h; });
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) { bg.remove(); return; }
    const ac = e.target.closest("[data-a]"); if (ac) { saudeAcao({ ...ac.dataset }, paint); return; }
    const n = e.target.closest("[data-sn]"); if (n) { const nome = n.dataset.sn, set = n.dataset.ss; bg.remove(); if (set && set !== (SETOR === PER ? PER : "FLV") && SETOR !== KOR) trocaSetor(set); $("navCadastros").click(); $("cBusca").value = nome; cadPaint(); window.scrollTo(0, 0); return; }
    if (e.target.id === "shRun") { const b = e.target, out = $("shRes"); b.disabled = true; b.textContent = "Testando…"; out.innerHTML = "";
      const ic = { ok: "✓", erro: "✗", aviso: "⚠", info: "ⓘ" };
      autoteste((nome, est, extra) => { out.insertAdjacentHTML("beforeend", `<div class="shr ${est}"><b>${ic[est] || ""} ${esc(nome)}</b>${extra ? `<small>${esc(extra)}</small>` : ""}</div>`); })
        .catch(err => out.insertAdjacentHTML("beforeend", `<div class="shr erro"><b>✗ O teste parou</b><small>${esc(erroTxt(err))}</small></div>`))
        .then(() => { b.disabled = false; b.textContent = "Rodar de novo"; out.insertAdjacentHTML("beforeend", `<div class="shr info"><small>Fim do teste. ✓ ok · ⚠ funciona com ressalva · ✗ precisa de ajuste.</small></div>`); }); } };
}

// nuvem: padrão da loja (só o Admin grava); cada aparelho pode ter o seu (fica local)
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "visual"), sn => { visCloud = sn.exists() && sn.data().cores ? sn.data() : null; visAplica(); render(); }, e => console.warn("visual", e)); } catch (e) { console.warn(e); } }
function visAbrir() {
  const v0 = visCfg(), admin = PERFIL === "Admin", loc = !!store.get(VK, null);
  let v = JSON.parse(JSON.stringify(v0));
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "visModal";
  const nomes = { v: "Vencido", h: "Vence hoje", a: "Urgente (vermelho)", y: "Atenção (amarelo)", g: "Dentro do prazo (verde)" };
  const optR = [1, 2, 3, 4, 5, 7], optY = [3, 5, 7, 10, 15, 20, 30, 45, 60], num = (l, sel, cur) => l.concat(l.includes(cur) ? [] : [cur]).sort((x, y) => x - y).map(d => `<option value="${d}" ${d === sel ? "selected" : ""}>${d} dia${d > 1 ? "s" : ""}</option>`).join("");
  const PRE = { pad: { v: "#8a3a45", h: "#bf4a52", a: "#c7514a", y: "#c9a22f", g: "#4a9a78" }, dal: { v: "#4a2a00", h: "#d55e00", a: "#e69f00", y: "#f0e442", g: "#0072b2" }, sua: { v: "#5b0f6e", h: "#d6336c", a: "#f76707", y: "#fcc419", g: "#2b8a3e" } };
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Cores e prazos"><div class="sheethead"><h2>🎨 Cores e prazos</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note">${admin ? "Como Admin, o que você salvar vale para <b>todos os aparelhos</b>." : "O que você salvar vale só <b>neste aparelho</b>."}</p>
    <label class="nfrow"><span><b>🔴 Vermelho: vence em até</b><small>Ação imediata (de 1 dia até este prazo)</small></span><select id="vsR">${num(optR, v.red, v.red)}</select></label>
    <label class="nfrow"><span><b>🟡 Amarelo: vence em até</b><small>Atenção (depois do vermelho até este prazo)</small></span><select id="vsY"><option value="" ${v.yel ? "" : "selected"}>Padrão do setor</option>${num(optY, v.yel, v.yel || 7).replace(/<option value="(\d+)" selected>/, (m, d) => v.yel ? m : `<option value="${d}">`)}</select></label>
    <p class="note" style="margin:2px 0 8px">🟢 Verde: tudo que vence depois do amarelo.</p>
    <label>Conjuntos de cores</label><div class="vspre"><button type="button" data-p="pad">Padrão</button><button type="button" data-p="dal">Daltonismo</button><button type="button" data-p="sua">Vivas</button></div>
    <div class="vscores">${Object.keys(nomes).map(k => `<label class="vsc"><span>${nomes[k]}</span><input type="color" data-c="${k}" value="${v.cores[k]}"></label>`).join("")}</div>
    <label class="nfrow"><span><b>🚨 Sirene e efeitos de urgência</b><small>O item vencido pisca, brilha e vibra ao abrir o app</small></span><input type="checkbox" id="vsFx" ${fxOn() ? "checked" : ""}></label>
    <label class="nfrow"><span><b>🧀 Ícones nos produtos</b><small>Um desenho por tipo (queijo, frios, laticínios…) nos Perecíveis</small></span><input type="checkbox" id="vsIco" ${iconesOn() ? "checked" : ""}></label>
    <label>Tamanho da letra da lista</label><div class="vspre" id="vsF"><button type="button" data-f="normal">Normal</button><button type="button" data-f="grande">Grande</button></div>
    <div class="vsprev" id="vsPrev"></div>
    <div class="toolbar" style="margin-top:12px"><button class="primary big" type="button" id="vsSalva">Salvar</button><button class="secondary" type="button" id="vsPad">${admin ? "Restaurar padrão" : (loc ? "Usar o padrão da loja" : "Restaurar padrão")}</button></div></section>`;
  document.body.appendChild(bg);
  const q = x => bg.querySelector(x), txt = h => { const n = parseInt(h.slice(1), 16), f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return (.2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255)) > .4 ? "#1a1405" : "#fff"; };
  const prev = () => { q("#vsPrev").innerHTML = [["a", `1 a ${v.red} dias`], ["y", `${v.red + 1} a ${v.yel || "…"} dias`], ["g", "depois"]].map(([k, t]) => `<span style="background:${v.cores[k]};color:${txt(v.cores[k])}">${k === "a" ? "🔴" : k === "y" ? "🟡" : "🟢"} ${t}</span>`).join("");
    bg.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", b.dataset.f === v.fonte)); bg.querySelectorAll("[data-c]").forEach(i => { i.value = v.cores[i.dataset.c]; }); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); const p = e.target.closest("[data-p]"); if (p) { v.cores = { ...PRE[p.dataset.p] }; prev(); } const f = e.target.closest("[data-f]"); if (f) { v.fonte = f.dataset.f; prev(); } };
  q("#vsFx").onchange = e => { store.set(FXK, e.target.checked); fxAplica(); sirene(); };
  q("#vsIco").onchange = e => { store.set(ICK, e.target.checked); render(); };
  q("#vsR").onchange = e => { v.red = Number(e.target.value); prev(); }; q("#vsY").onchange = e => { v.yel = e.target.value ? Number(e.target.value) : null; prev(); };
  bg.querySelectorAll("[data-c]").forEach(i => i.oninput = () => { v.cores[i.dataset.c] = i.value; prev(); });
  q("#vsSalva").onclick = async () => {
    const cfg = visNorm(v);
    if (admin && db) { try { await V.setDoc(V.doc(db, "sh_cfg", "visual"), { ...cfg, em: Date.now() }); localStorage.removeItem(VK); visCloud = cfg; toast("Salvo para todos os aparelhos."); }
      catch (e) { console.error(e); store.set(VK, cfg); toast("Salvo só neste aparelho: a nuvem recusou (" + (e && (e.code || e.message) || "regras") + ")."); } }
    else { store.set(VK, cfg); toast(admin ? "Salvo neste aparelho (modo local)." : "Salvo neste aparelho."); }
    visAplica(); render(); bg.remove(); };
  q("#vsPad").onclick = async () => {
    if (admin && db) { try { await V.setDoc(V.doc(db, "sh_cfg", "visual"), { em: Date.now() }); } catch (e) { console.error(e); } visCloud = null; }
    try { localStorage.removeItem(VK); } catch (e) {} visAplica(); render(); bg.remove(); toast(admin ? "Padrão restaurado." : "Voltou ao padrão da loja."); };
  prev();
}
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "korin"), sn => { korNuvem = (sn.exists() && sn.data().m) || {}; separaLixo(rawAll); lixoBtn(); render(); try { cadPaint(); kPaint(); } catch (e) {} }, e => console.warn("korin", e)); } catch (e) { console.warn(e); } }
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "icones"), sn => { icoNuvem = (sn.exists() && sn.data().m) || {}; render(); }, e => console.warn("icones", e)); } catch (e) { console.warn(e); } }
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "notas"), sn => { notasNuvem = (sn.exists() && sn.data().n) || {}; const f = document.activeElement; if (!(f && f.matches && f.matches("[data-nota]"))) render(); }, e => console.warn("notas", e)); } catch (e) { console.warn(e); } }
visAplica();

// ---------- atalhos do ícone (segurar o ícone do app): ?acao=bipar | hoje | oferta ----------
function ofertaEscolher() {
  const cand = products.filter(p => { const dl = daysLeft(p.expiry); return !p.retirado && dl !== null && dl >= 0 && dl <= visCfg().red; }).sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
  if (!cand.length) return toast("Nenhum item perto de vencer para fazer oferta.");
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "ofEscModal";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Criar oferta"><div class="sheethead"><h2>🏷️ Criar oferta</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div><p class="note">Escolha o item que vai para promoção:</p><div class="atvl">${cand.map(p => { const dl = daysLeft(p.expiry); return `<button type="button" class="ofesc" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><small>${dl <= 0 ? "vence hoje" : dl === 1 ? "vence amanhã" : "vence em " + dl + " dias"}</small></button>`; }).join("")}</div></section>`;
  document.body.appendChild(bg);
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return bg.remove(); const b = e.target.closest("[data-id]"); if (b) { bg.remove(); ofertaAbrir(b.dataset.id); } };
}
$("acaoX").onclick = () => { acaoF = ""; render(); };
function acaoRoda(a) {
  if (a === "bipar") { $("fab").click(); }
  else if (a === "hoje") { if (curTab !== "Loja") tab("Loja"); acaoF = "hoje"; render(); window.scrollTo(0, 0); }
  else if (a === "oferta") { if (curTab !== "Loja") tab("Loja"); ofertaEscolher(); }
}
{ const a = new URLSearchParams(location.search).get("acao"); if (a) { try { history.replaceState(null, "", location.pathname); } catch (e) {} let n = 0; const t = setInterval(() => { n++; if (products.length || n > 12) { clearInterval(t); setTimeout(() => acaoRoda(a), 700); } }, 500); } }
$("mnVis").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } visAbrir(); };

// entrada: ao abrir o app (sem repetir se foi há menos de 10 min) e ao voltar depois de 30 min fora; a tela de Atividade junta as do mesmo dia numa linha só
{ let fora = 0; const entra = () => { try { const u = Number(localStorage.getItem("validamais-ult-entrada") || 0); if (Date.now() - u < 10 * 60 * 1000) return; localStorage.setItem("validamais-ult-entrada", String(Date.now())); logAtv("entrou", "Abriu o app"); } catch (e) {} };
  setTimeout(entra, 2500);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") fora = Date.now(); else if (fora && Date.now() - fora > 30 * 60 * 1000) { fora = 0; try { localStorage.setItem("validamais-ult-entrada", "0"); } catch (e) {} entra(); } }); }
// ---------- reportar erro (qualquer pessoa envia; o Admin lê em "Atividade dos usuários → Erros") ----------
const errBuf = []; const errPush = m => { errBuf.unshift(String(m).slice(0, 160)); errBuf.length = Math.min(errBuf.length, 5); };
window.addEventListener("error", e => errPush(e.message || "erro")); window.addEventListener("unhandledrejection", e => errPush("promessa: " + ((e.reason && (e.reason.message || e.reason)) || "")));
function erroAbrir() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "erroModal"; let cat = "Outro";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Feedback"><div class="sheethead"><h2>💬 Feedback</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note">Conte o que aconteceu. O app já anexa a versão, a tela e o horário.</p>
    <div class="vspre" id="erCat" style="flex-wrap:wrap">${["Validades", "Cadastro", "Etiquetas", "Pesáveis", "Doação", "Outro"].map(c => `<button type="button" data-c="${c}" class="${c === cat ? "on" : ""}">${c}</button>`).join("")}</div>
    <textarea id="erTxt" rows="5" maxlength="500" placeholder="O que você estava fazendo e o que deu errado?" style="width:100%;box-sizing:border-box"></textarea>
    <p class="note" id="erN" style="text-align:right;margin:2px 0 8px">0/500</p>
    <div class="toolbar"><button class="primary big" type="button" id="erEnv">Enviar</button><button class="secondary" type="button" data-x>Cancelar</button></div></section>`;
  document.body.appendChild(bg);
  const q = x => bg.querySelector(x);
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); const c = e.target.closest("[data-c]"); if (c) { cat = c.dataset.c; bg.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b === c)); } };
  q("#erTxt").oninput = () => { q("#erN").textContent = q("#erTxt").value.length + "/500"; };
  q("#erEnv").onclick = () => {
    const txt = q("#erTxt").value.trim(); if (txt.length < 5) return toast("Descreva o problema em poucas palavras.");
    const ctx = `v${(window.APP_VERSION || "").split("-").pop()} · aba ${curTab} · ${innerWidth}x${innerHeight} · ${navigator.onLine ? "online" : "offline"}${errBuf.length ? " · erros: " + errBuf.join(" | ") : ""}`.slice(0, 600);
    try { const rec = { tipo: "atv", t: Date.now(), quem: myName().slice(0, 40), perfil: PERFIL || "", setor: SETOR || "", dev: myId, a: "erro", cat, txt: txt.slice(0, 500), ctx };
      if (db) V.addDoc(V.collection(db, "acessos"), rec).then(() => toast("Erro enviado. Obrigado!")).catch(e => { console.warn(e); toast("Não consegui enviar agora. Tente de novo mais tarde."); });
      else { const l = store.get(ATK, []); l.unshift(rec); store.set(ATK, l.slice(0, 300)); toast("Erro registrado neste aparelho (sem nuvem)."); } } catch (e) { console.warn(e); return toast("Não consegui enviar."); }
    bg.remove(); };
}
$("mnErro").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } erroAbrir(); };
function perdasHtml(dados, dias, setor) {
  const desde = Date.now() - dias * 864e5, setDe = r => (r.cat === PER ? PER : "FLV");
  const l = dados.filter(r => r.a === "retirou" && r.t >= desde && r.motivo && (!setor || setDe(r) === setor));
  const por = {}; MOTIVOS.forEach(m => por[m] = { n: 0, q: 0 }); l.forEach(r => { const o = por[r.motivo] || (por[r.motivo] = { n: 0, q: 0 }); o.n++; o.q += Number(r.qtd) || 0; });
  const perda = l.filter(r => r.motivo === "Vencido" || r.motivo === "Quebra/estragou"), pq = perda.reduce((a, r) => a + (Number(r.qtd) || 0), 0);
  const prod = {}; perda.forEach(r => { const k = r.prod || "—"; const o = prod[k] || (prod[k] = { n: 0, q: 0 }); o.n++; o.q += Number(r.qtd) || 0; });
  const top = Object.entries(prod).sort((a, b) => b[1].q - a[1].q || b[1].n - a[1].n).slice(0, 8);
  const ctl = `<div class="atvf"><button type="button" data-pd="7" class="${dias === 7 ? "on" : ""}">7 dias</button><button type="button" data-pd="30" class="${dias === 30 ? "on" : ""}">30 dias</button><button type="button" data-ps="" class="${!setor ? "on" : ""}">Todos</button><button type="button" data-ps="FLV" class="${setor === "FLV" ? "on" : ""}">FLV</button><button type="button" data-ps="Perecíveis" class="${setor === PER ? "on" : ""}">Perecíveis</button></div>`;
  if (!l.length) return ctl + '<p class="note">Sem retiradas com motivo neste período. O motivo passa a ser registrado a partir desta versão.</p>';
  return ctl + `<div class="perres"><div class="perbig"><b>${pq}</b><span>un. perdidas (vencido + quebra) em ${perda.length} retirada${perda.length === 1 ? "" : "s"}</span></div>` +
    Object.keys(por).sort((a, b) => (MOTIVOS.indexOf(a) + 99) % 99 - (MOTIVOS.indexOf(b) + 99) % 99).map(m => { const o = por[m]; return `<div class="permot ${m === "Vencido" || m === "Quebra/estragou" ? "perda" : ""}"><span>${esc(m)}</span><b>${o.n}</b><small>${o.q} un.</small></div>`; }).join("") + `</div>` +
    (top.length ? `<div class="atvd">Mais perdidos</div>` + top.map(([n, o]) => `<div class="atvr"><time>${o.q}</time><div><b>${esc(n)}</b><small>${o.n} retirada${o.n === 1 ? "" : "s"} · ${o.q} un.</small></div></div>`).join("") : "");
}
const ATV_ICO = { entrou: "🚪", cadastrou: "➕", editou: "✏️", retirou: "📦", devolveu: "↩️", removeu: "🗑️", "doação": "🎁", etiqueta: "🏷️", importou: "📥", oferta: "🔥", erro: "🐞" };
const ATV_VERBO = { entrou: "entrou no app", cadastrou: "cadastrou", editou: "editou", retirou: "retirou da loja", devolveu: "devolveu à loja", removeu: "removeu", "doação": "fez doação", etiqueta: "lançou etiqueta", importou: "importou", oferta: "criou oferta", erro: "reportou um erro" };
let atvUn = null;
function atvAbrir() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "atvModal"; const q0 = x => bg.querySelector(x);
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Atividade dos usuários"><div class="sheethead"><h2>🕘 Atividade dos usuários</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <div class="atvf" id="atvF"></div><div id="atvSum" class="atvsum"></div><div id="atvL" class="atvl"><p class="note">Carregando…</p></div><button type="button" class="secondary atvlimpa" id="atvLimpa">🗑️ Limpar histórico</button></section>`;
  document.body.appendChild(bg);
  let dados = [], refs = [], filtro = "", perD = 7, perS = "", corte = store.get("validamais-atv-corte", null) || { t: 0, manter: false };
  const hm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), dia = t => { const d = new Date(t), h = new Date(); h.setHours(0, 0, 0, 0); const ontem = new Date(h - 864e5); return d >= h ? "Hoje" : d >= ontem ? "Ontem" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };
  const mantem = r => r.a === "erro" || (r.a === "retirou" && r.motivo);   // erros e retiradas com motivo (base do resumo de perdas)
  const escondido = r => r.t <= corte.t && !(corte.manter && mantem(r));
  const desenha = () => {
    const nomes = [...new Set(dados.map(r => r.quem))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const nErr = dados.filter(r => r.a === "erro").length;
    bg.querySelector("#atvF").innerHTML = ["", "@perdas", "@erros", ...nomes].map(n => `<button type="button" class="${n === filtro ? "on" : ""}" data-n="${esc(n)}">${n === "" ? "Todos" : n === "@erros" ? "🐞 Erros (" + nErr + ")" : n === "@perdas" ? "📉 Perdas" : esc(n)}</button>`).join("");
    if (filtro === "@perdas") { bg.querySelector("#atvSum").innerHTML = ""; bg.querySelector("#atvL").innerHTML = perdasHtml(dados, perD, perS); return; }
    const l = dados.filter(r => filtro === "@erros" ? r.a === "erro" : (!filtro || r.quem === filtro)), hj = new Date(); hj.setHours(0, 0, 0, 0);
    const res = {}; dados.filter(r => r.t >= hj).forEach(r => { const o = res[r.quem] || (res[r.quem] = { ent: 0, n: 0, ult: 0 }); if (r.a === "entrou") { if (!o.ent || r.t < o.ent) o.ent = r.t; } else o.n++; o.ult = Math.max(o.ult, r.t); });
    bg.querySelector("#atvSum").innerHTML = Object.keys(res).length ? "<b>Hoje</b>" + Object.entries(res).filter(([n]) => !filtro || filtro === "@erros" || n === filtro).map(([n, o]) => `<div><span>${esc(n)}</span><small>${o.ent ? "entrou às " + hm(o.ent) + " · " : ""}${o.n} ação(ões) · última às ${hm(o.ult)}</small></div>`).join("") : "";
    let ult = "";
    const gp = {}, l2 = [];   // várias "entrou no app" da mesma pessoa no mesmo dia viram uma linha só
    l.forEach(r => { if (r.a !== "entrou") { l2.push(r); return; } const k = r.quem + "|" + dia(r.t), g = gp[k]; if (g) { g.n++; g.prim = Math.min(g.prim, r.t); } else { const c = { ...r, n: 1, prim: r.t }; gp[k] = c; l2.push(c); } });
    bg.querySelector("#atvL").innerHTML = l2.length ? l2.map(r => { const d = dia(r.t), h = d !== ult ? `<div class="atvd">${esc(d)}</div>` : ""; ult = d;
      return h + `<div class="atvr"><time>${hm(r.t)}</time><div><b>${esc(r.quem)}</b> ${ATV_ICO[r.a] || "•"} ${esc(ATV_VERBO[r.a] || r.a)}${r.n > 1 ? ` <small>· ${r.n} vezes (a primeira às ${hm(r.prim)})</small>` : ""}${r.a === "erro" ? `<span class="atverr"><b>${esc(r.cat || "")}</b> ${esc(r.txt || "")}<small>${esc(r.ctx || "")}</small></span>` : r.txt && r.a !== "entrou" ? `<small>${esc(r.txt)}</small>` : ""}${r.perfil || r.setor ? `<em>${esc(r.perfil || "")}${r.setor && r.setor !== r.perfil ? " · " + esc(r.setor) : ""}</em>` : ""}</div></div>`; }).join("") : '<p class="note">Nenhuma atividade registrada ainda. Ela começa a ser gravada a partir desta versão.</p>';
  };
  const fecha = () => { try { atvUn && atvUn(); } catch (e) {} atvUn = null; bg.remove(); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) fecha(); const b = e.target.closest("[data-n]"); if (b) { filtro = b.dataset.n; desenha(); } const pd = e.target.closest("[data-pd]"); if (pd) { perD = Number(pd.dataset.pd); desenha(); } const ps = e.target.closest("[data-ps]"); if (ps) { perS = ps.dataset.ps; desenha(); } };
  if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "atividade"), sn => { if (sn.exists() && sn.data().t) { const c = { t: Number(sn.data().t) || 0, manter: !!sn.data().manter }; if (c.t > corte.t) { corte = c; store.set("validamais-atv-corte", c); dados = dados.filter(r => !escondido(r)); desenha(); } } }, () => {}); } catch (e) { console.warn(e); } }
  q0("#atvLimpa").onclick = async () => {
    const ok = await askConfirm({ icon: "🗑️", title: "Limpar histórico", subtitle: "O que apagar?", motivos: ["Só entradas e ações", "Tudo, até erros e perdas"], motivo: "Só entradas e ações", ok: "Limpar", cancel: "Cancelar" }); if (ok !== true) return;
    const tudo = window.vmMotivo === "Tudo, até erros e perdas", agora = Date.now(); let falhou = 0, n = 0;
    if (!db) { const l = store.get(ATK, []); const rest = tudo ? [] : l.filter(mantem); store.set(ATK, rest); dados = rest; desenha(); return toast("Histórico limpo."); }
    const alvo = dados.filter(r => r._ref && (tudo || !mantem(r)));
    await Promise.all(alvo.map(r => V.deleteDoc(r._ref).then(() => { n++; }).catch(e => { falhou++; console.warn("limpar", e && e.code); })));
    if (falhou) { corte = { t: agora, manter: !tudo }; store.set("validamais-atv-corte", corte); try { await V.setDoc(V.doc(db, "sh_cfg", "atividade"), { t: agora, manter: !tudo }); } catch (e) { console.warn(e); } dados = dados.filter(r => !escondido(r)); desenha(); toast("Histórico limpo (escondido: as regras do Firebase não deixam apagar de vez)."); }
    else toast(n ? "Histórico apagado." : "Nada para limpar.");
  };
  if (db) { try { atvUn = V.onSnapshot(V.query(V.collection(db, "acessos"), V.orderBy("t", "desc"), V.limit(400)), sn => { try { const corte60 = Date.now() - 60 * 864e5; sn.docs.filter(d => { const x = d.data() || {}; return x.tipo === "atv" && Number(x.t) < corte60; }).slice(0, 100).forEach(d => V.deleteDoc(d.ref).catch(() => {})); } catch (e) {}
    refs = sn.docs.filter(d => (d.data() || {}).tipo === "atv" && d.data().t); dados = refs.map(d => ({ ...d.data(), _ref: d.ref })).filter(r => !escondido(r)); desenha(); }, e => { console.warn(e); bg.querySelector("#atvL").innerHTML = '<p class="note">Não consegui ler o histórico na nuvem (confira se as regras permitem ler «acessos»).</p>'; }); } catch (e) { console.warn(e); } }
  else { dados = store.get(ATK, []); desenha(); }
}
$("mnAtv").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } atvAbrir(); };
$("mnPerfil").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } perfilEscolher(true); };
// ---------- notificações de vencimento (cada pessoa liga e escolhe quantos dias antes quer ser avisada) ----------
const NTK = "validamais-notif";
const NOTIF_HORA = 8;   // avisa todos os dias (seg a dom) a partir das 08h
const notifSuporte = () => "Notification" in window && "serviceWorker" in navigator;
const notifCfg = () => { const c = store.get(NTK, null) || {}; return { on: !!c.on, dias: Number(c.dias) > 0 ? Number(c.dias) : (PERFIL === PER ? 7 : 2), setores: c.setores || (PERFIL === PER ? [PER] : PERFIL === "FLV" ? ["FLV"] : ["FLV", PER]), ultimo: c.ultimo || "" }; };
const diaKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
async function notifGravaCache(c) {   // o service worker lê esta cópia para avisar com o app fechado
  try { const ch = await caches.open("vm-cfg"); await ch.put("vm-cfg.json", new Response(JSON.stringify({ on: c.on, dias: c.dias, setores: c.setores, ultimo: c.ultimo, pid: fb.projectId || "", key: fb.apiKey || "" }), { headers: { "content-type": "application/json" } })); } catch (e) { console.warn(e); }
}
async function notifSalva(c) {
  store.set(NTK, c); await notifGravaCache(c);
  try { const reg = await navigator.serviceWorker.ready;
    if (reg.periodicSync) { if (c.on) await reg.periodicSync.register("vm-venc", { minInterval: 3600 * 1000 }); else await reg.periodicSync.unregister("vm-venc"); } } catch (e) { console.warn(e); }
}
function notifLista(c) {   // [{name, dl}] dos produtos que pedem aviso, do mais urgente ao menos
  const out = [], vistos = new Set();
  (db ? rawAll : products.concat(outros)).forEach(p => { if (!p || !p.name || p.retirado || p.lixo || !/^\d{4}-\d\d-\d\d$/.test(p.expiry || "")) return;
    if (!c.setores.includes(p.category === PER ? PER : "FLV")) return; const dl = daysLeft(p.expiry); if (dl === null || dl > c.dias) return;
    const k = norm(p.name) + "|" + p.expiry; if (vistos.has(k)) return; vistos.add(k); out.push({ name: p.name, dl }); });
  return out.sort((a, b) => a.dl - b.dl || a.name.localeCompare(b.name, "pt-BR"));
}
function notifTexto(l, dias) {
  const n = (f) => l.filter(f).length, ven = n(x => x.dl < 0), hoje = n(x => x.dl === 0), prox = n(x => x.dl > 0);
  const total = l.length, plural = total > 1;
  const titulo = ven === total ? `${total} produto${plural ? "s" : ""} vencido${plural ? "s" : ""}` : `${total} produto${plural ? "s" : ""} para vencer`;
  const partes = [];
  if (ven) partes.push(`${ven} vencido${ven > 1 ? "s" : ""}`);
  if (hoje) partes.push(`${hoje} ${hoje > 1 ? "vencem" : "vence"} hoje`);
  if (prox) partes.push(`${prox} em até ${dias} dia${dias > 1 ? "s" : ""}`);
  const resumo = partes.length > 1 ? partes.join(" · ") : "";
  const itens = l.slice(0, 3).map(x => `${x.name.length > 32 ? x.name.slice(0, 31) + "…" : x.name} — ${when(x.dl).toLowerCase()}`);
  const resto = total > 3 ? `+ ${total - 3} produto${total - 3 > 1 ? "s" : ""}` : "";
  return { title: titulo, body: [resumo, ...itens, resto].filter(Boolean).join("\n") };
}
async function notifVerifica(forcar) {   // avisa no máximo uma vez por dia (ou quando o usuário pede o teste)
  try { const c = notifCfg(); if (!notifSuporte() || Notification.permission !== "granted" || (!c.on && !forcar)) return false; if (!forcar && (new Date().getHours() < NOTIF_HORA || c.ultimo === diaKey() || !(db ? window.__hReady : true))) return false;
    const l = notifLista(c); if (!l.length) { if (forcar) toast("Nenhum produto dentro do prazo escolhido. Está tudo em dia."); return false; }
    const t = notifTexto(l, c.dias), reg = await navigator.serviceWorker.ready;
    await reg.showNotification(t.title, { body: t.body, tag: "vm-venc", icon: "icon-192.png", badge: "icon-192.png", data: { url: "./" } });
    if (!forcar) { c.ultimo = diaKey(); await notifSalva(c); } return true; } catch (e) { console.warn(e); return false; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") notifVerifica(); });
// app aberto antes das 08h: dispara na hora certa; depois confere de novo a cada 15 min (cobre o celular que dormiu)
function notifAgenda() { const n = new Date(), alvo = new Date(n.getFullYear(), n.getMonth(), n.getDate(), NOTIF_HORA, 0, 5); if (alvo > n) setTimeout(() => { notifVerifica(); notifAgenda(); }, alvo - n); else setTimeout(() => { notifVerifica(); notifAgenda(); }, 15 * 60 * 1000); }
notifAgenda();
function notifAbrir() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "notifModal";
  const sup = notifSuporte(), perm = sup ? Notification.permission : "unsupported", c = notifCfg(), admin = PERFIL === "Admin";
  const opc = [1, 2, 3, 5, 7, 10, 15, 20, 30], estado = !sup ? "Este navegador não permite notificações." : perm === "denied" ? "As notificações estão bloqueadas para o app. Libere nas configurações do celular (Configurações → Apps → Valida+/Chrome → Notificações)." : c.on && perm === "granted" ? "Ativadas neste aparelho." : "Desativadas.";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Notificações"><div class="sheethead"><h2>🔔 Notificações</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note" id="nfEst">${esc(estado)}</p>
    <label class="nfrow"><span><b>Avisar sobre vencimentos</b><small>Todos os dias, de segunda a domingo, às 08h</small></span><input type="checkbox" id="nfOn" ${c.on && perm === "granted" ? "checked" : ""} ${!sup || perm === "denied" ? "disabled" : ""}></label>
    <label class="nfrow"><span><b>Avisar quando faltar até</b><small>Você escolhe o prazo</small></span><select id="nfDias">${opc.concat(opc.includes(c.dias) ? [] : [c.dias]).sort((a, b) => a - b).map(d => `<option value="${d}" ${d === c.dias ? "selected" : ""}>${d} dia${d > 1 ? "s" : ""}</option>`).join("")}</select></label>
    ${admin ? `<label class="nfrow"><span><b>Setores</b><small>Só você, Admin, escolhe</small></span><select id="nfSet"><option value="both" ${c.setores.length > 1 ? "selected" : ""}>FLV e Perecíveis</option><option value="FLV" ${c.setores.length === 1 && c.setores[0] === "FLV" ? "selected" : ""}>Só FLV</option><option value="PER" ${c.setores.length === 1 && c.setores[0] === PER ? "selected" : ""}>Só Perecíveis</option></select></label>` : ""}
    <button type="button" class="primary big" id="nfTeste" style="margin-top:8px" ${!sup || perm === "denied" ? "disabled" : ""}>Testar agora</button>
    <p class="note" style="margin-top:12px">Como funciona: no <b>Android</b>, com o app instalado na tela inicial, o aviso chega mesmo com o app fechado (o aviso sai a partir das 08h; o horário exato quem decide é o Android, então pode chegar alguns minutos ou horas depois). No <b>iPhone</b> o aviso aparece quando você abre o app depois das 08h. Vale por aparelho: cada pessoa configura o seu.</p></section>`;
  document.body.appendChild(bg);
  const le = () => { const v = bg.querySelector("#nfSet") ? bg.querySelector("#nfSet").value : null; return { on: bg.querySelector("#nfOn").checked, dias: Number(bg.querySelector("#nfDias").value), setores: v === "FLV" ? ["FLV"] : v === "PER" ? [PER] : v === "both" ? ["FLV", PER] : c.setores, ultimo: "" }; };
  const salva = async () => { await notifSalva(le()); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); };
  bg.querySelector("#nfOn").onchange = async e => { if (e.target.checked && Notification.permission !== "granted") { const r = await Notification.requestPermission(); if (r !== "granted") { e.target.checked = false; bg.querySelector("#nfEst").textContent = "Sem permissão, as notificações não podem ser ativadas."; if (r === "denied") e.target.disabled = true; return; } }
    await salva(); bg.querySelector("#nfEst").textContent = e.target.checked ? "Ativadas neste aparelho." : "Desativadas."; if (e.target.checked) toast("Notificações ativadas."); };
  bg.querySelector("#nfDias").onchange = salva; if (bg.querySelector("#nfSet")) bg.querySelector("#nfSet").onchange = salva;
  bg.querySelector("#nfTeste").onclick = async () => { if (Notification.permission !== "granted") { const r = await Notification.requestPermission(); if (r !== "granted") return toast("Sem permissão para notificar."); }
    const c2 = le(); store.set(NTK, { ...c2, on: bg.querySelector("#nfOn").checked }); const ok = await notifVerifica(true); if (ok) toast("Notificação enviada. Veja a barra do celular."); };
}
$("mnNotif").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } notifAbrir(); };
const mnFecha = () => { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); };
$("mnSaude").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } saudeAbrir(); };
const tabInicial = () => SETOR === PER ? "Loja" : SETOR === KOR ? "Contagem" : "Doacao";
function trocaSetor(alvo) {   // troca FLV / Perecíveis / KÓRIN sem recarregar a página
  if (alvo === SETOR || ![ "FLV", PER, KOR ].includes(alvo)) return;
  if (PERFIL !== "Admin" && alvo !== PERFIL) return;   // só o Admin troca de setor
  try { if (typeof stopScanner === "function") stopScanner(); closeModal(); } catch (e) {}
  const todos = db ? rawAll : products.concat(lixeira, outros);   // todos os cadastros, de todos os setores
  if (SETOR === "FLV") etqFlv = labels;
  SETOR = alvo; try { sessionStorage.setItem("validamais-setor", alvo); } catch (e) {}
  derivaSetor(); separaLixo(todos); lixoBtn();
  DK = chaveSetor("validamais-doacao"); don = store.get(DK, null) || { itens: [], inicio: new Date().toISOString() }; dSel = ""; dVal = "";
  EK = chaveSetor(EK_FLV); EHK = chaveSetor("validamais-etqhist");
  labels = alvo === "FLV" ? (etqFlv || store.get(EK_FLV, [])) : store.get(EK, []); pend = null; eHits = []; eFiltro = "";
  ["search", "cBusca", "eBusca", "dBusca", "kBusca"].forEach(i => { const e = $(i); if (e) e.value = ""; }); $("eRes").innerHTML = ""; if ($("kSug")) $("kSug").innerHTML = "";
  cFiltro = ""; retView = false; $("statusFilter").value = "";
  fillCategories(); $("categoryFilter").dataset.sig = ""; $("categoryFilter").value = CATSET; store.set(LC, CATSET);
  cadReset(); if (typeof kEscolhe === "function") kEscolhe(null);
  pintaSetor(); rotulosSetor();
  render(); cadPaint(); renderDon(); renderLabels(); kPaint();
  tab(tabInicial()); window.scrollTo(0, 0); }
tab(tabInicial());

// ---------- aba Etiquetas ----------
const EK_FLV = "validamais-etiquetas";
let EK = chaveSetor(EK_FLV), etqFlv = null;   // etqFlv: lista do FLV guardada enquanto se trabalha em outro setor
const EUK = "validamais-etq-uni";   // EUK: código original -> código do sistema (só para a lista de etiquetas)
const uniCode = c => (c && store.get(EUK, {})[c]) || c;
const SZ = { P: { w: 63, h: 30, cols: 3, rows: 9, nome: 8, preco: 15, cod: 6, bar: 6 }, M: { w: 95, h: 50, cols: 2, rows: 5, nome: 12, preco: 26, cod: 8, bar: 12 }, G: { w: 190, h: 90, cols: 1, rows: 3, nome: 20, preco: 52, cod: 11, bar: 24 } };
let labels = store.get(EK, []), pend = null, eHits = [], eFiltro = "";
// itens pesados (FLV/Padaria) usam o código de balança; os demais usam o EAN
const codeText = c => c.code ? `${c.kg ? "Código de balança" : "EAN"}: ${c.code}` : "⚠ Sem EAN nem código de balança cadastrado para este produto.";
const labelCode = p => p.barcode ? { code: String(p.barcode), kg: false } : p.codigo_balanca ? { code: String(p.codigo_balanca), kg: true } : { code: "", kg: false };   // etiqueta: EAN se o produto tem; senão o código de balança; nunca o de doação
function labelDropMany(its) {
  const idx = its.map(l => ({ l, x: labels.indexOf(l) })).filter(o => o.x >= 0).sort((a, b) => a.x - b.x); if (!idx.length) return;
  idx.slice().reverse().forEach(o => labels.splice(o.x, 1)); store.set(EK, labels); renderLabels();
  toast(idx.length > 1 ? idx.length + " etiquetas removidas." : "Etiqueta removida.", "Desfazer", () => { idx.forEach(o => labels.splice(Math.min(o.x, labels.length), 0, o.l)); store.set(EK, labels); renderLabels(); });
}
// etiquetas já na lista: se o produto tem EAN, mostra o EAN (em vez do código de balança); sem EAN, volta o código de balança
function etqFixEan() {
  if (!products.length) return; let mud = false;
  labels.forEach(l => {
    if (!l.kg && l.code) return;
    const p = products.find(x => pkey(x) === l.key || norm(x.name || "") === norm(l.nome)); if (!p) return;
    const c = labelCode(p), ant = l.plu || l.orig || l.code; if (!c.code && !ant) return;
    const cod = c.code || ant, kg = c.code ? c.kg : true;
    if (l.orig !== cod || l.kg !== kg) { l.orig = cod; l.code = uniCode(cod); l.kg = kg; mud = true; } });
  if (mud) store.set(EK, labels);
}
function renderLabels() {
  etqFixEan();
  $("eLimpa").classList.toggle("hidden", labels.length <= 5); { const n = labels.filter(l => l.ok).length; $("eMarc").textContent = labels.length ? `✓ ${n} de ${labels.length} já colocadas para impressão` : ""; } $("eSumP").textContent = labels.length; $("eSumQ").textContent = labels.reduce((s, l) => s + (Number(l.qtd) || 0), 0);
  const mapaE = codMapa(), infoE = labels.map(l => ({ rev: revOn(l.nome), dup: dupLabel(l, mapaE) }));
  filtBar($("eFilt"), eFiltro, infoE.filter(o => o.rev).length, infoE.filter(o => o.dup.length).length);
  const ord = { P: 0, M: 1, G: 2 };   // lista única: primeiro os P, depois M, depois G (mantém a ordem de inclusão dentro de cada tamanho)
  $("eLista").innerHTML = labels.length ? labels.map((l, i) => ({ l, i })).sort((a, b) => (ord[a.l.tam || "M"] - ord[b.l.tam || "M"]) || (a.i - b.i)).filter(({ i }) => !eFiltro || (eFiltro === "rev" ? infoE[i].rev : infoE[i].dup.length)).map(({ l, i }) => `<div class="crwrap"><div class="crw${l.ok ? " done" : ""}${infoE[i].rev ? " rv" : ""}" data-li="${i}"><button type="button" class="lchk" data-lchk="${i}" role="checkbox" aria-checked="${l.ok ? "true" : "false"}" aria-label="Já colocada para impressão: ${esc(l.nome)}">${l.ok ? "✓" : ""}</button><div class="crl"><div class="ccode${(l.code || "").length > 14 ? " long" : ""}">${l.code ? esc(l.code) : "SEM CÓDIGO"}${l.orig && l.orig !== l.code ? ` <span class="unib">unificado</span>` : ""}${infoE[i].rev ? ` <span class="rvtag">🚩 revisar</span>` : ""}${infoE[i].dup.length ? ` <span class="duptag" data-dupi="${i}">⚠ repetido</span>` : ""}</div><div class="cname">${esc(l.nome)}</div></div><div class="crr"><div class="cqty">${l.qtd}${(l.tam || "M") !== "M" ? `<span class="tbadge">${l.tam}</span>` : ""}</div></div><button type="button" class="crx" data-ldrop="${i}" aria-label="Remover etiqueta: ${esc(l.nome)}">✕</button></div></div>`).join("") : '<p class="empty">Nenhum item na lista.</p>';
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
  stopScanner(); closeModal();
  const scale = isScale(code), item = scale ? Number(parseScale(code).item) : 0;
  let p = scale ? products.find(x => x.codigo_balanca && Number(x.codigo_balanca) === item) : products.find(x => x.barcode === code);
  sinal(p ? "ok" : "novo");
  if (!p) { const r = await askNewProduct(code, scale, scale ? String(item) : ""); if (!r) return;
    p = registerProduct({ name: r.nome, barcode: scale ? "" : code, codigo_balanca: scale ? String(item) : "" }); }
  labelPick(p, scale ? "" : code);
}
$("eScan").onclick = () => openScan("etiqueta");

// ---------- aba Pesáveis (Perecíveis): produtos vendidos por peso / com código de balança ----------
function pesaveis() {
  return products.filter(p => !p.retirado && p.category === PER && (p.codigo_balanca || (/^\d+$/.test(String(p.barcode || "")) && String(p.barcode).length < 8)));
}
// busca inteligente: ignora acento e maiúscula, aceita várias palavras em qualquer ordem, início de palavra, trecho do PLU/código interno/EAN (começo, fim ou meio) e pequenos erros de digitação
function pesBusca(all, qraw) {
  const q = norm(qraw).trim(); if (!q) return { rows: all, toks: [] };
  const toks = q.split(/\s+/).filter(Boolean), sc = [];
  all.forEach(p => {
    const nm = norm(p.name || ""), pal = nm.split(/[^a-z0-9]+/).filter(Boolean), cods = [p.codigo_balanca, p.codigo_doacao, p.barcode].map(c => norm(String(c || "")));
    let total = 0, ok = true;
    for (const t of toks) {
      let s = 0;
      for (const c of cods) { if (!c) continue; if (c === t) s = Math.max(s, 100); else if (/^\d+$/.test(t)) { if (c.startsWith(t)) s = Math.max(s, 70); else if (c.endsWith(t)) s = Math.max(s, 60); else if (c.includes(t)) s = Math.max(s, 40); } }
      if (!s) { if (pal.includes(t)) s = 80; else if (pal.some(w => w.startsWith(t))) s = 70; else if (nm.includes(t)) s = 45;
        else if (t.length >= 4 && !/^\d+$/.test(t)) { if (pal.some(w => lev(w, t) <= (t.length >= 7 ? 2 : 1))) s = 25; else if (pal.some(w => lev(w.slice(0, t.length), t) <= 1)) s = 18; } }
      if (!s) { ok = false; break; } total += s;
    }
    if (ok) sc.push({ p, s: total / toks.length + (nm.startsWith(q) ? 20 : 0) });
  });
  sc.sort((a, b) => b.s - a.s || String(a.p.name || "").localeCompare(String(b.p.name || ""), "pt-BR", { sensitivity: "base" }));
  return { rows: sc.map(x => x.p), toks };
}
function pesHl(name, toks) {   // destaca no nome o que foi digitado
  name = String(name || ""); const nm = norm(name); if (!toks.length || nm.length !== name.length) return esc(name);
  const mk = new Array(name.length).fill(false); toks.forEach(t => { if (/^\d+$/.test(t)) return; const i = nm.indexOf(t); if (i >= 0) for (let k = i; k < i + t.length; k++) mk[k] = true; });
  let out = "", open = false; for (let i = 0; i < name.length; i++) { if (mk[i] && !open) { out += "<mark>"; open = true; } if (!mk[i] && open) { out += "</mark>"; open = false; } out += esc(name[i]); } return out + (open ? "</mark>" : "");
}
function renderPesaveis() {
  const box = $("pesLista"); if (!box) return;
  const q = norm(($("pesBusca") || {}).value || "");
  const all = pesaveis().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" }));
  const { rows, toks } = pesBusca(all, ($("pesBusca") || {}).value || "");
  if ($("pesInfo")) $("pesInfo").textContent = q ? `${rows.length} de ${all.length} pesáveis` : `${all.length} pesáveis`;
  box.innerHTML = rows.length ? rows.map(p => {
    const dl = daysLeft(p.expiry), plu = p.codigo_balanca || "", itn = p.codigo_doacao || "";
    const bc = String(p.barcode || ""), esq = plu ? `<span class="pesc plu"><i>PLU</i><b>${esc(plu)}</b></span>` : bc ? `<span class="pesc cod"><i>CÓD</i><b>${esc(bc)}</b></span>` : `<span class="pesc plu vz"><i>PLU</i><b>—</b></span>`;
    const cods = esq + `<span class="pesc itn${itn ? "" : " vz"}"><i>INTERNO</i><b>${itn ? esc(itn) : "—"}</b></span>`;
    return `<div class="pesrow${pesOpen === p.id ? " open" : ""}" data-pes="${esc(p.id)}"><div class="pesn"><span class="pescods">${cods}</span><div class="pesl"><b class="pesnome">${iconeDe(p) ? `<span class="ico" data-id="${esc(p.id)}">${iconeDe(p)}</span>` : ""}${pesHl(p.name, toks)}</b></div></div><div class="pesact"><button type="button" class="pesb primary" data-etq="${esc(p.id)}">🏷️ Lançar etiqueta</button><button type="button" class="pesb secondary" data-pedit="${esc(p.id)}">✏️ Editar</button></div></div>`;
  }).join("") : `<div class="pesvazio"><b>${q ? "Nada encontrado." : "Nenhum pesável por aqui."}</b>${q ? "Tente outro nome ou código." : "Cadastre em Perecíveis um produto com código de balança ou código interno curto para ele aparecer aqui."}</div>`;
}
$("pesBusca").oninput = renderPesaveis;
$("pesLista").onclick = e => {
  const ic = e.target.closest(".ico"); if (ic) { iconePicker(ic.dataset.id); return; }
  const b = e.target.closest("[data-etq]"); if (b) { const p = products.find(x => x.id === b.dataset.etq); if (p) labelPick(p); return; }
  const ed = e.target.closest("[data-pedit]"); if (ed) { edit(ed.dataset.pedit); return; }
  const r = e.target.closest("[data-pes]"); if (r) { pesOpen = pesOpen === r.dataset.pes ? "" : r.dataset.pes; document.querySelectorAll("#pesLista .pesrow").forEach(x => x.classList.toggle("open", x.dataset.pes === pesOpen)); }
};
$("pesBipar").onclick = () => openScan("etiqueta");
$("pesNovo").onclick = () => openForm();

// ---------- histórico de etiquetas já impressas (3 dias) ----------
let EHK = chaveSetor("validamais-etqhist");
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
  if (!pend) return; if (!pend.tam) return toast("Escolha o tamanho: P, M ou G."); buzz(); logAtv("etiqueta", `${pend.nome} · ${pend.tam} × ${Math.max(1, Math.round(Number($("eQtd").value) || 1))}`);
  labels.push({ nome: pend.nome, code: uniCode(pend.code), orig: pend.code, kg: pend.kg, tam: pend.tam || "M", key: pkey(pend.src), qtd: Math.max(1, Math.round(Number($("eQtd").value) || 1)) }); store.set(EK, labels);
  pend = null; $("ePend").classList.add("hidden"); $("eBusca").value = ""; $("eRes").innerHTML = ""; renderLabels(); { const tgt = labels[labels.length - 1], q = () => document.querySelector('#eLista .crw[data-li="' + labels.indexOf(tgt) + '"]'); vmOk(q); setTimeout(() => etqEscrever(q()), 120); } toast("Item adicionado à lista.");
};
function labelDup(i) { const l = labels[i]; if (!l) return; const ord = ["P", "M", "G"], atual = l.tam || "M", novo = ord[(ord.indexOf(atual) + 1) % 3];
  labels.splice(i + 1, 0, { ...l, tam: novo, qtd: 1, ok: false, dup: true }); store.set(EK, labels); renderLabels(); lmOpen(i + 1); toast("Duplicado: escolha o tamanho e a quantidade."); }
$("eFilt").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; eFiltro = eFiltro === b.dataset.f ? "" : b.dataset.f; renderLabels(); };
$("eLista").onclick = e => {
  const di = e.target.closest("[data-dupi]"); if (di) { const l = labels[Number(di.dataset.dupi)]; if (l) toast("⚠ " + dupTxt(dupLabel(l))); return; }
  const dd = e.target.closest("[data-ldrop]"); if (dd) { const l = labels[Number(dd.dataset.ldrop)]; if (l) labelDropMany([l]); return; }   // ✕: remove já, com «Desfazer»
  const dp = e.target.closest("[data-ldup]"); if (dp) { labelDup(Number(dp.dataset.ldup)); return; }
  const k = e.target.closest("[data-lchk]"); if (k) { const l = labels[Number(k.dataset.lchk)]; if (l) { l.ok = !l.ok; store.set(EK, labels); renderLabels(); } return; }
  // edição da etiqueta agora abre apenas ao segurar o item (ver long-press abaixo); clique simples não abre mais
};
$("lmRev").onclick = () => { const l = labels[lmI]; if (!l) return; const on = !revOn(l.nome); revSet(l.nome, on); $("lmRev").textContent = on ? "🚩 Tirar a marca de revisar" : "🚩 Marcar para revisar"; renderLabels(); toast(on ? "Marcado para revisar (também aparece nos Cadastros)." : "Marca de revisão removida."); };
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
function lmOpen(i) { const l = labels[i]; if (!l) return; lmI = i; $("lmNome").textContent = l.nome; $("lmCod").textContent = (l.code ? (l.kg ? "Código de balança: " : "EAN: ") + l.code : "Sem código") + (dupLabel(l).length ? " · ⚠ " + dupTxt(dupLabel(l)) : ""); $("lmRev").textContent = revOn(l.nome) ? "🚩 Tirar a marca de revisar" : "🚩 Marcar para revisar"; lmDraw(); $("lModal").classList.remove("hidden"); if (navigator.vibrate) navigator.vibrate(40); }
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
  const L = () => SETOR === "FLV" ? labels : (etqFlv || (etqFlv = store.get(EK_FLV, [])));   // a nuvem só sincroniza a lista do FLV, mesmo com outro setor aberto
  const setL = v => { if (SETOR === "FLV") labels = v; else etqFlv = v; };
  function ensure() {                     // todo item precisa de id próprio e de posição (ord) para ficar na mesma ordem em todos os aparelhos
    const labels = L();
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
    L().forEach(l => {
      ids.add(l.id); const j = canon(body(l));
      if (last.get(l.id) === j) return;
      last.set(l.id, j); V.setDoc(V.doc(db, COL, l.id), JSON.parse(j)).catch(fail);
    });
    [...last.keys()].forEach(id => { if (!ids.has(id)) { last.delete(id); V.deleteDoc(V.doc(db, COL, id)).catch(fail); } });
  }
  store.set = (k, v) => { baseSet(k, v); if (k === EK_FLV) push(); };
  function adopt(snap) {
    if (!ready && snap.metadata.fromCache && !snap.docs.length) return;      // ainda sem resposta do servidor
    const remote = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (!ready) {
      ready = true;
      if (!remote.length && L().length && !localStorage.getItem(FLAG)) {  // nuvem vazia e este aparelho tem lista: sobe a dele
        baseSet(FLAG, 1); push(); return;
      }
      baseSet(FLAG, 1);
      if (L().length && remote.length) baseSet(EK_FLV + "-bkp", L());       // guarda cópia da lista antiga deste aparelho
    }
    remote.sort((a, b) => ((a.ord || 0) - (b.ord || 0)) || (a.id < b.id ? -1 : 1));
    last.clear(); remote.forEach(r => last.set(r.id, canon(body(r))));
    const sig = a => a.map(x => x.id + canon(body(x))).join("|");
    if (sig(remote) === sig(L())) return;                                     // nada mudou (eco da nossa própria escrita)
    if (SETOR !== "FLV") { setL(remote); baseSet(EK_FLV, remote); return; }    // outro setor aberto: só atualiza a lista do FLV guardada
    const modal = $("lModal"), aberto = modal && !modal.classList.contains("hidden"), cur = aberto && labels[lmI] ? labels[lmI].id : null;
    labels = remote; baseSet(EK, labels);
    if (aberto) { const ni = cur ? labels.findIndex(l => l.id === cur) : -1; if (ni < 0) modal.classList.add("hidden"); else lmI = ni; }
    renderLabels(); if (aberto && lmI >= 0 && labels[lmI]) lmDraw();
  }
  try { V.onSnapshot(V.collection(db, COL), { includeMetadataChanges: true }, adopt, fail); } catch (e) { fail(e); }
})();
(function () { const box = $("eLista"); let t = null, x0 = 0, y0 = 0;
  const stop = () => { clearTimeout(t); t = null; };
  box.addEventListener("pointerdown", e => { const r = e.target.closest(".crw"); if (!r || e.target.closest("[data-ldrop],[data-lchk],[data-ldup]")) return; x0 = e.clientX; y0 = e.clientY;
    const i = Number(r.dataset.li); t = setTimeout(() => { t = null; lmOpen(i); }, 800); });
  box.addEventListener("pointermove", e => { if (t && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) stop(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(n => box.addEventListener(n, stop));
  box.addEventListener("contextmenu", e => { if (e.target.closest(".crw")) e.preventDefault(); }); })();

// (apagar etiqueta: ✕ em cada linha, direto e com «Desfazer»; também na folha da etiqueta)

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
