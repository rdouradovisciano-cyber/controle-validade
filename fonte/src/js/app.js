/* app.js */
(() => {
"use strict";
if (window.__LOGIN_WAIT) return;
const C = window.VALIDA_CONFIG || {}, V = window.V || {}, fb = C.firebase || {};
const PER = "Perecíveis";
const CATS = ["Ovos","FLV","Padaria","Laticínios","Mercearia","Bebidas","Congelados","Higiene e limpeza","Outros", PER];
// setor escolhido na abertura (sessionStorage): "FLV" (tudo que não é Perecíveis, como sempre foi) ou "Perecíveis" (cadastros e validades próprios)
// perfil do aparelho (escolhido uma vez): "FLV" e "Perecíveis" entram direto e só nesse setor; "Admin" acessa os dois
const PERFIL_K = "validamais-perfil";
let PERFIL = (() => { try { const s = localStorage.getItem(PERFIL_K); return s === "FLV" || s === PER || s === "Admin" ? s : null; } catch (e) { return null; } })();
// v506: Admin volta no último setor aberto (localStorage), em vez de sempre FLV
let SETOR = (() => { if (PERFIL === "FLV" || PERFIL === PER) return PERFIL; try { const s = localStorage.getItem("validamais-setor-adm") || sessionStorage.getItem("validamais-setor"); return s === PER ? s : "FLV"; } catch (e) { return "FLV"; } })();
const setorDe = p => p.category === PER ? PER : "FLV";   // Perecíveis tem cadastro próprio; FLV usa o cadastro «FLV» e as demais categorias
const doSetor = p => { const s = setorDe(p); if (SETOR === PER) return s === PER; return s !== PER; };
let formBip = false;   // o código do produto novo veio do bipe (ou de um produto já cadastrado)
let CATS_VIS, CATSET;   // CATSET = categoria gravada nos cadastros do setor atual
const derivaSetor = () => { CATS_VIS = SETOR === PER ? [PER] : CATS.filter(c => c !== PER); CATSET = SETOR === PER ? PER : "FLV"; document.body.dataset.setor = SETOR; document.body.dataset.perfil = PERFIL || ""; };
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
function perfilEscolher(troca, comAdmin) {   // pergunta uma vez qual é o setor deste aparelho
  const bg = document.createElement("div"); bg.className = "askbg"; bg.id = "perfilBg";
  const op = (v, ic, t, s) => `<button type="button" class="perfop${PERFIL === v ? " on" : ""}" data-p="${v}"><span>${ic}</span><b>${t}</b><small>${s}</small></button>`;
  bg.innerHTML = `<div class="ask perfil"><div class="ai">👤</div><h3>${troca ? "Perfil deste aparelho" : "Qual é o seu setor?"}</h3><p>${troca ? "Escolha o novo perfil." : "Você escolhe uma vez e o app abre direto no seu setor."}</p>
    ${op("FLV", "🥬", "FLV", "Hortifruti")}${op(PER, "🧀", "Perecíveis", "Validades e etiquetas")}${comAdmin || PERFIL === "Admin" ? op("Admin", "🛡️", "Admin", "Acesso a todos os setores") : ""}${troca ? '<button type="button" class="secondary" data-x style="margin-top:8px;width:100%">Cancelar</button>' : ""}</div>`;
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
let novoF = false, novoVisto = new Set(), novoIni = false, meuNovo = 0;   // «Últimos lançados»: filtro ligado · lotes que já tocaram o efeito · 1º desenho feito · hora do lote que ESTE aparelho acabou de lançar (declarados aqui em cima: o render() roda cedo)
const NOVO_MS = 30 * 60 * 1000, NOVO_N = 15;   // «NOVO» fica 30 min no item; o filtro mostra os 15 últimos
const lancMs = p => { const v = p.createdAt; if (v === null) return Date.now(); const n = v && v.toMillis ? v.toMillis() : Number(v); return n > 0 ? n : 0; };   // quando o lote foi lançado (createdAt null = acabou de ser enviado, a nuvem ainda não carimbou)
let curTab = "Loja", tierF = "", openId = "", pesOpen = "", acaoF = "";   // pesOpen: pesável aberta (só ela mostra «Lançar etiqueta» e «Editar»); pesTipo: atalho de tipo escolhido na aba Pesáveis
//    // tierF: filtro por faixa de urgência (v/h/a/y); openId: linha de validade aberta
const LOJA = C.loja || "Sam's Club Radial Leste";
const EMPTY_FLV = '<div class="empty"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#9db8a4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 28h44l-5 22a4 4 0 0 1-4 3H19a4 4 0 0 1-4-3z"/><path d="M22 28c0-9 4-16 10-16s10 7 10 16"/><path d="M32 12c0-4 3-7 8-7 0 5-3 8-8 7z"/></svg><p>Nenhum produto do FLV com validade para vencer no momento.</p></div>';
const SKEL = '<div class="skel" role="status" aria-label="Carregando produtos">' + [58, 72, 46, 64].map((w, k) => `<article class="pitem prok skelc" aria-hidden="true" style="--d:${k * 0.15}s"><div class="pi-main"><div class="sk sk-ic"></div><div class="pi-txt"><div class="sk sk-t" style="width:${w}%"></div><div class="sk sk-m"></div></div><div class="sk sk-b"></div></div></article>`).join("") + '</div>';
let products = [], lixeira = [], outros = [], rawAll = [], db = null, scanner = null, toastTimer, carregando = false;   // carregando: Firebase ainda não respondeu (mostra silhuetas)
window.vmProducts = () => products;
window.vmRegister = o => registerProduct(o);
window.vmDb = () => db;
const cloud = !!fb.apiKey && !/COLE_|SEU_/.test(fb.apiKey + fb.projectId);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
// código de etiqueta usado também pela aba Pesáveis: declarado aqui em cima porque a lista pode ser desenhada já na abertura
const labelCode = p => p.barcode ? { code: String(p.barcode), kg: false } : p.codigo_balanca ? { code: String(p.codigo_balanca), kg: true } : { code: "", kg: false };   // etiqueta: EAN se o produto tem; senão o código de balança; nunca o de doação
// aba Pesáveis: o cadastro abrevia o nome (QJ/QJO = queijo, MUSS = mussarela, PC = peça, FRAC = fracionado…), então a busca entende as duas formas
const PES_ABREV = { qj: "queijo", qjo: "queijo", queijos: "queijo", muss: "mussarela", mussarelas: "mussarela", pc: "peca", peca: "peca", pecas: "peca", frac: "fracionado", fracao: "fracionado", fracionado: "fracionado", fracionada: "fracionado", fracionados: "fracionado", fracionadas: "fracionado", def: "defumado", defumado: "defumado", defumada: "defumado", defumados: "defumado", defumadas: "defumado", fat: "fatiado", fatiado: "fatiado", fatiada: "fatiado", fatiados: "fatiado", fatiadas: "fatiado", cond: "condimentado", condimentado: "condimentado", condimentada: "condimentado", condimentados: "condimentado", condimentadas: "condimentado" };
const pesCanon = t => PES_ABREV[t] || t;   // palavra do nome na forma “cheia”
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ico = (n, c = "ic ti") => `<svg class="${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;   // ícone de linha do sprite (index.html) — no lugar de emoji nos botões e rótulos
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
// v476: notas mais usadas — ranking = quantas vezes o mesmo texto aparece nas notas atuais (aparelho + nuvem) + contador local de usos; completa com sugestões prontas
const NTF = "validamais-notas-freq", NT_PRONTAS = ["Já na promoção", "Gôndola 3", "Conferir", "Vai para doação", "Embalagem estufada", "Chamar fornecedor"];
const notasTop = (n = 5) => { const sc = new Map(), nk = t => norm(t).trim(), nome = {};
  const soma = (t, k) => { const c = String(t || "").trim(); if (!c) return; const key = nk(c); nome[key] = nome[key] || c; sc.set(key, (sc.get(key) || 0) + k); };
  Object.values(store.get(NTLK, {})).forEach(v => soma(v && v.t, 1)); Object.values(notasNuvem).forEach(v => soma(v && v.t, 1)); Object.entries(store.get(NTF, {})).forEach(([t, c]) => soma(t, c));
  const oc = new Set(ntOcultas().map(nk));
  const top = [...sc.entries()].filter(([k]) => !oc.has(k)).sort((a, b) => b[1] - a[1]).map(([k]) => nome[k]);
  NT_PRONTAS.forEach(t => { if (!oc.has(nk(t)) && !top.some(x => nk(x) === nk(t))) top.push(t); }); return top.slice(0, n); };
let ntEdit = false;   // v478: o X dos atalhos só aparece no modo «Editar atalhos»
const NTH = "validamais-notas-ocultas", ntOcultas = () => store.get(NTH, []);   // v477: atalhos que a pessoa tirou da lista
const notaUso = t => { const c = String(t || "").trim(); if (!c) return; const f = store.get(NTF, {}); f[c] = (f[c] || 0) + 1; store.set(NTF, f); };
function notaSalva(id, texto) {
  const t = String(texto || "").trim().slice(0, 60), v = { t, por: myName().slice(0, 40), em: Date.now() };
  if (!t && !notaDe(id)) return;
  if (t) notaUso(t);
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
const iconeDe = p => { return "";   // v471: emojis removidos de vez — só fotos (sem foto aparece um quadrado neutro com câmera)
  if (!iconesOn() || !p || p.category !== PER) return ""; const esc1 = icoEscolhido(p); if (esc1 !== null && esc1 !== undefined) return esc1; const n = String(p.name || "").toLowerCase(); const m = ICONES.find(([r]) => r.test(n + " ")); return m ? m[1] : "📦"; };
// ---------- foto do produto (Perecíveis e FLV): uma miniatura por nome, em sh_cfg/foto-<nome>; só é baixada quando o item é aberto ----------
const FTK = "validamais-fotos-per", fotoK = n => "foto-" + icKey(n), fotoCache = {};
function fotoHtml(k, ed) { const d = fotoCache[k]; if (d === undefined) return "";
  const adm = PERFIL === "Admin", img = d ? `<img class="pf-img" src="${d}" alt="Foto do produto" data-fz="1">` : "";
  const bt = (a, t) => `<button type="button" class="secondary pf-btn" ${a}="1">${t}</button>`;
  if (!d) return bt("data-fadd", ico("cam") + "Tirar foto") + bt("data-fgal", ico("img") + "Escolher imagem");   // sem foto: botões no cartão
  if (!ed) return "";                                                                             // v472: com foto, o cartão aberto não repete a imagem (ela já está no quadrado e abre em tela cheia ao toque)
  return img + (adm ? bt("data-fadd", ico("cam") + "Trocar") + bt("data-fgal", ico("img") + "Outra imagem") + bt("data-fdel", ico("lixo") + "Apagar") : ""); }
function fotoPaint(id) { fotoVer++; const p = products.find(x => x.id === id); if (!p) return; document.querySelectorAll(`.pi-foto[data-id="${CSS.escape(id)}"]`).forEach(el => { el.innerHTML = fotoHtml(fotoK(p.name), el.dataset.ed === "1"); }); }
function fotoCarrega(id) {
  const p = products.find(x => x.id === id); if (!p) return; const k = fotoK(p.name);
  if (fotoCache[k] === undefined && fotosPronto) fotoCache[k] = "";   // a consulta geral já trouxe todas: sem ela, não tem foto
  if (fotoCache[k] !== undefined) return fotoPaint(id);
  if (!db) { const m = store.get(FTK, {}); fotoCache[k] = m[k] || ""; return fotoPaint(id); }
  let un = null, fim = false; const t = setTimeout(() => { if (!fim) { fim = true; fotoCache[k] = ""; fotoPaint(id); try { un && un(); } catch (e) {} } }, 6000);
  try { un = V.onSnapshot(V.doc(db, "sh_cfg", k), sn => { if (fim) return; fim = true; clearTimeout(t); fotoCache[k] = sn.exists() && sn.data().d ? sn.data().d : ""; fotoPaint(id); try { un && un(); } catch (e) {} }, () => { if (fim) return; fim = true; fotoCache[k] = ""; fotoPaint(id); }); } catch (e) { fotoCache[k] = ""; fotoPaint(id); }
}
// miniatura no lugar do emoji (Perecíveis e FLV): uma única consulta traz as fotos de todos os produtos e continua ouvindo mudanças
let fotosPronto = false, fotosOuvindo = false, fotosErro = false, saudeRepinta = null;
const fotoDe = p => p && iconesOn() ? (fotoCache[fotoK(p.name)] || "") : "";
const icoVazio = () => `<span class="ico-vazio" aria-hidden="true">${ico("cam", "ic")}</span>`;   // v471
const icoHtml = p => { const d = fotoDe(p), e = iconeDe(p); if (!d && !e) return iconesOn() && p && p.category === PER ? icoVazio() : "";   // inline (Pesáveis): miniatura ou emoji
  return `<span class="ico${d ? " ico-foto" : ""}" data-id="${esc(p.id)}">${d ? `<img class="ico-img" src="${d}" alt="" decoding="async">` : e}</span>`; };
const icoEmoji = p => fotoDe(p) ? "" : (iconeDe(p) ? `<span class="ico" data-id="${esc(p.id)}">${iconeDe(p)}</span>` : "");   // lista de Validades: emoji só quando não há foto
const VSK = "validamais-visao", visaoDe = () => store.get(VSK, "lista") === "grade" ? "grade" : "lista";   // v460: Validades em lista ou grade (Configurações → Cores e prazos)
// v466: nome do grupo = 1ª palavra, sem pontuação; Q, Q.J, QJ, QJO, QJEO e QUEIJOS entram todos em QUEIJO (e as abreviações do cadastro, como MUSS → MUSSARELA)
// v469: Minas, Parmesão, Provolone(te), Requeijão e Kit ficam no grupo OUTROS (pedido do usuário)
const pesGrupo = n => { const t = norm(String(n || "").trim().split(/\s+/)[0] || "").replace(/[^a-z0-9]/g, ""); if (!t) return "OUTROS"; if (/^q[jeos]{0,3}$/.test(t) || t.startsWith("queij")) return "QUEIJO"; if (/^(minas|kit|parmes|provolon|requeij)/.test(t)) return "OUTROS"; return (PES_ABREV[t] || t).toUpperCase(); };
// v467: junta o máximo possível — (1) 1ª palavra normalizada; (2) palavras parecidas (SALAME/SALAMINHO, PROVOLONE/PROVOLONETE) viram um grupo, o maior dá o nome; (3) item sozinho entra no grupo do mesmo tipo (mesmo emoji do cadastro, ex. GORGONZOLA → QUEIJO); o que sobrar vai para OUTROS
const pesTipo = p => { const m = ICONES.find(([r]) => r.test(String(p.name || "").toLowerCase() + " ")); return m ? m[1] : ""; };
function pesAgrupa(rows) {
  const gm = new Map(); rows.forEach(p => { const w = pesGrupo(p.name); (gm.get(w) || gm.set(w, []).get(w)).push(p); });
  const ks = [...gm.keys()].sort((a, b) => gm.get(b).length - gm.get(a).length || a.length - b.length), reps = [], fin = new Map();
  const parecido = (a, b) => { let c = 0; while (c < a.length && c < b.length && a[c] === b[c]) c++; return c >= 5 && c >= 0.8 * Math.min(a.length, b.length); };
  ks.forEach(k => { const r = reps.find(x => parecido(x, k)); const alvo = r || k; if (!r) reps.push(k); (fin.get(alvo) || fin.set(alvo, []).get(alvo)).push(...gm.get(k)); });
  const tipoG = {}; fin.forEach((l, k) => { if (l.length < 2) return; l.forEach(p => { const t = pesTipo(p); if (t) { (tipoG[t] = tipoG[t] || {})[k] = (tipoG[t][k] || 0) + 1; } }); });
  const outros = []; const gs = [];
  fin.forEach((l, k) => { if (l.length >= 2 || k === "OUTROS") { gs.push([k, l]); return; }
    const t = pesTipo(l[0]), c = t && tipoG[t], melhor = c && Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    if (melhor) fin.get(melhor).push(l[0]); else outros.push(l[0]); });
  const ex = gs.find(g => g[0] === "OUTROS"); if (ex) ex[1].push(...outros); else if (outros.length) gs.push(["OUTROS", outros]);   // um só OUTROS, sempre por último
  gs.sort((a, b) => (a[0] === "OUTROS") - (b[0] === "OUTROS") || a[0].localeCompare(b[0], "pt-BR"));
  gs.forEach(g => g[1].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })));
  return gs;
}
const pesAb = new Set();   // v465: grupos de Pesáveis abertos (começa vazio: tudo recolhido)
const gRec = new Set(["v", "h", "a", "y", "ok"]);   // v463: o app SEMPRE abre com os grupos de urgência recolhidos (resumo limpo); toque no título abre/fecha
const icoLado = p => fotoDe(p) || !iconesOn() || !p || p.category !== PER ? "" : `<span class="ico-tile ico-vazio" aria-hidden="true">${ico("cam", "ic")}</span>`;   // v458: emoji do produto num quadrado do mesmo tamanho da foto
// v473: a nota vira um balão amarelo no canto da foto do produto (sem foto/quadrado, o ícone continua ao lado do nome)
const leadNota = p => { const l = fotoLado(p) || icoLado(p); if (!l) return ""; const n = notaDe(p.id); return `<span class="pi-lead">${l}</span>`; };
const fotoLado = p => { const d = fotoDe(p); return d ? `<span class="ico ico-foto ico-lado" data-id="${esc(p.id)}"><img class="ico-img" src="${d}" alt="" decoding="async"></span>` : ""; };   // lista de Validades: foto na lateral
let fotoIcTimer = 0, fotoVer = 0, famMemo = { p: null, n: -1, v: -1, m: new Map() };
// foto para os balões e linhas da Doação (FLV): a do nome exato; senão a de qualquer produto da mesma família (1ª palavra: Banana, Tomate…)
function famFotos() { if (famMemo.p === products && famMemo.n === products.length && famMemo.v === fotoVer) return famMemo.m;
  const m = new Map(); products.forEach(p => { if (!p || !p.name) return; const d = fotoCache[fotoK(p.name)]; if (!d) return; const k = dFamKey(p.name); if (k && !m.has(k)) m.set(k, d); });
  famMemo = { p: products, n: products.length, v: fotoVer, m }; return m; }
function balFoto(w) { if (!iconesOn() || !w) return ""; const ex = fotoCache[fotoK(w)]; if (ex) return ex; const k = dFamKey(w); return k ? (famFotos().get(k) || "") : ""; }
function fotoIcones() { clearTimeout(fotoIcTimer); fotoIcTimer = setTimeout(() => { fotoVer++; try { render(); } catch (e) {} try { if ($("dTop6")) renderDon(); } catch (e) {} try { if ($("pesLista") && $("pesLista").children.length) renderPesaveis(); } catch (e) {}  }, 60); }
function fotosTodas() {
  if (fotosOuvindo) return; fotosOuvindo = true;
  if (!db) { const m = store.get(FTK, {}); Object.keys(m).forEach(k => { fotoCache[k] = m[k]; }); fotosPronto = true; return; }
  const t0 = Date.now();
  try { V.onSnapshot(V.query(V.collection(db, "sh_cfg"), V.where("d", ">=", "data:")), { includeMetadataChanges: true }, sn => {   // com metadata: avisa também quando só a origem muda (cache → servidor)
    sn.docChanges().forEach(c => { fotoCache[c.doc.id] = c.type === "removed" ? "" : (c.doc.data().d || ""); });
    if (!sn.metadata.fromCache || Date.now() - t0 > 6000) fotosPronto = true;
    fotoIcones(); try { saudeRepinta && saudeRepinta(); } catch (e) {}
    try { if (curTab === "Etiquetas" && SETOR === "FLV") renderLabels(); } catch (e) {}   // v501: foto chegou, repinta a lista de etiquetas
  }, e => { console.warn("fotos", e); fotosErro = true; try { saudeRepinta && saudeRepinta(); } catch (x) {} });
    setTimeout(() => { if (!fotosPronto && !fotosErro) { fotosPronto = true; try { saudeRepinta && saudeRepinta(); } catch (e) {} } }, 7000);   // se a nuvem não confirmar, vale o que veio do cache
  } catch (e) { console.warn("fotos", e); fotosErro = true; }
}
function fotoReduz(file) {   // miniatura: lado maior 360 px, JPEG (~10–25 KB)
  return new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => { URL.revokeObjectURL(u); const f = Math.min(1, 360 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * f); c.height = Math.round(im.height * f);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); let q = 0.65, d = c.toDataURL("image/jpeg", q); while (d.length > 90000 && q > 0.3) { q -= 0.1; d = c.toDataURL("image/jpeg", q); } ok(d); };
    im.onerror = () => { URL.revokeObjectURL(u); no(new Error("img")); }; im.src = u; });
}
async function fotoSalva(id, file) {
  const p = products.find(x => x.id === id); if (!p || !file) return; const k = fotoK(p.name);
  try { const d = await fotoReduz(file); fotoCache[k] = d;
    if (db) await V.setDoc(V.doc(db, "sh_cfg", k), { d, n: p.name.slice(0, 120), por: myName().slice(0, 40), em: Date.now() }); else { const m = store.get(FTK, {}); m[k] = d; store.set(FTK, m); }
    fotoPaint(id); toast("Foto salva para todos os lotes deste produto."); }
  catch (e) { console.warn(e); delete fotoCache[k]; fotoPaint(id); toast("Não consegui salvar a foto."); }
}
async function fotoGravaNome(name, file) {   // grava a foto pelo nome (usado no cadastro, antes de existir o id)
  const k = fotoK(name); try { const d = await fotoReduz(file); fotoCache[k] = d;
    if (db) await V.setDoc(V.doc(db, "sh_cfg", k), { d, n: name.slice(0, 120), por: myName().slice(0, 40), em: Date.now() }); else { const m = store.get(FTK, {}); m[k] = d; store.set(FTK, m); } return true; }
  catch (e) { console.warn(e); delete fotoCache[k]; return false; }
}
async function fotoApaga(id) {
  const p = products.find(x => x.id === id); if (!p || PERFIL !== "Admin") return; const k = fotoK(p.name);
  if (!(await askConfirm({ icon: "🗑", title: "Apagar a foto?", text: p.name, sub: "Vale para todos os aparelhos.", ok: "Apagar", cancel: "Cancelar" }))) return;
  fotoCache[k] = ""; if (db) V.deleteDoc(V.doc(db, "sh_cfg", k)).catch(e => console.warn(e)); else { const m = store.get(FTK, {}); delete m[k]; store.set(FTK, m); } fotoPaint(id);
}
function fotoZoom(src, leg) { const bg = document.createElement("div"); bg.className = "askbg fzv"; bg.innerHTML = `<button type="button" class="fz-x" aria-label="Fechar">${ico("fechar", "ic")}</button><img src="${src}" alt="Foto do produto">${leg ? `<div class="fz-leg">${leg}</div>` : ""}<small class="fz-dica">Toque duas vezes para ampliar</small>`; const im = bg.querySelector("img"); let z = false;
  im.ondblclick = e => { e.stopPropagation(); z = !z; im.classList.toggle("z", z); };
  bg.onclick = e => { if (e.target === im) return; bg.remove(); }; document.body.appendChild(bg); }
// v475: segurar a foto (0,5 s) amplia em tela cheia; um toque rápido abre/fecha o cartão normalmente
(function fotoSegurar() {
  let t = null, seg = false, x0 = 0, y0 = 0; const alvo = e => { const ic = e.target.closest && e.target.closest(".ico-foto"); return ic && ic.closest("#list, #pesLista") ? ic : null; }, para = () => { clearTimeout(t); t = null; };
  document.addEventListener("pointerdown", e => { const ic = alvo(e); if (!ic) return; seg = false; para(); x0 = e.clientX; y0 = e.clientY;
    t = setTimeout(() => { const im = ic.querySelector("img"); if (!im) return; seg = true; try { navigator.vibrate && navigator.vibrate(15); } catch (er) {} fotoZoom(im.getAttribute("src"), legFoto(ic.dataset.id)); }, 500); });
  document.addEventListener("pointermove", e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) para(); });
  ["pointerup", "pointercancel"].forEach(n => document.addEventListener(n, para));
  document.addEventListener("click", e => { if (seg && alvo(e)) { e.stopPropagation(); e.preventDefault(); } seg = false; }, true);
  document.addEventListener("contextmenu", e => { if (alvo(e)) e.preventDefault(); });
})();
const legFoto = id => { const p = products.find(x => x.id === id); return p ? `<b>${esc(nomeBonito(p.name))}</b><span>Qtd ${esc(p.quantity)} · vence ${fmtCurto(p.expiry)}</span>` : ""; };
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
const fmtCurto = e => { const f = fmt(e), m = /^(\d\d\/\d\d)\/(\d{4})$/.exec(f); return m && Number(m[2]) === new Date().getFullYear() ? m[1] : f; };   // 17/11 (sem o ano quando é o ano atual)
const MIUDAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "para", "em", "a", "o", "c/", "s/"]);
const nomeBonito = n => String(n || "").toLowerCase().replace(/[^\s]+/g, (w, i) => {   // só na exibição da lista: «QJ MUSS FAT INTERF ROHDEN KG» → «QJ Muss Fat Interf Rohden KG»
  if (/^\d+([.,]\d+)?(g|kg|ml|l|mg|un|und)$/.test(w)) return w.replace(/(\d)l$/, "$1L");   // 400g, 1kg, 500ml, 1L
  if (["uht", "pet", "uv"].includes(w)) return w.toUpperCase();
  if (/^[^aeiouáéíóúâêôãõà]{1,3}$/.test(w) && /[a-zç]/.test(w)) return w.toUpperCase();   // sem vogal e curta: KG, PC, QJ, UHT
  if (i > 0 && MIUDAS.has(w)) return w;                                                  // de, da, com…
  return w.replace(/^([^a-zà-ú0-9]*)([a-zà-ú])/, (m, p1, c) => p1 + c.toUpperCase());
});
const stLabel = p => daysLeft(p.expiry) === null ? "Sem validade" : ({ expired: "Vencido", soon: "A vencer", ok: "No prazo" })[status(p)];

function vmOk(find) {   // feedback curto: vibra e dá um "pulo" dourado na linha confirmada
  try { if (navigator.vibrate) navigator.vibrate([16, 30, 16]); } catch (_) {}
  let k = 0; const go = () => { k++; let el = null; try { el = typeof find === "function" ? find() : null; } catch (_) {}
    if (el) { el.classList.remove("vmok"); void el.offsetWidth; el.classList.add("vmok"); setTimeout(() => el.classList.remove("vmok"), 800); }
    else if (k < 6) setTimeout(go, 250); };
  setTimeout(go, 60);
}
window.vmOk = vmOk;
// ---------- últimos lançados: «NOVO» no item, efeito ao lançar e filtro com os 15 mais recentes ----------
function haQuanto(t) {   // «agora» · «há 5 min» · «há 2 h» · «ontem 14:05» · «08/11 14:05»
  const m = Math.floor((Date.now() - t) / 60000); if (m < 1) return "agora"; if (m < 60) return "há " + m + " min"; if (m < 720) return "há " + Math.floor(m / 60) + " h";
  const d = new Date(t), n = new Date(), hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), dia = x => x.toDateString();
  if (dia(d) === dia(n)) return "hoje " + hm; if (dia(d) === dia(new Date(n.getTime() - 864e5))) return "ontem " + hm;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + hm;
}
function novoEfeito() {   // o lote lançado há pouco entra com um brilho dourado (uma vez só por lote neste aparelho); no 1º desenho da abertura só marca, sem piscar tudo
  const els = [...document.querySelectorAll("#list .pitem.pnovo")];
  if (!novoIni) { if (carregando || !products.length) return; novoIni = true; els.forEach(el => novoVisto.add(el.dataset.id)); return; }
  let primeiro = null;
  els.forEach(el => { const id = el.dataset.id; if (novoVisto.has(id)) return; novoVisto.add(id); el.classList.add("chega"); setTimeout(() => el.classList.remove("chega"), 1700); if (!primeiro) primeiro = el; });
  if (!primeiro) return;
  if (meuNovo && Date.now() - meuNovo < 10000) {   // fui eu que lancei: leva o item até a tela e vibra
    meuNovo = 0; try { const gk = (/ pr(v|h|a|y)\b/.exec(primeiro.className) || [0, "ok"])[1]; if (gRec.has(gk)) { gRec.delete(gk); const lst = $("list"); lst.dataset.rec = [...gRec].join(" "); const gh = lst.querySelector(`.pgh[data-g="${gk}"]`); if (gh) { gh.classList.remove("rec"); gh.setAttribute("aria-expanded", "true"); } } } catch (e) {}
    try { primeiro.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } catch (e) {}
    try { if (fxOn() && navigator.vibrate) navigator.vibrate([16, 30, 16]); } catch (e) {}
  }
}
setInterval(() => {   // os «há 5 min» andam sozinhos e o «NOVO» some depois de 30 min, sem redesenhar a lista
  document.querySelectorAll("#list .pi-lt").forEach(e => { e.textContent = haQuanto(Number(e.dataset.lt)); });
  document.querySelectorAll("#list .pitem.pnovo").forEach(el => { if (Date.now() - Number(el.dataset.lt) >= NOVO_MS) { el.classList.remove("pnovo"); const b = el.querySelector(".pi-novo"); if (b) b.remove(); } });
}, 30000);
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
  products = meu.filter(p => !p.lixo && !venc.includes(p)).map(p => p.category === "KÓRIN" ? { ...p, category: "FLV" } : p); lixeira = meu.filter(p => p.lixo && !venc.includes(p));
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
const PH_CORTE = (() => { let c = Number(localStorage.getItem("validamais-ph-corte2") || 0); if (!c) { c = Date.now(); try { localStorage.setItem("validamais-ph-corte2", String(c)); } catch (e) {} } return c; })();   // só entra no histórico o que for cadastrado depois deste momento
const HIST_MS = 3 * 864e5;   // históricos (produtos e etiquetas) guardam no máximo 3 dias
let phBase = store.get(PHK, null), phLog = (store.get(PLK, []) || []).filter(e => Date.now() - (e.t || 0) < HIST_MS), lastAct = 0;
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); }, true));
const phLite = p => { const r = {}; Object.keys(p).forEach(k => { if (k === "foto" || k === "createdAt" || k === "updatedAt") return; r[k] = p[k]; }); return r; };
function phDiff() {
  if (db && !window.__hReady) return;
  const cur = {}; products.forEach(p => { cur[p.id] = phLite(p); });
  if (!phBase) { phBase = cur; store.set(PHK, cur); return; }
  const t = Date.now(), who = (t - lastAct < 8000) ? myName() : "outro aparelho (ou com o app fechado)", ev = [];
  const nasc = i => { const o = products.find(x => x.id === i) || {}, v = o.createdAt || o.updatedAt, n = v && v.toMillis ? v.toMillis() : Number(v); return n || 0; };
  const add = Object.keys(cur).filter(i => !phBase[i] && nasc(i) >= PH_CORTE), del = Object.keys(phBase).filter(i => !cur[i]), chg = [];
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
    const nm = x => esc(x.n || x.name || "?"), tit = e.k === "add" ? `${ico("mais")}Entrou · ${e.n} produto(s)` : e.k === "del" ? `${ico("lixo")}Saiu · ${e.n} produto(s)` : `${ico("lapis")}Alterado · ${e.n} produto(s)`;
    const lines = e.it.slice(0, 8).map(x => `<div>• ${nm(x)}${x.d ? " <small class='muted'>" + esc(x.d) + "</small>" : x.expiry ? " <small class='muted'>validade " + fmt(x.expiry) + "</small>" : ""}</div>`).join("") + (e.n > 8 ? `<div class="muted">… e mais ${e.n - 8}</div>` : "");
    return `<div class="phe ${e.k}"><b>${tit}</b><small class="muted">${phWhen(e.t)} · ${esc(e.who)}</small>${lines}${e.k === "del" ? (e.rest ? `<small class="muted">${ico("ok")}já restaurado</small>` : `<button type="button" class="secondary" data-phr="${i}">${ico("voltar")}Restaurar ${e.it.length > 1 ? "estes " + e.it.length : "este"}</button>`) : ""}</div>`;
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
  { const nr = products.filter(p => p.retirado).length; $("verRet").classList.toggle("hidden", !nr && !retView); $("verRet").innerHTML = retView ? ico("voltar") + "Voltar às validades" : ico("caixa") + `Retirados da loja (${nr})`; $("verRetTop").classList.toggle("hidden", !retView); }
  { const vt = $("verTodos"); if (vt) vt.textContent = ainda ? "Conectando…" : cat ? `Ver todos os ${products.length} cadastrados` : "Voltar ao " + SETOR; }
  // os dois atalhos saíram da tela: ficam no menu ⋮; o link só aparece quando é preciso voltar
  { $("verTodos").classList.toggle("hidden", !!cat);
    const nr2 = products.filter(p => p.retirado).length; if ($("mnTodosT")) $("mnTodosT").textContent = `Ver todos os ${products.length} cadastrados`; }
  document.querySelectorAll("#tabLoja .stats .stat").forEach((e, i) => e.classList.toggle("on", (i === 1 && st === "soon") || (i === 2 && st === "expired"))); $("countSoon").textContent = ainda ? "–" : so; $("countExpired").textContent = ainda ? "–" : ex;
  { const fora = cat ? products.filter(p => !p.retirado && p.category !== cat && daysLeft(p.expiry) !== null && daysLeft(p.expiry) >= 0 && daysLeft(p.expiry) <= 1).length : 0;
    $("outAlert").classList.toggle("hidden", !fora); $("outAlert").innerHTML = `${ico("alerta")}${fora} produto(s) de OUTROS setores vencem em até 1 dia — toque para ver todos`; }
  $("topAlert").classList.toggle("hidden", !(ex || so));
  $("topAlert").textContent = `Atenção: ${ex} vencido(s) e ${so} vencendo em breve.`;
  sirene();
  // escala de atenção: vencido · vence hoje · 1 a 3 dias (vermelho, ação imediata) · até o prazo de alerta (amarelo; 7 dias em Perecíveis)
  const prioDe = p => { const dl = daysLeft(p.expiry); if (dl === null || p.retirado) return ""; if (dl < 0) return "v"; if (dl === 0) return "h"; if (status(p) !== "soon") return ""; return dl <= visCfg().red ? "a" : "y"; };
  const PRIOI = { v: ico("s-v"), h: ico("s-h"), a: ico("s-a"), y: ico("s-y") };
  { const c = { v: 0, h: 0, a: 0, y: 0 }, lim = limit(cat || CATSET); base.forEach(p => { const k = prioDe(p); if (k) c[k]++; });
    const t = $("tiers"); if (t) { t.classList.toggle("hidden", retView); t.querySelectorAll("[data-t]").forEach(b => { b.querySelector("b").textContent = ainda ? "–" : c[b.dataset.t]; b.classList.toggle("on", tierF === b.dataset.t); b.classList.toggle("zero", !c[b.dataset.t]); });
      const ly = t.querySelector('[data-t="y"] span'); if (ly) ly.textContent = "Até " + lim + " dias";
      const IC = { v: ico("s-v", "ic ti only"), h: ico("s-h", "ic ti only"), a: ico("s-a", "ic ti only"), y: ico("s-y", "ic ti only") }; $("tiersSum").innerHTML = ["v", "h", "a", "y"].map(k => `<i class="${c[k] ? "nz" : "z"}${tierF === k ? " on" : ""}">${IC[k]}${ainda ? "–" : c[k]}</i>`).join("");
      const ab = tiersAberto(); t.classList.toggle("aberto", ab); $("tiersBar").setAttribute("aria-expanded", ab ? "true" : "false"); $("tiersTog").textContent = ab ? "▴ recolher" : "▾ ver"; } }
  // selo de lote (1/3, 2/3, 3/3): mesma conta e mesma ordem do formulário — o que vence primeiro é o Lote 1; retirado não entra
  const grupos = {}; products.forEach(p => { if (p.retirado) return; const k = p.barcode ? "b" + p.barcode : "n" + norm(p.name || ""); (grupos[k] = grupos[k] || []).push(p); });
  const lotes = {}; Object.keys(grupos).forEach(k => { const ls = grupos[k]; if (ls.length < 2) return;
    ls.sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
    ls.forEach((p, i) => { lotes[p.id] = { i: i + 1, n: ls.length }; }); });
  const hoje = products.filter(p => !p.retirado && daysLeft(p.expiry) === 0 && (!cat || p.category === cat));
  $("todayBanner").classList.toggle("hidden", !hoje.length);
  $("todayBanner").innerHTML = `${ico("s-a")}VENCEM HOJE (${hoje.length}): ` + hoje.slice(0, 5).map(p => esc(p.name)).join(", ") + (hoje.length > 5 ? "…" : "");
  if (!hoje.length) alarmed = false; else if (!alarmed && actx) { alarmed = true; alarm(); }
  const nvF = novoF && !q && !retView;
  const recOn = !!cat && !q && !tierF && !nvF && !st && !acaoF && !retView;   // v463: só recolhe quando os títulos de grupo aparecem   // «Últimos lançados» ligado (buscando ou vendo retirados, o filtro fica de lado)
  const rows = retView ? products.filter(p => p.retirado).sort((a, b) => (Number(b.retEm) || 0) - (Number(a.retEm) || 0)) : products.filter(p => q ? ((p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q) || String(p.codigo_balanca || "") === q || String(p.codigo_doacao || "").toLowerCase() === q)   // buscando: procura em TODOS os setores, com ou sem validade
      : (!p.retirado && (!cat || p.category === cat) && !((cat === "FLV" || cat === PER) && daysLeft(p.expiry) === null) && (!st || status(p) === st) && (!tierF || prioDe(p) === tierF) && (!acaoF || (daysLeft(p.expiry) ?? 9) <= 0) && (!nvF || lancMs(p) > 0)))
    .sort((a, b) => nvF ? lancMs(b) - lancMs(a) : cat ? (a.expiry || "9999").localeCompare(b.expiry || "9999")
      : (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }) || (a.expiry || "9999").localeCompare(b.expiry || "9999"))
    .slice(0, nvF ? NOVO_N : 9e9);
  let lastG = ""; const gcnt = {}; rows.forEach(p => { const k = retView ? "x" : (prioDe(p) || "ok"); gcnt[k] = (gcnt[k] || 0) + 1; });
  // v489: prévia dentro da barra do grupo (fechado): até 4 itens mais urgentes com foto e dias
  const gprev = {}; if (cat && !q && !tierF && !nvF && !retView) rows.forEach(p => { if (p.retirado) return; const k = prioDe(p) || "ok"; if (k === "ok") return; (gprev[k] = gprev[k] || []).push(p); });
  const prevHtml = g => { const l = gprev[g]; if (!l || !l.length) return ""; const fo = iconesOn();
    const th = l.slice(0, 4).map(p => { const dl = daysLeft(p.expiry), tag = dl === null ? "" : dl < 0 ? "venc." : dl === 0 ? "hoje" : dl + "d", d = fo ? fotoCache[fotoK(p.name)] : "";
      return fo ? `<div class="pgt${d ? "" : " vz"}" data-id="${esc(p.id)}">${d ? `<img src="${d}" alt="" decoding="async">` : ico("cam", "ic")}${tag ? `<u>${tag}</u>` : ""}</div>` : ""; }).join("");
    const mais = l.length > 4 ? `<div class="pgm">+${l.length - 4}</div>` : "";
    return `<div class="pgp" aria-hidden="true">${th}${mais}<div class="pgn">${l.slice(0, 4).map(p => esc(nomeBonito(p.name))).join(" · ")}${l.length > 4 ? "…" : ""}</div></div>`; };
  $("list").innerHTML = rows.length ? rows.map(p => { const dl = daysLeft(p.expiry), cls = dl === null ? "none" : dl <= 0 ? "expired" : status(p), lo = lotes[p.id];
    if (p.retirado) return `<article class="pitem prret"><div class="pi-main">${fotoLado(p) || icoLado(p)}<div class="pi-txt"><b class="pi-nome">${esc(nomeBonito(p.name))}</b><small class="pi-sub">Qtd ${esc(p.quantity)} · venceria ${fmtCurto(p.expiry)}${p.retPor ? " · " + esc(p.retPor) : ""}</small></div><div class="pi-badge"><b>RETIRADO</b><span>${p.retEm ? new Date(Number(p.retEm)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</span></div></div><div class="pi-act"><button class="secondary" data-volta="${esc(p.id)}">${ico("voltar")}Voltar para a loja</button></div></article>`;
    const pr = prioDe(p), g = pr || "ok", lim = limit(cat || CATSET); let hd = "";
    if (cat && !q && !tierF && !nvF && g !== lastG) { lastG = g; const GN = { v: ico("s-v") + "Vencidos", h: ico("s-h") + "Vence hoje", a: ico("s-a") + "1 a " + visCfg().red + " dia" + (visCfg().red > 1 ? "s" : "") + " · agir já", y: ico("s-y") + "De " + (visCfg().red + 1) + " a " + lim + " dias", ok: ico("s-ok") + "Dentro do prazo" }; hd = `<div class="pgh g${g}${recOn && gRec.has(g) ? " rec" : ""}" data-g="${g}" role="button" tabindex="0" aria-expanded="${!(recOn && gRec.has(g))}"><span>${GN[g]}</span><i>${gcnt[g]}</i><em class="pgc" aria-hidden="true"></em>${prevHtml(g)}</div>`; }
    const big = dl === null ? "—" : dl < 0 ? "VENCIDO" : dl === 0 ? "HOJE" : dl === 1 ? "AMANHÃ" : String(dl), small = dl === null ? "sem validade" : dl < 0 ? "há " + (-dl) + (dl < -1 ? " dias" : " dia") : dl <= 1 ? "" : "dias";
    const tl = lancMs(p), novo = tl > 0 && Date.now() - tl < NOVO_MS;   // lançado há menos de 30 min
    return hd + `<article class="pitem${pr ? " pr" + pr : " prok"}${novo ? " pnovo" : ""}${openId === p.id ? " open" : ""}" data-id="${esc(p.id)}" data-lt="${tl}">${notaDe(p.id) ? `<div class="pi-bubble" role="note" title="Nota"><b>${esc(notaDe(p.id).t)}</b></div>` : ""}<div class="pi-main">${leadNota(p)}<div class="pi-txt"><b class="pi-nome">${esc(nomeBonito(p.name))}${novo ? '<i class="pi-novo">NOVO</i>' : ""}</b><small class="pi-sub"><b>Qtd ${esc(p.quantity)}</b> · vence ${fmtCurto(p.expiry)}</small><small class="pi-sub2">${lo ? `<span class="pi-lotes" aria-label="Lote ${lo.i} de ${lo.n}"><b>${lo.i}/${lo.n}</b><span class="plb">${Array.from({ length: lo.n }, (_, j) => j < lo.i ? '<i class="on"></i>' : "<i></i>").join("")}</span></span>` : ""}${nvF && tl ? `<span class="pi-lt" data-lt="${tl}">${haQuanto(tl)}</span>` : ""}${semAdmin(p.por) ? `<span class="pi-op" title="Lançado por ${esc(semAdmin(p.por))}">${porHtml(p.por)}</span>` : ""}</small></div><div class="pi-badge"><b>${big}</b>${small ? `<span>${small}</span>` : ""}</div></div><div class="pi-act"><div class="pi-foto" data-id="${esc(p.id)}"></div><input type="file" accept="image/*" capture="environment" hidden data-fin="${esc(p.id)}"><input type="file" accept="image/*" hidden data-fin="${esc(p.id)}"><label class="pi-nota"><span>${ico("nota", "ic ti only")}</span><input type="text" maxlength="60" data-nota="${esc(p.id)}" value="${esc((notaDe(p.id) || {}).t || "")}" placeholder="Nota (ex.: gôndola 3, já na promoção)" autocomplete="off" enterkeyhint="done">${notaDe(p.id) ? `<button type="button" class="nt-rem" data-ntx="${esc(p.id)}" aria-label="Remover a nota e o balão">${ico("lixo", "ic")}<b>Remover</b></button>` : ""}</label><div class="nt-fav" aria-label="Notas mais usadas">${notasTop().map(t => `<span class="nt-chip${norm(t) === norm((notaDe(p.id) || {}).t || "") ? " on" : ""}"><button type="button" class="nt-use" data-ntf="${esc(t)}">${esc(t)}</button>${ntEdit ? `<button type="button" class="nt-del" data-ntd="${esc(t)}" aria-label="Tirar «${esc(t)}» dos atalhos">${ico("fechar", "ic")}</button>` : ""}</span>`).join("")}<span class="nt-ctl">${ntEdit && ntOcultas().length ? `<button type="button" class="nt-rest" data-ntr="1">Restaurar atalhos</button>` : ""}<button type="button" class="nt-rest" data-nte="1">${ntEdit ? "Concluir" : "Editar atalhos"}</button></span></div><small class="pi-cod">Cód.: ${esc(p.barcode || (p.codigo_balanca ? "PLU " + p.codigo_balanca : "—"))} · ${esc(p.category)}</small><div class="actions"><button class="secondary" data-edit="${esc(p.id)}">Editar</button><button class="primary" data-ret="${esc(p.id)}">Retirar</button></div></div></article>`;
  }).join("") : (carregando && !products.length ? SKEL : cat === "FLV" && !q && !st ? EMPTY_FLV : '<p class="muted">Nenhum produto encontrado. Use "Bipar código" ou "Cadastro manual".</p>');
  $("list").dataset.visao = visaoDe();
  $("list").dataset.rec = recOn ? [...gRec].join(" ") : "";   // com busca/filtro ligado não há títulos de grupo: nada fica escondido
  $("acaoBar").classList.toggle("hidden", !acaoF);
  { const nb = $("novoBar"), bt = $("novoBtn"); if (nb) nb.classList.toggle("hidden", !nvF);   // botão «🆕 Últimos lançados» (com quantos entraram nos últimos 30 min) · faixa quando o filtro está ligado
    if (bt) { const n30 = base.filter(p => { const t = lancMs(p); return t > 0 && Date.now() - t < NOVO_MS; }).length; bt.classList.toggle("hidden", nvF || retView); bt.innerHTML = ico("his") + "Últimos lançados" + (n30 ? ` <i>${n30}</i>` : ""); } }
  { const urg = base.filter(p => { const k = prioDe(p); return k === "v" || k === "h" || k === "a"; }).length; try { if (base.some(p => prioDe(p) === "v") && fxOn() && !window.__sirV) { window.__sirV = 1;   // o Chrome só deixa vibrar depois do primeiro toque na tela: espera esse toque
      document.addEventListener("pointerdown", () => { try { if (fxOn() && navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 450]); } catch (e) {} }, { once: true, passive: true }); } } catch (e) {} try { if (navigator.setAppBadge) { if (urg > 0) navigator.setAppBadge(urg).catch(() => {}); else navigator.clearAppBadge && navigator.clearAppBadge().catch(() => {}); } } catch (e) {} }   // número no ícone do app = itens em vermelho
  { const n = rows.length, lt = $("listTotal"); lt.classList.toggle("hidden", !n); lt.textContent = retView ? `${n} ${n === 1 ? "item retirado" : "itens retirados"}` : `${n} ${n === 1 ? "item" : "itens"} na lista`; }
  if (typeof renderPesaveis === "function") renderPesaveis();
  if (openId) fotoCarrega(openId);
  fotosTodas();
  novoEfeito();
  entradaLista(rows.length ? SETOR + "|" + (retView ? "r" : "v") + "|" + (typeof cat !== "undefined" ? cat : "") : "");
}
// os cartões sobem um a um — só quando a lista aparece pela 1ª vez ou o setor/visão muda (não a cada atualização da nuvem)
let entradaChave = "", entradaT = 0;
function entradaLista(chave) {
  if (!chave || chave === entradaChave) return; if (entradaChave === "" && !document.querySelector("#list .pitem")) return;
  const sp = document.getElementById("splash"); if (sp && sp.isConnected && getComputedStyle(sp).display !== "none" && Number(getComputedStyle(sp).opacity) > 0.05) { clearTimeout(entradaT); entradaT = setTimeout(() => entradaLista(chave), 150); return; }   // espera a tela de abertura sumir
  entradaChave = chave;
  const cs = document.querySelectorAll("#list .pitem"); const n = Math.min(cs.length, 14);
  for (let i = 0; i < n; i++) { cs[i].style.setProperty("--i", i); cs[i].classList.add("ent"); }
  setTimeout(() => cs.forEach(c => { c.classList.remove("ent"); c.style.removeProperty("--i"); }), 900);
}

// ---------- código de barras EAN-13 (SVG) ----------
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
// foto no cadastro de produto novo (Perecíveis): escolhida aqui, gravada junto com o produto (pelo nome)
let fnFile = null, fnUrl = "";
function fnPaint() {
  const box = $("fnBox"); if (!box) return; if (fnUrl) { try { URL.revokeObjectURL(fnUrl); } catch (e) {} fnUrl = ""; }
  if (fnFile) { fnUrl = URL.createObjectURL(fnFile); box.innerHTML = `<img class="pf-img" src="${fnUrl}" alt="Foto escolhida"><button type="button" class="secondary pf-btn" data-fnc="1">${ico("cam")}Trocar</button><button type="button" class="secondary pf-btn" data-fng="1">${ico("img")}Outra imagem</button><button type="button" class="secondary pf-btn" data-fnx="1">✕ Tirar</button>`; }
  else box.innerHTML = `<button type="button" class="secondary pf-btn" data-fnc="1">${ico("cam")}Tirar foto</button><button type="button" class="secondary pf-btn" data-fng="1">${ico("img")}Escolher imagem</button>`;
}
function fnVis() {   // só para produto novo que ainda não tem foto cadastrada com esse nome
  const el = $("fotoNovo"); if (!el) return; const nome = $("name").value.trim(), ja = nome && fotoCache[fotoK(nome)];
  el.classList.toggle("hidden", !(!$("docId").value && !ja)); }
function fnLimpa() { fnFile = null; fnPaint(); fnVis(); }
function resetForm() { formBip = false; { const fe = $("fotoEd"); if (fe) fe.classList.add("hidden"); } fnFile = null; fnPaint();
  $("productForm").reset(); $("docId").value = ""; $("quantity").value = 1;
  $("category").value = CATSET; $("saveNext").classList.remove("hidden"); toggleCodes();
  $("productForm").classList.remove("lote"); $("loteInfo").classList.add("hidden"); $("loteEdit").classList.add("hidden");
}
function toggleCodes() {
  fnVis();
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
function achaEan(code) { return products.find(p => p.barcode === code) || rawAllAtivos().find(p => p.barcode === code && setSet(p) === (SETOR === PER ? PER : "FLV")); }   // inclui os itens escondidos nesta visão (ex.: KÓRIN x FLV)
function fillKnown(code) {
  const k = code && achaEan(code);
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
  { const fe = $("fotoEd"), per = true; fe.classList.toggle("hidden", !per); $("fotoEdBox").dataset.id = per ? id : ""; $("fotoEdBox").innerHTML = ""; $("fotoEdCam").dataset.fin = id; $("fotoEdGal").dataset.fin = id; if (per) fotoCarrega(id); }
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
  const tem = a => a.some(x => (x.lots || []).some(l => !l.ret)), prox = a => a.flatMap(x => (x.lots || []).filter(l => !l.ret).map(l => String(l.e))).sort()[0] || "";
  return [...g.values()].filter(a => a.length > 1).sort((A, B) => (tem(B) - tem(A)) || (tem(A) ? prox(A).localeCompare(prox(B)) : String(A[0].nome).localeCompare(String(B[0].nome), "pt")));   // com validade na loja primeiro (o que vence antes no topo)
}
const dupTem = a => a.some(x => (x.lots || []).some(l => !l.ret));
function dupInfo(x) {   // EAN, códigos e o que há na loja (lotes com quantidade e validade), para decidir qual nome é o certo
  const cods = [x.ean && x.ean.size ? "EAN " + [...x.ean].join(" / ") : "sem EAN", x.plu && x.plu.size ? "PLU " + [...x.plu].join(" / ") : "", x.doa && x.doa.size ? "Cód. " + [...x.doa].join(" / ") : ""].filter(Boolean).join(" · ");
  const ls = (x.lots || []).filter(l => !l.ret).sort((a, b) => String(a.e).localeCompare(String(b.e))), ret = (x.lots || []).length - ls.length;
  const loja = ls.length ? "Na loja: " + ls.slice(0, 4).map(l => `${esc(l.q)} un · vence ${fmt(l.e)}`).join(" | ") + (ls.length > 4 ? ` | +${ls.length - 4}` : "") : "Na loja: nenhum lote com validade";
  return `<small class="dupi">${esc(cods)}</small><small class="dupi">${loja}${ret ? ` · ${ret} retirado(s)` : ""}</small>`;
}
async function dupUnir(gi, ni, paint) { const g = dupGroups()[gi]; if (!g || !g[ni]) return; return dupUnirCore(g, g[ni], paint); }
async function dupUnirCore(g, alvo, paint, setor) {   // une o grupo num só cadastro: nome do escolhido + EAN/PLU/código completos (os que faltam vêm dos outros)
  const pega = k => { const own = [...alvo[k]]; if (own.length) return own[0]; for (const o of g) if (o[k].size) return [...o[k]][0]; return ""; };
  const ean = pega("ean"), plu = pega("plu"), doa = pega("doa"), set = new Set(g.map(x => norm(x.nome))), pool = setor || (SETOR === PER ? PER : "FLV");   // setor: quando a chamada vem de outro setor (Saúde do app)
  const ok = await askConfirm({ icon: "🔗", title: "Unir cadastros?", text: "«" + alvo.nome + "»", sub: `Este nome fica e o outro some: todos passam a ser «${alvo.nome}» com ${ean ? "EAN " + ean : "sem EAN"}${plu ? " · PLU " + plu : ""}${doa ? " · Cód. " + doa : ""}. As validades e quantidades que estão na loja (dos dois) continuam, agora neste nome.`, ok: "Unir", cancel: "Cancelar" });
  if (!ok) return; let n = 0;
  rawAllAtivos().forEach(p => { if (!set.has(norm(p.name || "")) || setSet(p) !== pool) return; const d = { name: alvo.nome }; if (ean) d.barcode = ean; if (plu) d.codigo_balanca = plu; if (doa) d.codigo_doacao = doa;
    if (Object.keys(d).every(k => (p[k] || "") === d[k])) return; n++;
    if (db) V.updateDoc(V.doc(db, "products", p.id), { ...d, updatedAt: V.serverTimestamp() }).catch(err => console.error(err)); else Object.assign(p, d); });
  persist(); if (!db) render(); toast(`${n} cadastro(s) unidos em «${alvo.nome}».`); if (paint) paint();
}
function dupReview() {
  const bg = document.createElement("div"); bg.className = "askbg";
  let q = "";
  const aplica = () => { const nq = norm(q); let v = 0; const tot = bg.querySelectorAll(".dupg").length;
    bg.querySelectorAll(".dupg").forEach(g => { const ok = !nq || g.dataset.s.includes(nq); g.hidden = !ok; if (ok) v++; });
    bg.querySelectorAll(".duph").forEach(h => { let n = h.nextElementSibling, alg = false; while (n && !n.classList.contains("duph") && !n.classList.contains("arow")) { if (n.classList.contains("dupg") && !n.hidden) alg = true; n = n.nextElementSibling; } h.hidden = !alg; });
    const c = bg.querySelector("#dupCount"); if (c) c.textContent = nq ? `${v} de ${tot} grupos` : `${tot} ${tot === 1 ? "grupo" : "grupos"}`;
    const e = bg.querySelector("#dupVazio"); if (e) e.hidden = !(nq && !v); };
  const paint = () => { const gs = dupGroups(); bg.dataset.g = JSON.stringify(gs.map(a => a.map(x => x.nome)));
    const nTem = gs.filter(dupTem).length; let h1 = false, h2 = false;
    const grp = (a, gi) => { const ini = !dupTem(a) ? (h2 ? "" : (h2 = true, `<div class="duph">Sem lote na loja (${gs.length - nTem})</div>`)) : (h1 ? "" : (h1 = true, `<div class="duph">${ico("caixa")}Com validade na loja (${nTem})</div>`));
      const sk = norm(a.map(x => x.nome + " " + [...x.ean, ...x.plu, ...x.doa].join(" ")).join(" "));
      return ini + `<div class="dupg" data-s="${esc(sk)}">${a.map((x, ni) => `<div class="dupr"><span><b>${esc(x.nome)}</b> <small>${x.n} cadastro(s)</small>${dupInfo(x)}</span><span style="display:flex;flex-direction:column;gap:6px"><button type="button" data-g="${gi}" data-n="${ni}">Usar este</button><button type="button" class="secondary" data-u="1" data-g="${gi}" data-n="${ni}">Unir neste</button></span></div>`).join("")}</div>`; };
    bg.innerHTML = `<div class="ask" style="max-height:86dvh;overflow:auto;text-align:left"><div class="dupbar"><div style="display:flex;align-items:center;gap:10px;justify-content:space-between"><h3 style="margin:0">${ico("bus")}Cadastros parecidos</h3><b id="dupCount" class="dupc"></b></div>` +
      (gs.length ? `<input type="search" id="dupQ" placeholder="Buscar nome ou código…" autocomplete="off" value="${esc(q)}"><p class="note" style="margin:6px 0 0">Escolha o nome certo de cada grupo. Os outros serão renomeados.</p>` : "") + `</div>` +
      (gs.length ? gs.map(grp).join("") + `<p id="dupVazio" class="note" style="text-align:center" hidden>Nenhum grupo com esse nome ou código.</p>`
        : `<p style="text-align:center"><b>Nenhum nome parecido encontrado ✓</b></p>`) +
      `<div class="arow"><button type="button" class="ok" data-x="1">Fechar</button></div></div>`; aplica(); };
  bg.oninput = e => { if (e.target.id === "dupQ") { q = e.target.value; aplica(); } };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) return bg.remove();
    const b = e.target.closest("[data-g]"); if (!b) return;
    if (b.dataset.u) return dupUnir(+b.dataset.g, +b.dataset.n, paint);
    const gs = JSON.parse(bg.dataset.g), alvo = gs[b.dataset.g][b.dataset.n], set = new Set(gs[b.dataset.g].map(norm)); let n = 0;
    products.forEach(p => { if (set.has(norm(p.name || "")) && (p.name || "").trim() !== alvo) { n++;
      if (db) V.updateDoc(V.doc(db, "products", p.id), { name: alvo, updatedAt: V.serverTimestamp() }).catch(err => console.error(err)); else p.name = alvo; } });
    persist(); if (!db) render(); toast(`${n} cadastro(s) renomeado(s) para «${alvo}».`); paint(); };
  paint(); document.body.appendChild(bg);
}
window.dupReview = dupReview;
// ---------- histórico de atividade (Admin vê quem entrou e o que fez; gravado na coleção "acessos", que as regras já aceitam) ----------
const ATK = "validamais-atv";
const ACS_NOMES = { Loja: "Validades (Loja)", Doacao: "Doação", Pesaveis: "Pesáveis", Etiquetas: "Etiquetas", Inventario: "Inventário", Cadastros: "Cadastros" };
function logAcesso(nome) {   // «acessou X»: no máximo 1× a cada 5 min por tela neste aparelho (para não encher o histórico)
  try { const m = store.get("validamais-acs", {}) || {}, agora = Date.now(); if (agora - (m[nome] || 0) < 5 * 60 * 1000) return; m[nome] = agora; store.set("validamais-acs", m); logAtv("acessou", nome); } catch (e) { /* sem registro */ } }
function logAtv(a, txt, extra) {
  try { const rec = { tipo: "atv", t: Date.now(), quem: myName().slice(0, 40), perfil: PERFIL || "", setor: SETOR || "", dev: myId, a, txt: String(txt || "").slice(0, 140), ...(extra || {}) };
    if (db) V.addDoc(V.collection(db, "acessos"), rec).catch(e => console.warn("atividade:", e && (e.code || e.message)));
    else { const l = store.get(ATK, []); l.unshift(rec); store.set(ATK, l.slice(0, 300)); } } catch (e) { console.warn(e); }
}
// quem lançou: «Ronaldo»; quando outra pessoa só altera o lote, vira «Ronaldo (Renato ajustou)». O sufixo «(Admin)» do nome não aparece.
const semAdmin = n => String(n || "").replace(/\s*\(\s*admin\s*\)\s*/gi, " ").replace(/\s+/g, " ").trim();
const porBase = por => semAdmin(String(por || "").replace(/\s*\([^()]*\sajustou\)\s*$/i, ""));   // só quem lançou
function porAjustado(antigo) {
  const orig = porBase(antigo), eu = semAdmin(myName()); if (!orig) return eu.slice(0, 40); if (norm(orig) === norm(eu)) return orig.slice(0, 40);
  return `${orig.slice(0, 16)} (${eu.slice(0, 12)} ajustou)`;
}
function porHtml(por) {   // «Ronaldo <i>(Renato ajustou)</i>»
  const t = semAdmin(por), m = /^(.*?)\s*\(([^()]*\sajustou)\)$/i.exec(t); if (!t) return "—";
  return m ? `${esc(m[1])} <i>(${esc(m[2])})</i>` : esc(t);
}
// v505: nome sem gramagem/peso (ex.: «Danone grego light») — confunde versões do mesmo produto
const GRAM_RE = /\d+(?:[.,]\d+)?\s*(?:g|gr|grs|kg|mg|ml|l|lt|litros?|un|und|unid|unids|unidades?|fatias?|pcs?|p[cç]s?|sach[eê]s?)(?![a-zà-ú])|\b\d+\s*x\s*\d+/i;
const nomeSemGramagem = n => !GRAM_RE.test(String(n || ""));
async function save(next) {
  const id = $("docId").value, q = Number(String($("quantity").value).replace(",", "."));
  const data = { barcode: $("barcode").value.trim().slice(0, 32), name: $("name").value.trim().slice(0, 120),
    category: $("category").value, expiry: $("expiry").value, quantity: q, por: id ? porAjustado(((products.find(x => x.id === id) || {}).por)) : semAdmin(myName()).slice(0, 40), codigo_balanca: $("cBalanca").value.trim().slice(0, 12), codigo_doacao: $("cDoacao").value.trim().slice(0, 12) };
  if (!data.name || !CATS.includes(data.category) || (!data.expiry && data.category !== "FLV") || !(q > 0)) { toast(data.category === "FLV" ? "Preencha nome e categoria." : "Preencha nome, categoria, validade e quantidade."); return; }
  // v488: aviso quando a validade está muito longe (provável erro de digitação no ano ou no mês); só se a data foi mexida
  if (data.expiry) { const antes = id ? ((products.find(x => x.id === id) || {}).expiry || "") : "", hj0 = new Date(); hj0.setHours(0, 0, 0, 0); const alvo0 = new Date(data.expiry + "T00:00:00"), dias0 = Math.round((alvo0 - hj0) / 86400000), lim0 = data.category === "FLV" ? 60 : 180;
    if (data.expiry !== antes && dias0 > lim0) { const meses0 = Math.round(dias0 / 30), ok0 = await askConfirm({ icon: "📅", title: "Validade muito longe", text: `A data ${alvo0.toLocaleDateString("pt-BR")} fica a ${meses0 >= 2 ? meses0 + " meses" : dias0 + " dias"} daqui. Está certa?`, sub: "Confira o dia, o mês e o ano antes de salvar.", ok: "Está certa, salvar", cancel: "Corrigir a data" }); if (!ok0) { try { $("expiry").focus(); } catch (e) {} return; } } }
  // v505: Perecíveis — nome novo ou alterado sem gramagem: pergunta se quer detalhar (não bloqueia)
  if (data.category === PER && nomeSemGramagem(data.name) && !$("productForm").classList.contains("lote")) { const nomeAntes = id ? ((products.find(x => x.id === id) || {}).name || "") : "";
    if (norm(nomeAntes) !== norm(data.name)) { const ok1 = await askConfirm({ icon: "✏️", title: "Falta detalhar o produto", text: `«${data.name}» está sem a gramagem.`, sub: "Coloque o peso e o tipo para não misturar versões. Ex.: Danone grego light 400g · Queijo prato 150g · Yorgus BDJ 500g.", ok: "Salvar assim mesmo", cancel: "Detalhar o nome" }); if (!ok1) { try { $("name").focus(); } catch (e) {} return; } } }
  if (!id) {   // produto novo: bipar primeiro; digitar só quando não há código
    const conhecido = (data.barcode && products.some(x => x.barcode === data.barcode)) || products.some(x => norm(x.name || "") === norm(data.name));
    if (data.barcode.length === 13 && !isScale(data.barcode) && !eanOk(data.barcode) && !formBip) { if (!(await askConfirm({ icon: "⚠️", title: "Código de barras inválido", text: data.barcode, sub: "Algum número está errado (erro de digitação). Bipe o produto ou corrija.", ok: "Salvar mesmo assim", cancel: "Corrigir" }))) return $("barcode").focus(); }
    else if (!conhecido && !formBip) {
      const r = await askConfirm({ icon: "📷", title: "Bipe o produto primeiro", text: `«${data.name}»`, sub: data.barcode ? "Você digitou o código. Bipar evita erro de digitação e cadastro repetido." : "Bipar evita erro de digitação e cadastro repetido. Se o produto não tem código de barras, siga como manual.", ok: "Bipar agora", alt: "Cadastrar manual", cancel: "Voltar" });
      if (r === true) return openScan("form");
      if (r !== "alt") return;
    }
  }
  const antes = id ? ((products.find(x => x.id === id) || {}).name || "") : "";
  if (!id || norm(antes) !== norm(data.name)) {
    const sim = similarNames(data.name, antes);
    if (sim.length) {
      const r = await askConfirm({ icon: "🔍", title: "Já existe um nome parecido", text: `«${data.name}»`, sub: `Já cadastrado: ${sim.slice(0, 3).map(s => "«" + s + "»").join(" · ")}`, ok: "Manter o meu", cancel: "Usar o existente" });
      if (r === null) return;
      if (r === false) { data.name = sim[0].slice(0, 120); $("name").value = data.name; }
    }
  }
  if (!id) meuNovo = Date.now();   // lote novo lançado aqui: o efeito leva o item até a tela
  store.set(LC, data.category); logAtv(id ? "editou" : "cadastrou", `${data.name} · vence ${fmt(data.expiry)} · qtd ${data.quantity}`);
  if (db) {
    const ts = V.serverTimestamp();
    const p = id ? V.updateDoc(V.doc(db, "products", id), { ...data, updatedAt: ts })
                 : V.addDoc(V.collection(db, "products"), { ...data, createdAt: ts, updatedAt: ts });
    p.catch(e => { console.error(e); toast(data.category === PER ? "Erro ao salvar. O Firebase precisa aceitar a categoria «Perecíveis» nas regras." : "Erro ao salvar na nuvem. Confira as regras do Firestore."); });
  } else {
    if (id) products = products.map(x => x.id === id ? { ...x, ...data, updatedAt: Date.now() } : x); else products.push({ ...data, id: uid(), createdAt: Date.now(), updatedAt: Date.now() });
    persist(); render();
  }
  const ffoto = !id ? fnFile : null; fnFile = null;
  if (ffoto) fotoGravaNome(data.name, ffoto).then(ok => { if (ok) { fotoIcones(); toast("Produto e foto salvos."); } else toast("Produto salvo, mas a foto não foi salva."); });
  closeModal(); toast("Produto salvo."); if (id) { const nm = norm(data.name || ""); vmOk(() => [...document.querySelectorAll("#list article.product, #list article.pitem")].find(a => norm((a.querySelector("h3, .pi-nome") || {}).textContent || "") === nm)); } if (next) openScan();
}
let retView = false;
const RLK = "validamais-retlocal"; let retLoc = store.get(RLK, {});
// dados que a nuvem recusou ficam marcados só neste aparelho
function retOverlay() { products.forEach(p => { if (p.retirado == null && retLoc[p.id]) { p.retirado = true; p.retEm = retLoc[p.id].em; p.retPor = retLoc[p.id].por; } }); }
// efeito ao retirar: o cartão desliza para fora e a lista fecha o espaço (some em ~0,4 s)
function efeitoSai(id) {
  const el = [...document.querySelectorAll("#list .pitem")].find(x => x.dataset.id === id);
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  try {   // v502: a foto se solta do card, gira e voa para fora da tela
    const im = el.querySelector(".ico-lado .ico-img, .pi-lead .ico-img"), r = im && im.getBoundingClientRect();
    if (im && r.width && el.animate) {
      const fl = im.cloneNode(true); fl.className = "foto-voa"; fl.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      document.body.appendChild(fl); im.style.visibility = "hidden";
      const dx = window.innerWidth - r.left + 40, dy = -Math.min(r.top, 220) - 40;
      fl.animate([{ transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 }, { transform: "translate(" + dx * .35 + "px," + (dy * .15 - 14) + "px) scale(1.15) rotate(8deg)", opacity: 1, offset: .3 }, { transform: "translate(" + dx + "px," + dy + "px) scale(.35) rotate(40deg)", opacity: 0 }], { duration: 620, easing: "cubic-bezier(.3,.1,.4,1)", fill: "forwards" }).onfinish = () => fl.remove();
      setTimeout(() => fl.remove(), 900);
    } } catch (e) {}
  el.style.maxHeight = el.offsetHeight + "px"; void el.offsetHeight; el.classList.add("saindo");
  try { if (fxOn() && navigator.vibrate) navigator.vibrate([14, 30, 14]); } catch (e) {}   // toque curto: «saiu»
  return new Promise(r => setTimeout(r, 560));
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
function loteLista(id) {   // toque no selo "1/3": lista todos os lotes deste produto
  const p0 = products.find(x => String(x.id) === String(id)); if (!p0) return;
  const ls = lotesDe(p0), bg = document.createElement("div"); bg.className = "askbg";
  const linha = (p, i) => { const d = daysLeft(p.expiry), cor = d === null ? "ok" : d < 0 ? "v" : d <= 3 ? "a" : d <= 7 ? "y" : "ok";
    return `<div class="lt ${cor}${p.id === p0.id ? " me" : ""}"><b>Lote ${i + 1}/${ls.length}</b><span>${p.expiry ? "vence " + fmtCurto(p.expiry) : "sem validade"}${d === null ? "" : d < 0 ? " · vencido" : d === 0 ? " · hoje" : " · " + d + (d === 1 ? " dia" : " dias")}</span><em>${esc(p.quantity)} un.</em></div>`; };
  bg.innerHTML = `<div class="ask lotesbox" role="dialog" aria-modal="true"><h3>${esc(p0.name)}</h3><p class="asub">${ls.length} ${ls.length === 1 ? "lote" : "lotes"} na loja</p><div class="ltl">${ls.map(linha).join("")}</div><div class="arow"><button type="button" class="ok" data-a="1">Fechar</button></div></div>`;
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-a]")) bg.remove(); };
  document.body.appendChild(bg);
}
function lotesDe(k) {   // validades que já estão na loja deste produto (o que vence primeiro é o Lote 1)
  if (!k) return [];
  const mesmo = p => k.barcode ? p.barcode === k.barcode : norm(p.name || "") === norm(k.name || "");
  return products.filter(p => !p.retirado && mesmo(p)).sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
}
// v503: foto do produto na caixa de lote (Perecíveis); se ainda não chegou da nuvem, pinta quando chegar
const loteFoto = k => { if (!iconesOn() || !k || !k.name || (k.category && k.category !== PER && SETOR === PER)) return ""; const d = fotoDe(k); return `<span class="lfoto" data-n="${esc(k.name)}">${d ? `<img src="${d}" alt="" decoding="async">` : ""}</span>`; };
function lotePinta(k, n = 0) {
  const el = document.querySelector("#loteInfo .lfoto"); if (!el || !k) return; const d = fotoDe(k);
  if (d) { el.innerHTML = `<img src="${d}" alt="" decoding="async">`; return; }
  if (n === 0) { const ref = products.find(x => x.id && norm(x.name || "") === norm(k.name || "")); if (ref) fotoCarrega(ref.id); }
  if (n < 6) setTimeout(() => lotePinta(k, n + 1), 600);
}
function loteMode(k) {          // produto já cadastrado: só pede validade e quantidade deste lote
  if (!k || !k.name) return;
  $("productForm").classList.add("lote");
  const ls = lotesDe(k), cod = k.barcode ? " · cód. " + k.barcode : "";
  if (ls.length) {   // avisa na hora: já existe validade deste produto na loja
    const linha = (p, i) => { const d = daysLeft(p.expiry), cor = d === null ? "ok" : d < 0 ? "v" : d <= 3 ? "a" : d <= 7 ? "y" : "ok";
      return `<div class="lt ${cor}"><b>Lote ${i + 1}/${ls.length}</b><span>${p.expiry ? "vence " + fmtCurto(p.expiry) : "sem validade"}${d === null ? "" : d < 0 ? " · vencido" : d === 0 ? " · hoje" : " · " + d + (d === 1 ? " dia" : " dias")}</span><em>${esc(p.quantity)} un.</em></div>`; };
    $("loteInfo").innerHTML = `<div class="lhead">${loteFoto(k)}<div class="lhtx"><span class="ltt">⚠️ Já tem validade deste produto na loja (${ls.length} ${ls.length === 1 ? "lote" : "lotes"})</span><span class="ltn">${esc(k.name)}${esc(cod)}</span></div></div><div class="ltl">${ls.map(linha).join("")}<div class="lt novo"><b>Lote ${ls.length + 1}/${ls.length + 1}</b><span>este que você vai lançar agora</span></div></div>`;
    $("loteInfo").classList.add("lotebox");
    try { sinal("ok"); } catch (e) {} try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
    toast(`⚠️ Já há ${ls.length} ${ls.length === 1 ? "lote" : "lotes"} deste produto na loja. Este será o Lote ${ls.length + 1}.`);
  } else { $("loteInfo").classList.remove("lotebox"); $("loteInfo").innerHTML = `<div class="lhead">${loteFoto(k)}<div class="lhtx">Produto já cadastrado: ${esc(k.name)}${esc(cod)}. Informe só a validade e a quantidade deste lote.</div></div>`; }
  lotePinta(k);
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
  sinal((isScale(code) ? products.some(p => p.codigo_balanca && Number(p.codigo_balanca) === Number(String(Number(parseScale(code).item)))) : products.some(p => p.barcode === code)) ? "ok" : "novo");
  if (scanMode === "form") return formCode(code);
  stopScanner(); resetForm(); formBip = true;
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
function formCode(code) {   // «Bipar agora» dentro do formulário: o código lido entra no formulário que já estava aberto
  if (isScale(code) || products.some(p => p.barcode === code)) { scanMode = "loja"; return onCode(code); }   // já cadastrado: segue o caminho normal (novo lote)
  stopScanner(); show("Produto novo: cadastre agora"); formBip = true; $("barcode").value = code; fillKnown(code); ($("name").value ? $("expiry") : $("name")).focus();
}
function manualCodeGo() {            // código digitado: segue o mesmo caminho da leitura pela câmera
  const v = $("manualCode").value.replace(/\D/g, "");
  if (!/^\d{6,14}$/.test(v)) { toast("Digite o código de barras só com números (6 a 14 dígitos)."); return $("manualCode").focus(); }
  if (v.length === 13 && !isScale(v) && !eanOk(v)) { sinal("erro"); toast("Código inválido: algum número está errado. Confira e digite de novo, ou bipe com a câmera."); return $("manualCode").focus(); }
  $("manualCode").value = ""; $("manualCode").blur(); onCode(v);
}
$("manualGo").onclick = manualCodeGo;
// achar pelo nome (discreto, abaixo do código): TODOS os cadastros do setor (com ou sem EAN, mesmo os retirados); toca e segue como se tivesse bipado
let nmLista = [];
function nmBusca() {
  const q = norm($("nmBusca").value.trim()), box = $("nmRes"); if (q.length < 2) { box.classList.add("hidden"); box.innerHTML = ""; nmLista = []; return; }
  const tk = q.split(/\s+/);
  nmLista = cadGroups().filter(g => { const n = norm(g.name || ""); return tk.every(x => n.includes(x)); })
    .sort((a, b) => norm(a.name).indexOf(tk[0]) - norm(b.name).indexOf(tk[0]) || String(a.name).length - String(b.name).length);
  box.innerHTML = nmLista.length ? `<em class="nmn">${nmLista.length} ${nmLista.length === 1 ? "cadastro" : "cadastros"}</em>` + nmLista.map((g, i) => { const ret = g.l.every(x => x.retirado), cod = g.barcode ? "…" + String(g.barcode).slice(-4) : (g.plu ? "PLU " + g.plu : "sem código");
    return `<button type="button" data-i="${i}"><span>${esc(nomeBonito(g.name))}</span><small>${ret ? "retirado · " : ""}${esc(cod)}</small></button>`; }).join("") : "<em>Nenhum cadastro com esse nome.</em>";
  box.classList.remove("hidden");
}
function nmEscolhe(g) {
  const k = g.l.find(x => !x.retirado) || g.l[0];
  if (scanMode === "loja") {   // abre o lote deste cadastro exato (vale também para os sem EAN e para EAN repetido com nomes diferentes)
    sinal("ok"); stopScanner(); resetForm(); formBip = true; logScan(k.barcode || "", k); show(`Novo lote de «${k.name}»`);
    $("barcode").value = k.barcode || ""; $("name").value = k.name || ""; $("category").value = k.category || CATSET;
    $("cBalanca").value = k.codigo_balanca || ""; $("cDoacao").value = k.codigo_doacao || ""; toggleCodes(); loteMode(k); $("expiry").focus(); return;
  }
  if (k.barcode) return onCode(k.barcode);
  toast("Este cadastro não tem código de barras. Abra-o pelo cadastro ou pelo lote.");
}
$("nmBusca").oninput = nmBusca;
$("nmRes").onclick = e => { const b = e.target.closest("button[data-i]"); if (!b) return; const g = nmLista[Number(b.dataset.i)]; if (!g) return; $("nmBusca").value = ""; nmBusca(); $("nmBusca").blur(); nmEscolhe(g); };
$("manualCode").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); manualCodeGo(); } };
async function openScan(mode = "loja") {
  scanMode = ["doacao", "etiqueta", "cadastro", "form"].includes(mode) ? mode : "loja";
  if (scanMode !== "form") resetForm(); show({ doacao: "Bipar itens da doação", etiqueta: "Bipar para etiqueta", cadastro: "Bipar para o cadastro", form: "Bipar o produto" }[scanMode] || "Ler código de barras", true);
  $("scanManual").textContent = scanMode === "loja" ? "Digitar código" : scanMode === "form" ? "Voltar ao formulário" : "Cancelar";
  ["retryScan", "torchBtn"].forEach(i => $(i).classList.add("hidden"));
  $("scanMsg").textContent = "Aponte a câmera traseira para o código de barras. Se não ler, digite o código abaixo."; $("manualCode").value = ""; $("nmBusca").value = ""; nmBusca();
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
function fotoClique(e) { const pf = e.target.closest(".pi-foto"); if (!pf) return false; const id = pf.dataset.id, q = sel => pf.parentElement.querySelector(sel);
  if (e.target.closest("[data-fz]")) fotoZoom(e.target.closest("[data-fz]").src); else if (e.target.closest("[data-fadd]")) { const f = q("[data-fin][capture]"); if (f) f.click(); } else if (e.target.closest("[data-fgal]")) { const f = q("[data-fin]:not([capture])"); if (f) f.click(); } else if (e.target.closest("[data-fdel]")) fotoApaga(id); return true; }
const fotoMuda = e => { const f = e.target.closest && e.target.closest("[data-fin]"); if (f && f.files && f.files[0]) { fotoSalva(f.dataset.fin, f.files[0]); f.value = ""; } };
$("list").addEventListener("change", fotoMuda); $("fotoEd").addEventListener("change", fotoMuda); $("fotoEd").addEventListener("click", fotoClique);
$("list").onclick = e => { const lc = e.target.closest(".pi-lotes"); if (lc) { e.stopPropagation(); const ar = lc.closest(".pitem"); if (ar) loteLista(ar.dataset.id); return; }
  const nx = e.target.closest("[data-ntx]"); if (nx) { notaSalva(nx.dataset.ntx, ""); return; }
  const nd = e.target.closest("[data-ntd]"); if (nd) { const t = nd.dataset.ntd, o = ntOcultas(); if (!o.some(x => norm(x) === norm(t))) o.push(t); store.set(NTH, o); const f = store.get(NTF, {}); Object.keys(f).forEach(k => { if (norm(k) === norm(t)) delete f[k]; }); store.set(NTF, f); render(); return; }
  if (e.target.closest("[data-ntr]")) { store.set(NTH, []); render(); return; }
  if (e.target.closest("[data-nte]")) { ntEdit = !ntEdit; render(); return; } const nf = e.target.closest("[data-ntf]"); if (nf) { const ar = nf.closest(".pitem"); if (ar) { const id = ar.dataset.id, igual = norm((notaDe(id) || {}).t || "") === norm(nf.dataset.ntf); notaSalva(id, igual ? "" : nf.dataset.ntf); } return; } const gh = e.target.closest(".pgh[data-g]"); if (gh) { const g = gh.dataset.g; const abrindo = gRec.has(g), pt = abrindo && e.target.closest(".pgt[data-id]"); abrindo ? gRec.delete(g) : gRec.add(g);
    if (abrindo) ["v", "h", "a", "y", "ok"].forEach(k => { if (k !== g) gRec.add(k); });   // v491: abrir um grupo fecha os outros (um de cada vez)
    $("list").querySelectorAll(".pgh[data-g]").forEach(h => { const f = gRec.has(h.dataset.g); h.classList.toggle("rec", f); h.setAttribute("aria-expanded", !f); });
    $("list").dataset.rec = [...gRec].join(" ");
    if (pt) { openId = pt.dataset.id; render(); requestAnimationFrame(() => { const it = $("list").querySelector('.pitem[data-id="' + CSS.escape(openId) + '"]'); if (it) it.scrollIntoView({ block: "center", behavior: "smooth" }); }); return; }   // v500: toque na foto da prévia abre o grupo já com o card daquele item aberto
    requestAnimationFrame(() => { try { const th = (document.querySelector(".top") || {}).offsetHeight || 0; if (abrindo || gh.getBoundingClientRect().top < th + 4) gh.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (er) {} }); return; } if (e.target.closest(".pi-nota")) return;   // v475: toque na foto = comportamento normal do cartão; ampliar só segurando (ver fotoSegurar)
  if (fotoClique(e)) return; const b = e.target.closest("button"); if (!b) { const it = e.target.closest(".pitem"); if (it) { openId = openId === it.dataset.id ? "" : it.dataset.id; document.querySelectorAll("#list .pitem").forEach(x => x.classList.toggle("open", x.dataset.id === openId)); if (openId) fotoCarrega(openId); } return; } if (b.dataset.edit) edit(b.dataset.edit); if (b.dataset.ret) retirar(b.dataset.ret, true); if (b.dataset.volta) retirar(b.dataset.volta, false); };
$("manualOpen").onclick = () => openForm(); $("fab").onclick = () => openScan(curTab === "Doacao" ? "doacao" : curTab === "Pesaveis" ? "etiqueta" : curTab === "Etiquetas" ? "etiqueta" : curTab === "Cadastros" ? "cadastro" : "loja"); $("retryScan").onclick = () => openScan(scanMode);
$("scanManual").onclick = () => { stopScanner(); if (scanMode === "form") { show("Cadastrar produto"); return; } if (scanMode !== "loja") closeModal(); else openForm(); };
$("closeModal").onclick = closeModal; $("cancelForm").onclick = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal(); });
$("productForm").onsubmit = e => { e.preventDefault(); save(false); };
$("saveNext").onclick = () => { if ($("productForm").reportValidity()) save(true); };
$("fotoNovo").onclick = e => { if (e.target.closest("[data-fnc]")) $("fnCam").click(); else if (e.target.closest("[data-fng]")) $("fnGal").click(); else if (e.target.closest("[data-fnx]")) fnLimpa(); else if (e.target.closest(".pf-img")) fotoZoom(e.target.closest(".pf-img").getAttribute("src")); };
$("fotoNovo").onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; if (!/^image\//.test(f.type)) return toast("Escolha uma imagem."); fnFile = f; fnPaint(); };
$("name").addEventListener("input", fnVis);
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
  if (PERFIL !== "Admin") return toast(($("nOnline").textContent || "–") + " online agora");   // v498: só o Admin vê os nomes de quem está online
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
function pintaSetor() {   // botões do setor (agora dentro do menu ⋮) conforme o setor atual
  const ch = $("setorChip"); if (ch) ch.querySelectorAll("[data-s]").forEach(b => { b.hidden = false; b.classList.toggle("on", b.dataset.s === SETOR); b.setAttribute("aria-pressed", b.dataset.s === SETOR); b.onclick = () => { trocaSetor(b.dataset.s); if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } }; });
  const outros = ["FLV", PER].filter(x => x !== SETOR), nome = x => x;
  [["mnSetor", "mnSetorT", outros[0]], ["mnSetor2", "mnSetor2T", outros[1]]].forEach(([b, t, alvo]) => { if ($(b)) { $(t).textContent = "Ir para " + nome(alvo); $(b).onclick = () => { trocaSetor(alvo); if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } }; } }); }
function hojeTop() {   // data de hoje no topo, simples: «Terça-feira, 10 de novembro»
  const el = $("hojeTop"); if (!el) return; const d = new Date();
  const sem = d.toLocaleDateString("pt-BR", { weekday: "long" }), txt = sem.charAt(0).toUpperCase() + sem.slice(1) + ", " + d.getDate() + " de " + d.toLocaleDateString("pt-BR", { month: "long" });
  if (el.textContent === txt) return; el.className = "hojeTop ht"; el.textContent = txt; el.setAttribute("datetime", d.toISOString().slice(0, 10));
  el.title = txt + " de " + d.getFullYear();
}
hojeTop(); setInterval(hojeTop, 60000);
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
  return achaEan(v);
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
function tamOf(p) { if (SETOR === "FLV") return "P"; return (p && store.get(TK, {})[pkey(p)]) || "M"; }   // FLV: etiqueta nova sempre começa em P (serrilhado), sem lembrar o último tamanho; M e G só segurando o item
function dayOf(p) { const t = p.updatedAt, v = t && t.toMillis ? t.toMillis() : (t ? Number(t) : Date.now()); return new Date(v).toLocaleDateString("pt-BR"); }
const fq = q => (Math.round(q * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sumU = u => don.itens.filter(i => i.unidade === u).reduce((a, i) => a + i.qtd, 0);
const dataBR = d => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
const FERR = ["Etiquetas", "Inventario", "Cadastros"], FK = "validamais-ferr";
function tab(t) {
  if (t !== curTab && ACS_NOMES[t]) logAcesso(ACS_NOMES[t]);
  curTab = t;
  ["Loja", "Doacao", "Pesaveis", "Etiquetas", "Inventario", "Cadastros"].forEach(n => { const p = $("tab" + n); if (p) p.classList.toggle("hidden", n !== t); const nb = $("nav" + n); if (nb) nb.classList.toggle("active", n === t); });
  [["Loja", t === "Loja"], ["Doacao", t === "Doacao"], ["Pesaveis", t === "Pesaveis"], ["Etiquetas", t === "Etiquetas"], ["Cadastros", t === "Cadastros"]].forEach(([n, on]) => { const b = $("tb" + n); if (b) b.classList.toggle("active", on); });
  const tAnt = document.body.dataset.tab; document.body.dataset.tab = t; document.body.dataset.grp = t;
  if (t === "Doacao" && typeof dView === "function") dView("lista");
  if (t === "Pesaveis" && typeof renderPesaveis === "function") renderPesaveis();
  // v487: ao abrir Pesáveis a busca NÃO recebe foco (o teclado só abre quando a pessoa toca na busca)
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
function balIcoTop(w) { if (balFoto(w)) return balIco(w); return norm(String(w || "")) === "tomate" ? `<span class="bi">🍅</span>` : balIco(w); }   // balão Tomate: ícone de tomate
function balIco(w, fb, soft) { const ph = balFoto(w) || (fb ? balFoto(fb) : ""); if (ph) return `<span class="bi bf"><img class="bi-img" src="${ph}" alt="" decoding="async"></span>`;
  const n = norm(String(w || "")); for (const [re, e] of BICO) if (re.test(n)) return `<span class="bi">${e}</span>`;
  if (fb) return balIco(fb);
  if (soft) return "";
  return `<span class="bi bl">${esc((String(w || "?").trim().charAt(0) || "?").toUpperCase())}</span>`; }
// atalhos (balões) da aba de baixo: o que o Admin deixa aqui vale para todos os aparelhos (sh_cfg/atalhos)
function dBalSave(c) { store.set("validamais-dbal", c || null); if (db) V.setDoc(V.doc(db, "sh_cfg", "atalhos"), { l: c || [], em: Date.now() }).catch(e => { console.warn(e); toast("Atalhos salvos só neste aparelho (a nuvem recusou)."); }); }
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
function dbMove(d){ const c=dBalEnsure(), j=dbIdx+d; if(dbIdx<0||j<0||j>=c.length) return; [c[dbIdx],c[j]]=[c[j],c[dbIdx]]; dBalSave(c); dbIdx=j; dbMvUpd(); dTop6Render(); }
$("dbEsq").onclick=()=>dbMove(-1); $("dbDir").onclick=()=>dbMove(1);
function dbClose(){ $("dBalModal").classList.add("hidden"); }
$("dbX").onclick=dbClose;
$("dbSalvar").onclick=()=>{ const w=$("dbNome").value.trim().slice(0,24); if(!w) return toast("Dê um nome ao balão."); if(!dbDraft.v.length) return toast("Adicione pelo menos um tipo."); dbDraft.w=w;
  const c=dBalEnsure(); if(dbIdx>=0) c[dbIdx]=dbDraft; else c.push(dbDraft); dBalSave(c.slice(0,9)); dbClose(); dTop6Render(); };
$("dbExcluir").onclick=()=>{ const c=dBalEnsure(); if(dbIdx<0) return; const rem=c.splice(dbIdx,1)[0]; dBalSave(c.length?c:null); dbClose(); dTop6Render(); toast(`Balão "${rem.w}" excluído.`); };
$("dBalCol").onclick=()=>{ store.set("validamais-dcol",!store.get("validamais-dcol",false)); dTop6Render(); };
$("dT6L").onclick=()=>{ if(window.dEditBal||$("dTop6")._open>=0) return; $("dBalCol").onclick(); };   // tocar no título recolhe/mostra os atalhos
$("dT6L").onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("dT6L").onclick(); } };
$("dBalEdit").onclick=()=>{ window.dEditBal=!window.dEditBal; $("dTop6")._open=-1; dTop6Render(); };
$("dBalAuto").onclick=()=>{ if(!confirm("Voltar aos atalhos automáticos? Os seus atalhos serão apagados.")) return; dBalSave(null); dTop6Render(); };
function dFinOpen(){ if(!don.itens.length) return toast("Nada lançado ainda."); const nomes=[...don.itens].map(i=>esc(i.nome.replace(/\s+(kg|un)$/i,""))).join(" · ");
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
  V.autoTable(pdf, { startY: 34, styles: { fontSize: 10, cellPadding: 2.5 }, headStyles: { fillColor: [22, 101, 52] }, footStyles: { fillColor: [226, 238, 229], textColor: [20, 83, 45] }, columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 12, halign: "center" } },
    head: [["CONFERIDO", "Nº", "CÓDIGO", "NOME", "QUANTIDADES"]], body: d.itens.map((i, x) => ["", String(x + 1), i.cod || "-", i.nome, `${fq(i.qtd)} ${i.unidade}`]),
    foot: [["", "", "TOTAL", totTxt(d.totalKg, d.totalUn, 0).replace(/ · 0 itens$/, ""), `${d.itens.length} itens`]],
    didDrawCell: h => { if (h.section === "body" && h.column.index === 0) { const c = h.cell; pdf.setDrawColor(60); pdf.setLineWidth(.3); pdf.rect(c.x + 9, c.y + c.height / 2 - 2, 4, 4); } } });
  let y = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : 40) + 10; const top = romTop(d);
  if (top.length) { if (y > 262) { pdf.addPage(); y = 20; } pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); pdf.text("TOP 3 MAIS DOADOS · ÚLTIMOS 30 DIAS", 14, y); pdf.setTextColor(0); pdf.setFontSize(11);
    top.forEach((t, x) => { pdf.setFont("helvetica", "bold"); pdf.text(`${t.pos}º`, 14, y + 7 + x * 6.5); pdf.setFont("helvetica", "normal"); pdf.text(`${t.nome} — ${t.q}`, 23, y + 7 + x * 6.5); }); }
  return pdf.output("blob");
}
const byName = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }) || (a.unidade || "").localeCompare(b.unidade || "");
function showRomaneio(d) {
  curRom = d; romEdit = null; $("romBar").classList.remove("hidden"); $("donaEntrada").classList.add("hidden"); $("donaRomaneio").classList.remove("hidden");
  $("romHead").innerHTML = `<h3 class="romtitle">DOAÇÃO FLV</h3><p class="note">Data: ${dataBR(d.data)} · Loja: ${esc(LOJA)}${d.editada ? " · editada" : ""}</p>`;
  $("romBody").innerHTML = `<div class="rwrap"><table class="rom"><thead><tr><th class="rn">Nº</th><th>CÓDIGO</th><th>NOME</th><th>QUANTIDADES</th></tr></thead><tbody>` +
    d.itens.map((i, x) => `<tr><td class="rn">${x + 1}</td><td>${esc(i.cod || "—")}</td><td>${esc(i.nome)}</td><td>${fq(i.qtd)} ${esc(i.unidade)}</td></tr>`).join("") +
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
    const campos = { itens: itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" })), totalKg: tot("kg"), totalUn: tot("un"), editada: true };
    try {
      if (db && curRom._id) await V.updateDoc(V.doc(db, "doacoes", curRom._id), campos);
      else { const l = store.get(HK, []), y = l.find(z => String(z.em) === hid(curRom)); if (y) { Object.assign(y, campos); store.set(HK, l); } }
    } catch (err) {   // o Firebase recusou a alteração (regras só permitem criar): guarda a edição neste aparelho
      console.error(err); const m = store.get(EDK, {}); m[curRom._id] = campos; store.set(EDK, m); Object.assign(curRom, campos);
      toast("Salvo só neste aparelho: o Firebase não permite alterar doações na nuvem."); romEditEnd(); renderTop(); return; }
    Object.assign(curRom, campos); toast("Doação atualizada."); romEditEnd(); if (!db) reloadLocalHist(); renderTop(); } });

// ---------- revisão de códigos: marca "revisar" (guardada neste aparelho) e aviso de código repetido ----------
const RVK = "validamais-revisar", TNOME = { ean: "EAN", plu: "Balança", doa: "Doação" };
const tNome = (t, per) => t === "doa" ? (per === true ? "Código interno" : per === false ? "Doação" : "Código interno/doação") : TNOME[t];   // em Perecíveis não existe código de doação: é o «código interno»
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
const dupTxt = l => l.map(d => `${tNome(d.t, SETOR === PER)} ${d.c} também em ${d.outros.slice(0, 3).join(", ")}${d.outros.length > 3 ? " +" + (d.outros.length - 3) : ""}`).join(" · ");
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
let simOk = "", cadEdit = null, cFiltro = "";
try { indexedDB.deleteDatabase("validamais-fotos-kor"); } catch (e) {}   // recurso de foto removido: apaga o que ficou guardado neste aparelho
   // chave do produto em edição
const cadKey = p => (p.barcode ? "b" + p.barcode + "|" + norm(p.name || "") : "n" + norm(p.name || ""));   // mesmo EAN com nomes diferentes = produtos diferentes (linhas separadas)
const eanFin = b => { b = String(b || ""); return b.length > 3 ? esc(b.slice(0, -3)) + `<em class="ult">${esc(b.slice(-3))}</em>` : esc(b); };   // KÓRIN: os 3 últimos números em vermelho
const eanZap = b => { b = String(b || ""); return b.length > 3 ? b.slice(0, -3) + "*" + b.slice(-3) + "*" : b; };                                    // no WhatsApp: os 3 últimos em negrito
const eanPdfDraw = (pdf, d, col) => { if (d.section !== "body" || d.column.index !== col) return; const t = String(d.cell.raw || ""); if (t.length < 4 || t === "-") return; const a = t.slice(0, -3), z = t.slice(-3), x = d.cell.x + d.cell.padding("left"), y = d.cell.y + d.cell.height / 2 + 1.2;
  pdf.setFontSize(9.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(30, 30, 30); pdf.text(a, x, y); const w = pdf.getTextWidth(a); pdf.setFont("helvetica", "bold"); pdf.setTextColor(209, 18, 31); pdf.text(z, x + w, y); pdf.setTextColor(0, 0, 0); pdf.setFont("helvetica", "normal"); };
const eanPdfHide = (d, col) => { if (d.section === "body" && d.column.index === col && String(d.cell.raw || "").length > 3 && d.cell.raw !== "-") d.cell.text = [""]; };
function cadGroups() { const m = new Map(); products.forEach(p => { if (!p.name) return; const k = cadKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return [...m.entries()].map(([k, l]) => ({ k, l, p: l[0], name: l[0].name, barcode: l.map(x => x.barcode).find(Boolean) || "", plu: l.map(x => x.codigo_balanca).find(Boolean) || "", don: l.map(x => x.codigo_doacao).find(Boolean) || "" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); }
function cadPaint() {
  const q = norm($("cBusca").value.trim()), all = cadGroups(), mapa = codMapa();
  all.forEach(x => { x.dup = dupGrupo(x, mapa); x.rev = revOn(x.name); });
  filtBar($("cFilt"), cFiltro, all.filter(x => x.rev).length, all.filter(x => x.dup.length).length);
  const g = all.filter(x => !q || norm(x.name).includes(q) || x.barcode.includes(q) || (x.plu === q || x.don.toLowerCase() === q)).filter(x => !cFiltro || (cFiltro === "rev" ? x.rev : x.dup.length));
  lixoBtn(); $("cCount").textContent = all.length + (q ? " · " + g.length + " achados" : "");
  const ini = x => { const c = x.name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  let ult = "", letras = [];
  const row = x => `<div class="cadrow${x.rev ? " rv" : ""}"><div class="ci"><b>${esc(x.name)}</b><small>EAN ${x.barcode ? esc(x.barcode) : "—"} · PLU ${x.plu ? esc(x.plu) : "—"} · ${SETOR === PER ? "Interno" : "Doação"} ${x.don ? esc(x.don) : "—"}</small>${PERFIL === "Admin" ? `<small class="porx">👤 ${esc(x.l.map(l => l.por).find(Boolean) || "autor não registrado")} · ${dayOf(x.l[0])}</small>` : ""}${x.dup.length ? `<small class="duptxt">⚠ ${esc(dupTxt(x.dup))}</small><button type="button" class="dpres" data-cres="${esc(x.k)}">Resolver código repetido</button>` : ""}</div><button type="button" class="crev${x.rev ? " on" : ""}" data-crev="${esc(x.k)}" aria-label="${x.rev ? "Tirar a marca de revisar" : "Marcar para revisar"}: ${esc(x.name)}" aria-pressed="${x.rev ? "true" : "false"}">🚩</button><button class="secondary" data-ced="${esc(x.k)}">Editar</button><button class="cdel" data-cdel="${esc(x.k)}" aria-label="Excluir ${esc(x.name)}">✕</button></div>`;
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
// ---------- foto no cadastro: vira a foto do produto (Perecíveis) e lê o rótulo (OCR no próprio aparelho) para sugerir o nome ----------
let cFotoFile = null, ocrW = null, ocrP = null;
const OCR_RUIM = /(validade|val\b|fab|lote|peso|r\$|kg\b|preco|pre[cç]o|cnpj|sif|ingredientes|informa|nutri|conservar|refriger|indústria|industria|brasil|www|\.com)/i;
function ocrCarrega() {
  if (ocrP) return ocrP;
  ocrP = new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "ocr/tesseract.min.js"; sc.onload = ok; sc.onerror = () => no(new Error("ocr")); document.head.appendChild(sc); })
    .then(() => window.Tesseract.createWorker("por", 1, { workerPath: "ocr/worker.min.js", corePath: "ocr/", langPath: "ocr/", gzip: true, workerBlobURL: false, logger: () => {} }))
    .then(w => (ocrW = w)).catch(e => { ocrP = null; throw e; });
  return ocrP;
}
function ocrImg(file, max = 1600) {   // reduz e realça (cinza + contraste) para a leitura
  return new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => { URL.revokeObjectURL(u); const f = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * f); c.height = Math.round(im.height * f);
      const x = c.getContext("2d"); x.filter = "grayscale(1) contrast(1.35)"; x.drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => ok(b), "image/jpeg", 0.9); };
    im.onerror = () => { URL.revokeObjectURL(u); no(new Error("img")); }; im.src = u; });
}
function ocrNomes(data) {   // linhas candidatas a nome: letras suficientes, sem "validade/lote/peso…", maiores primeiro
  const out = []; ((data && data.lines) || []).forEach(l => {
    let t = String(l.text || "").replace(/[^\p{L}\p{N}%.,'\- ]/gu, " ").replace(/\s+/g, " ").trim(); const letras = (t.match(/\p{L}/gu) || []).length;
    if (t.length < 4 || letras < 4 || letras / t.length < 0.7 || (l.confidence || 0) < 45 || OCR_RUIM.test(t)) return;
    const h = l.bbox ? l.bbox.y1 - l.bbox.y0 : 10; out.push({ t: t.slice(0, 60), s: h * (l.confidence || 50) / 100 }); });
  const seen = new Set(); return out.sort((a, b) => b.s - a.s).filter(o => { const k = norm(o.t); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5).map(o => o.t);
}
function ocrNome(t) { const v = String(t).toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); return v; }
async function cadFotoLer(file) {
  const box = $("cFotoBox"); cFotoFile = file; box.hidden = false;
  let thumb = ""; try { thumb = await fotoReduz(file); } catch (e) {}
  const per = CATSET === PER;
  const cab = `<img class="pf-img" src="${thumb}" alt="Foto do produto"><div class="cfi"><b id="cFotoSt">Lendo o rótulo…</b><div id="cFotoOp"></div><small class="muted">${cadEdit ? "Esta será a nova foto do produto. Toque em «Salvar alterações» para guardar." : "Esta foto fica salva no produto."}</small></div>`;
  box.innerHTML = cab;
  const st = t => { const e = $("cFotoSt"); if (e) e.textContent = t; };
  try {   // código de barras na mesma foto
    if (V.Html5Qrcode && !$("cEan").value.trim()) { const r = new V.Html5Qrcode("cReadTmp", { verbose: false }); try { const txt = await r.scanFile(file, false); const d = String(txt || "").replace(/\D/g, ""); if (/^\d{8,13}$/.test(d) && !isScale(d)) { $("cEan").value = d; $("cEan").dispatchEvent(new Event("input")); toast("Código de barras lido: " + d); } } catch (e) {} try { r.clear(); } catch (e) {} }
  } catch (e) {}
  try {
    const w = await ocrCarrega(), img = await ocrImg(file), { data } = await w.recognize(img), nomes = ocrNomes(data);
    if (!nomes.length) { st("Não consegui ler o nome. Digite acima."); return; }
    const op = $("cFotoOp"); if (!op) return;
    if (!$("cNome").value.trim()) { $("cNome").value = ocrNome(nomes[0]); $("cNome").dispatchEvent(new Event("input")); st("Nome lido — confira:"); } else st("Toque para usar como nome:");
    op.innerHTML = nomes.map(n => `<button type="button" data-ocr="${esc(n)}">${esc(ocrNome(n))}</button>`).join("");
  } catch (e) { console.warn(e); st("Leitura do rótulo indisponível agora. Digite o nome."); }
}
$("cFotoBtn").onclick = () => $("cFotoIn").click();
$("cFotoGalBtn").onclick = () => $("cFotoGal").click();
$("cFotoGal").onchange = () => { const f = $("cFotoGal").files && $("cFotoGal").files[0]; if (f) cadFotoLer(f); $("cFotoGal").value = ""; };
$("cFotoNet").onclick = () => { const n = $("cNome").value.trim(), e = $("cEan").value.trim(); if (!n && !e) return toast("Digite o nome do produto primeiro."); window.open("https://www.google.com/search?tbm=isch&q=" + encodeURIComponent((e + " " + n).trim()), "_blank", "noopener"); toast("Segure a imagem escolhida › Baixar imagem. Depois toque em «Galeria»."); };   // foto da internet: busca, baixa no celular e escolhe na galeria
$("cFotoIn").onchange = () => { const f = $("cFotoIn").files && $("cFotoIn").files[0]; if (f) cadFotoLer(f); $("cFotoIn").value = ""; };
$("cFotoBox").onclick = e => { const b = e.target.closest("[data-ocr]"); if (b) { $("cNome").value = ocrNome(b.dataset.ocr); $("cNome").dispatchEvent(new Event("input")); } };
const CAD_FOTO_TXT = "📷 Foto do produto (lê o nome do rótulo)";
function cadFotoZera() { cFotoFile = null; const b = $("cFotoBox"); if (b) { b.hidden = true; b.innerHTML = ""; } const bt = $("cFotoBtn"); if (bt) bt.textContent = CAD_FOTO_TXT; }
function cadReset() { cadFotoZera(); cadEdit = null; if ($("cEanAv")) { $("cEanAv").hidden = true; $("cEanAv").innerHTML = ""; } ["cNome", "cEan", "cPlu", "cDon"].forEach(i => $(i).value = ""); $("cTitulo").textContent = "Novo cadastro"; $("cSalvar").textContent = "Cadastrar"; $("cCancela").hidden = true; $("cEanN").textContent = "0/13"; simOk = ""; if ($("cSim")) { $("cSim").hidden = true; $("cSim").innerHTML = ""; } }
function cadSimList() {   // cadastros com nome igual ou parecido ao que está sendo digitado
  const nm = $("cNome").value.trim().replace(/\s+/g, " "); if (nm.length < 3) return [];
  const own = cadEdit ? (cadGroups().find(y => y.k === cadEdit) || {}).name || "" : "", me = norm(nm), ig = norm(own);
  const ex = [...new Set(products.filter(p => p.name && !p.lixo && norm(p.name) === me && me !== ig).map(p => p.name.trim()))];
  return ex.concat(similarNames(nm, own).filter(n => norm(n) !== ig));
}
function cadSimPaint() {
  const l = cadSimList().slice(0, 4), b = $("cSim"); b.hidden = !l.length; if (!l.length) { b.innerHTML = ""; return; }
  b.innerHTML = `<b>Já existe:</b> ` + l.map(n => `<button type="button" data-sim="${esc(n)}">${esc(n)}</button>`).join("") + `<small>Toque no nome para usar esse cadastro.</small>`;
}
$("cNome").addEventListener("input", () => { simOk = ""; cadSimPaint(); });
$("cSim").onclick = e => { const b = e.target.closest("[data-sim]"); if (!b) return; const x = cadGroups().find(y => norm(y.name) === norm(b.dataset.sim)); if (x) { cadAbrir(x); cadSimPaint(); toast("Cadastro aberto para editar."); } };
function eanPerto(v) {   // EANs já cadastrados que diferem em 1 dígito (ou 2 dígitos trocados de lugar) do digitado
  const out = new Map(); products.forEach(p => { const b = p.barcode; if (!b || b.length !== v.length || b === v || p.lixo) return; let d = 0, pos = []; for (let i = 0; i < v.length; i++) if (v[i] !== b[i]) { d++; pos.push(i); } if (d === 1 || (d === 2 && pos[1] === pos[0] + 1 && v[pos[0]] === b[pos[1]] && v[pos[1]] === b[pos[0]])) out.set(b, p.name); });
  return [...out];
}
function cadEanAviso() {
  const v = $("cEan").value.trim(), av = $("cEanAv"); let h = "";
  if (v.length >= 6) {
    const dono = products.find(p => p.barcode === v && !p.lixo), meu = cadEdit ? (cadGroups().find(y => y.k === cadEdit) || {}) : {};
    if (dono && norm(dono.name) !== norm(meu.name || "")) h += `<b>Este código já é de «${esc(dono.name)}».</b> <button type="button" data-ceanuse="${esc(dono.name)}">Abrir esse cadastro</button>`;
    if (v.length === 13 && !isScale(v) && !eanOk(v)) { h += `<b>Código inválido:</b> algum número está errado (erro de digitação). Confira ou toque em Bipar.`; eanPerto(v).slice(0, 3).forEach(([b, n]) => { h += ` <button type="button" data-ceanfix="${b}">Será ${b} (${esc(n)})?</button>`; }); }
    else if (!dono && v.length >= 8) eanPerto(v).slice(0, 2).forEach(([b, n]) => { h += `<b>Parecido com o código de «${esc(n)}»</b> (${b}). <button type="button" data-ceanfix="${b}">Usar ${b}</button>`; });
  }
  av.hidden = !h; av.innerHTML = h;
}
$("cEanAv").onclick = e => { const f = e.target.closest("[data-ceanfix]"), u = e.target.closest("[data-ceanuse]");
  if (f) { $("cEan").value = f.dataset.ceanfix; $("cEan").dispatchEvent(new Event("input")); const d = products.find(p => p.barcode === f.dataset.ceanfix); if (d) { const x = cadGroups().find(y => norm(y.name) === norm(d.name)); if (x) { cadAbrir(x); cadEanAviso(); } } }
  else if (u) { const x = cadGroups().find(y => norm(y.name) === norm(u.dataset.ceanuse)); if (x) { cadAbrir(x); cadEanAviso(); toast("Cadastro aberto para editar."); } } };
$("cEan").oninput = () => { const v = $("cEan").value.replace(/\D/g, "").slice(0, 13); $("cEan").value = v; $("cEanN").textContent = v.length + "/13"; cadEanAviso(); };
$("cPlu").oninput = () => { $("cPlu").value = $("cPlu").value.replace(/\D/g, "").slice(0, 6); };
$("cDon").oninput = () => { $("cDon").value = $("cDon").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); };
$("cBusca").oninput = cadPaint; $("cCancela").onclick = cadReset;
$("cSalvar").onclick = async () => {
  const name = $("cNome").value.trim().replace(/\s+/g, " "), ean = $("cEan").value.trim(), plu = $("cPlu").value.trim(), don = $("cDon").value.trim().toUpperCase();
  if (!name) { toast("Digite o nome do produto."); return $("cNome").focus(); }
  if (ean && !/^\d{6,13}$/.test(ean)) { toast("O código de barras deve ter de 6 a 13 números."); return $("cEan").focus(); }
  const mine = cadEdit ? products.filter(x => x.name && cadKey(x) === cadEdit) : [];
  const outros = products.filter(x => !mine.includes(x));
  let d;
  if (ean.length === 13 && !isScale(ean) && !eanOk(ean)) { cadEanAviso(); if (!(await askConfirm({ icon: "⚠️", title: "Código de barras inválido", text: ean, sub: "Algum número está errado (erro de digitação). Confira ou bipe o produto.", ok: "Salvar mesmo assim", cancel: "Corrigir" }))) return $("cEan").focus(); }
  if (ean && (d = outros.find(x => x.barcode === ean))) return toast(`Esse código de barras já pertence a «${d.name}».`);
  if (plu && (d = outros.find(x => x.codigo_balanca && Number(x.codigo_balanca) === Number(plu)))) return toast(`Esse código de balança já pertence a «${d.name}».`);
  if (don && (d = outros.find(x => String(x.codigo_doacao || "").toUpperCase() === don))) return toast(`Esse código de doação já pertence a «${d.name}».`);
  if (!ean && !mine.length && outros.some(x => norm(x.name || "") === norm(name) && !x.barcode)) return toast("Já existe um produto com esse nome.");
  if (!cadEdit && simOk !== norm(name)) { const sl = cadSimList(); if (sl.length) { simOk = norm(name); cadSimPaint(); return toast("Já existe «" + sl[0] + "». Toque no nome para usar, ou em Cadastrar de novo para criar mesmo assim."); } }
  const f = { name, barcode: ean, codigo_balanca: plu, codigo_doacao: don }, fail = e => { console.error(e); toast("Erro ao salvar na nuvem (confira as regras do Firebase)."); };
  if (mine.length) {
    if (db) { const ts = V.serverTimestamp(); mine.forEach(x => V.updateDoc(V.doc(db, "products", x.id), { ...f, updatedAt: ts }).catch(fail)); }
    else { mine.forEach(x => Object.assign(x, f)); persist(); render(); }
    toast("Cadastro atualizado.");
  } else {
    const rec = { ...f, category: CATSET, expiry: "", quantity: 1, por: myName() };
    if (db) { const ts = V.serverTimestamp(); V.addDoc(V.collection(db, "products"), { ...rec, createdAt: ts, updatedAt: ts }).catch(fail); }
    else { products.push({ ...rec, id: uid(), updatedAt: Date.now() }); persist(); render(); }
    toast("«" + name + "» cadastrado.");
  }
  if (cFotoFile) fotoGravaNome(name, cFotoFile).then(ok => ok && toast("Foto salva no produto."));
  cadReset(); setTimeout(cadPaint, db ? 600 : 0);
};
$("cFilt").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; cFiltro = cFiltro === b.dataset.f ? "" : b.dataset.f; cadPaint(); };
$("cLista").onclick = e => {
  const b = e.target.closest("[data-ced],[data-cdel],[data-crev],[data-cres]"); if (!b) return;
  if (b.dataset.cres !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.cres); if (x) dupResolver(x); return; }
  if (b.dataset.crev !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.crev); if (!x) return; const on = !revOn(x.name); revSet(x.name, on); cadPaint(); toast(on ? "Marcado para revisar." : "Marca de revisão removida."); return; }
  if (b.dataset.ced !== undefined) { const x = cadGroups().find(y => y.k === b.dataset.ced); if (x) cadAbrir(x); return; }
  const x = cadGroups().find(y => y.k === b.dataset.cdel); if (x) cadExcluir(x); };
function cadAbrir(x) { cadEdit = x.k;
  $("cNome").value = x.name; $("cEan").value = x.barcode; $("cPlu").value = x.plu; $("cDon").value = x.don; $("cEanN").textContent = x.barcode.length + "/13";
  $("cTitulo").textContent = "Editando cadastro"; $("cSalvar").textContent = "Salvar alterações"; $("cCancela").hidden = false;
  { cFotoFile = null; const d = fotoCache[fotoK(x.name)] || "", box = $("cFotoBox"); box.hidden = !d; box.innerHTML = d ? `<img class="pf-img" src="${d}" alt="Foto atual do produto"><div class="cfi"><b>Foto atual do produto</b><small class="muted">Para trocar, toque em «Trocar foto» e depois em «Salvar alterações».</small></div>` : ""; $("cFotoBtn").textContent = d ? "📷 Trocar foto do produto" : CAD_FOTO_TXT; }   // mostra a foto que o produto já tem e deixa trocar
  window.scrollTo(0, 0); }
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
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Código repetido"><div class="sheethead"><h2>${tNome(d.t, SETOR === PER)} ${esc(d.c)} repetido</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
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
    const ja = achaEan(d);
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
  const campos = { itens: itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" })), totalKg: tot("kg"), totalUn: tot("un"), editada: true };
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
  const c = don.cont, itens = don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc: lanc || 1, cod: cod || "" }));   // ordem de lançamento
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
    itens: don.itens.map(({ nome, unidade, qtd, lanc, cod }) => ({ nome, unidade, qtd, lanc, cod: cod || "" })) };   // ordem de lançamento (romaneio)
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
 $("navLoja").onclick = () => go("Loja"); $("navDoacao").onclick = () => go("Doacao"); $("navEtiquetas").onclick = () => go("Etiquetas"); $("navInventario").onclick = () => go("Inventario"); $("navCadastros").onclick = () => go("Cadastros"); $("dScan").onclick = () => openScan("doacao");
// ----- top 3 mais doados (últimos 30 dias, compacto) -----
let topDb = [];
// recalcula os balões «Mais doados» (o painel antigo de top 3 foi removido)
function renderTop() { try { dTop6Render(); } catch (e) {} }
if (db) V.onSnapshot(V.query(V.collection(db, "doacoes"), V.orderBy("em", "desc"), V.limit(40)), s => { topDb = s.docs.map(d => withEdits({ ...d.data(), _id: d.id })); renderTop(); }, console.error);
renderDon(); renderKey(); renderTop();
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
    rep.push(`<div class="shg"><b>${tNome(o.t, ents.every(e => e.set === PER) ? true : ents.some(e => e.set === PER) ? null : false)} ${esc(o.c)}</b>${cruza ? " <small>(entre setores)</small>" : ""}${ents.map(e => `<div class="shrow">${lk(e.n, e.set)}${cruza ? `<small> · ${esc(e.set)}</small>` : ""}<span class="shbts"><button type="button" class="shact pri" data-a="uni2" data-t="${o.t}" data-c="${esc(o.c)}" data-n="${esc(e.n)}" data-s="${esc(e.set)}">Unir neste</button><button type="button" class="shact" data-a="lim" data-t="${o.t}" data-c="${esc(o.c)}" data-n="${esc(e.n)}" data-s="${esc(e.set)}">Tirar daqui</button><button type="button" class="shact del" data-a="exc" data-t="${o.t}" data-c="${esc(o.c)}" data-n="${esc(e.n)}" data-s="${esc(e.set)}">Excluir cadastro</button></span></div>`).join("")}</div>`); });
  sec.push({ t: "Códigos repetidos", d: "O mesmo código em produtos diferentes (quase sempre é o mesmo produto com dois nomes). «Unir neste» deixa todos com este nome; «Tirar daqui» apaga o código só daquele produto (o cadastro continua); «Excluir cadastro» manda aquele cadastro para a lixeira.", n: rep.length, it: rep });
  // mesmo nome, cadastros separados
  const porNome = new Map(); grupos.forEach(x => { const k = norm(x.name); (porNome.get(k) || porNome.set(k, []).get(k)).push(x); });
  const iguais = [];
  porNome.forEach(l => { if (l.length < 2) return; const nome = l[0].name, eans = new Set(l.map(x => x.barcode).filter(Boolean)), plus = new Set(l.map(x => x.plu).filter(Boolean)), dons = new Set(l.map(x => x.don).filter(Boolean)), podeJuntar = eans.size <= 1 && plus.size <= 1 && dons.size <= 1;
    iguais.push(`<div class="shg"><b>${esc(nome)}</b> <small>${l.length} cadastros</small>${l.map(x => `<div class="shrow"><small>EAN ${x.barcode ? esc(x.barcode) : "—"}${x.plu ? " · PLU " + esc(x.plu) : ""}${x.don ? " · cód. " + esc(x.don) : ""}</small><button type="button" class="shact" data-a="ren" data-n="${esc(x.name)}" data-b="${esc(x.barcode)}" data-s="${atual}">Renomear</button></div>`).join("")}${podeJuntar ? `<button type="button" class="shact pri" data-a="jun" data-n="${esc(nome)}" data-s="${atual}">Juntar em um só</button>` : '<small class="note">EANs diferentes: provavelmente são produtos diferentes. Renomeie para diferenciar.</small>'}</div>`); });
  sec.push({ t: "Mesmo nome em cadastros separados", d: "Aparecem como linhas repetidas em Cadastros.", n: iguais.length, it: iguais });
  const par = dupGroups();
  sec.push({ t: "Nomes parecidos", d: "Podem ser o mesmo produto escrito de formas diferentes.", n: par.length, it: par.length ? [par.map(a => a.map(x => esc(x.nome)).join(" ≈ ")).slice(0, 6).join("<br>"), `<button type="button" class="shact pri" data-a="uni">Escolher o nome certo</button>`] : [] });
  if (atual === PER) { const sg = grupos.filter(x => setSet(x.p) === PER && nomeSemGramagem(x.name));
    sec.push({ t: "Nomes sem gramagem (Perecíveis)", d: "O nome não tem peso nem quantidade (g, kg, ml, un). Toque para abrir o cadastro e detalhar. Ex.: «Danone grego light 400g».", n: sg.length, it: sg.map(x => lk(x.name, PER)) }); }
  // Perecíveis sem foto (Admin): uma linha por produto (a foto vale para todos os lotes do mesmo nome). Emoji NÃO conta como foto.
  [PER, "FLV"].forEach(SS => { const nomeSS = SS === PER ? "Perecíveis" : "FLV"; const nomes = new Map(), eanDe = {}, pluDe = {}; rawAllAtivos().forEach(p => { if (setSet(p) !== SS || p.retirado) return; const k = fotoK(p.name); if (!nomes.has(k)) nomes.set(k, p.name); if (p.barcode) (eanDe[k] = eanDe[k] || new Set()).add(String(p.barcode).trim()); if (p.codigo_balanca) pluDe[k] = pluDe[k] || String(p.codigo_balanca).trim(); });
    const sabe = !db || fotosPronto, nFot = [...nomes.keys()].filter(k => fotoCache[k]).length;
    const sem = sabe ? [...nomes.entries()].filter(([k]) => !fotoCache[k]).map(([, n]) => n).sort((x, y) => x.localeCompare(y, "pt-BR")) : [];
    if (!sabe) sec.push({ t: nomeSS + " sem foto", d: fotosErro ? "Não consegui ler as fotos da nuvem agora. Feche e abra de novo; se continuar, avise." : "Conferindo as fotos na nuvem… a lista aparece sozinha em instantes.", n: 1, it: ["<small class=\"note\">Aguarde um instante…</small>"] });
    else sec.push({ t: `${nomeSS} sem foto (${sem.length} de ${nomes.size})`, d: `De ${nomes.size} produtos ${SS === PER ? "dos Perecíveis" : "do FLV"}, ${nFot} têm foto e ${sem.length} não. Emoji não conta como foto. Toque em «📷 Foto» para tirar ou escolher; a foto vale para todos os lotes do produto.`, n: sem.length, todos: true,
      it: sem.map(n => { const k = fotoK(n), eans = eanDe[k] ? [...eanDe[k]] : [], busca = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent((eans[0] || "") + " " + n);
        const cod = eans.length ? eans.map(e => `<button type="button" class="shcod" data-copia="${esc(e)}" title="Toque para copiar">EAN ${esc(e)} <i>⧉</i></button>`).join("") : (pluDe[k] ? `<span class="shcod sem">sem EAN · balança ${esc(pluDe[k])}</span>` : `<span class="shcod sem">sem código de barras</span>`);
        return `<div class="shrow shfoto"><div class="shn2"><b>${esc(nomeBonito(n))}</b>${cod}</div><span class="shbts"><a class="shact" href="${esc(busca)}" target="_blank" rel="noopener" aria-label="Procurar imagem na internet">🔎</a><button type="button" class="shact pri" data-foto="${esc(n)}">📷 Foto</button></span></div>`; }) }); });
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
  if (d.a === "uni2") { const ch = codChave(d.t, d.c), campo = CAMPO[d.t], lotes2 = rawAllAtivos().filter(p => setSet(p) === d.s && codChave(d.t, p[campo]) === ch), mp = new Map();
    lotes2.forEach(p => { const k = norm(p.name), o = mp.get(k) || { nome: p.name, ean: new Set(), plu: new Set(), doa: new Set() }; if (p.barcode) o.ean.add(p.barcode); if (p.codigo_balanca) o.plu.add(p.codigo_balanca); if (p.codigo_doacao) o.doa.add(p.codigo_doacao); mp.set(k, o); });
    const g = [...mp.values()], alvo = g.find(x => norm(x.nome) === norm(d.n)); if (alvo) await dupUnirCore(g, alvo, null, d.s); }
  else if (d.a === "lim") { const campo = CAMPO[d.t], alvo = lotes().filter(p => codChave(d.t, p[campo]) === codChave(d.t, d.c));
    const r = await askConfirm({ icon: "🧹", title: "Tirar o código deste produto?", text: `${tNome(d.t, d.s === PER)} ${d.c}`, sub: `de «${d.n}» (${d.s}). O produto continua cadastrado, só sem esse código.`, ok: "Tirar código", cancel: "Cancelar" });
    if (r !== true) return; saudeSet(alvo, { [campo]: "" }); toast(`Código tirado de «${d.n}».`); }
  else if (d.a === "exc") { const campo = CAMPO[d.t], alvo = lotes().filter(p => codChave(d.t, p[campo]) === codChave(d.t, d.c));
    if (!alvo.length) return;
    const r = await askConfirm({ icon: "🗑", title: "Excluir este cadastro?", text: `«${d.n}» (${d.s})`, sub: `${tNome(d.t, d.s === PER)} ${d.c}. O cadastro e as validades dele vão para a lixeira (dá para restaurar por 3 dias). Os outros cadastros com esse código não mudam.`, ok: "Excluir", cancel: "Cancelar" });
    if (r !== true) return;
    if (db) cadApagar({ k: "__saude__", name: d.n, l: alvo });   // nuvem: marca cada lote com «lixo» (vale para qualquer setor)
    else { const agora = Date.now(); alvo.forEach(p => { p.lixo = agora; }); const todos = [...new Set(products.concat(lixeira, outros))]; separaLixo(todos); persist(); render(); lixoBtn(); }   // local: o cadastro pode ser de outro setor (fica em «outros»), então refaz as listas
    toast(`«${d.n}» foi para a lixeira.`); }
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
  [["validamais-etiquetas-per", "Etiquetas de Perecíveis"]].forEach(([k, t]) => { if (n(store.get(k, []))) l.push(`${t}: ${n(store.get(k, []))} item(ns)`); });
  [["validamais-doacao-per", "Doação de Perecíveis"]].forEach(([k, t]) => { const d = store.get(k, null); if (d && n(d.itens)) l.push(`${t} (rascunho): ${n(d.itens)} item(ns)`); });
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
    ${sec.map(s => `<div class="shsec"><div class="shh"><span class="shb ${s.n ? "aten" : "ok"}">${s.n ? s.n : "✓"}</span><b>${esc(s.t)}</b></div>${s.n ? `<small class="note">${esc(s.d)}</small><div class="shit">${s.it.slice(0, s.todos ? 500 : 10).map(h => `<div>${h}</div>`).join("")}${!s.todos && s.it.length > 10 ? `<div class="muted">+ ${s.it.length - 10} outros (resolva estes e abra de novo)</div>` : ""}</div>` : ""}</div>`).join("")}
    <div class="shsec"><div class="shh"><span class="shb info">ⓘ</span><b>Guardado só neste aparelho</b></div>${loc.length ? `<div class="shit">${loc.map(t => `<div>${esc(t)}</div>`).join("")}</div><small class="note">Outros celulares não veem isso.</small>` : '<small class="note">Nada. Tudo o que importa está na nuvem.</small>'}</div>
    <div class="shsec"><div class="shh"><span class="shb info">ⓘ</span><b>Memória e armazenamento</b></div><div id="shMem">${memHtml || '<small class="note">Calculando…</small>'}</div></div>
    <div class="shsec"><div class="shh"><b>Autoteste da nuvem</b></div><small class="note">Cria um item de teste em cada setor, altera, apaga e diz se o Firebase aceitou. Não deixa nada para trás.</small>
      <button type="button" class="primary big" id="shRun" style="margin-top:10px">Rodar autoteste</button><div id="shRes" class="shit">${run}</div></div></section>`;
    bg.querySelector(".sheet").scrollTop = y; };
  saudeRepinta = () => { if (bg.isConnected) paint(); else saudeRepinta = null; };
  paint(); document.body.appendChild(bg); memCalc().then(h => { memHtml = h; const m = bg.querySelector("#shMem"); if (m) m.innerHTML = h; });
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) { bg.remove(); return; }
    const cp = e.target.closest("[data-copia]"); if (cp) { const v = cp.dataset.copia; const ok = () => toast("Código copiado: " + v), falha = () => { try { const t = document.createElement("textarea"); t.value = v; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); ok(); } catch (x) { toast("Código: " + v); } };
      try { navigator.clipboard.writeText(v).then(ok, falha); } catch (x) { falha(); } return; }
    const ft = e.target.closest("[data-foto]"); if (ft) { bg._fotoNome = ft.dataset.foto; let inp = bg.querySelector("#shFotoIn"); if (!inp) { inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.id = "shFotoIn"; inp.hidden = true; bg.appendChild(inp);
        inp.onchange = async () => { const f = inp.files && inp.files[0], nome = bg._fotoNome; inp.value = ""; if (!f || !nome) return; toast("Salvando a foto…"); const ok = await fotoGravaNome(nome, f); toast(ok ? "Foto salva: " + nomeBonito(nome) : "Não consegui salvar a foto."); fotoIcones(); paint(); }; }
      inp.click(); return; }
    const ac = e.target.closest("[data-a]"); if (ac) { saudeAcao({ ...ac.dataset }, paint); return; }
    const n = e.target.closest("[data-sn]"); if (n) { const nome = n.dataset.sn, set = n.dataset.ss; bg.remove(); if (set && set !== (SETOR === PER ? PER : "FLV")) trocaSetor(set); $("navCadastros").click(); $("cBusca").value = nome; cadPaint(); window.scrollTo(0, 0); return; }
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
    <label class="nfrow"><span><b>Fotos nos produtos</b><small>Mostra a foto do produto nos cartões (Perecíveis e FLV). Sem foto, aparece um quadrado com câmera</small></span><input type="checkbox" id="vsIco" ${iconesOn() ? "checked" : ""}></label>
    <label>Visualização da lista de Validades</label><div class="vspre" id="vsV"><button type="button" data-v="lista">Lista</button><button type="button" data-v="grade">Grade (fotos grandes)</button></div>
    <label>Tamanho da letra da lista</label><div class="vspre" id="vsF"><button type="button" data-f="normal">Normal</button><button type="button" data-f="grande">Grande</button></div>
    <div class="vsprev" id="vsPrev"></div>
    <div class="toolbar" style="margin-top:12px"><button class="primary big" type="button" id="vsSalva">Salvar</button><button class="secondary" type="button" id="vsPad">${admin ? "Restaurar padrão" : (loc ? "Usar o padrão da loja" : "Restaurar padrão")}</button></div></section>`;
  document.body.appendChild(bg);
  const q = x => bg.querySelector(x), txt = h => { const n = parseInt(h.slice(1), 16), f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return (.2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255)) > .4 ? "#1a1405" : "#fff"; };
  const prev = () => { q("#vsPrev").innerHTML = [["a", `1 a ${v.red} dias`], ["y", `${v.red + 1} a ${v.yel || "…"} dias`], ["g", "depois"]].map(([k, t]) => `<span style="background:${v.cores[k]};color:${txt(v.cores[k])}">${k === "a" ? "🔴" : k === "y" ? "🟡" : "🟢"} ${t}</span>`).join("");
    bg.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", b.dataset.f === v.fonte)); bg.querySelectorAll("[data-c]").forEach(i => { i.value = v.cores[i.dataset.c]; }); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); const p = e.target.closest("[data-p]"); if (p) { v.cores = { ...PRE[p.dataset.p] }; prev(); } const f = e.target.closest("[data-f]"); if (f) { v.fonte = f.dataset.f; prev(); } };
  q("#vsFx").onchange = e => { store.set(FXK, e.target.checked); fxAplica(); sirene(); };
  const vsVis = () => bg.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === visaoDe())); vsVis();
  q("#vsV").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; store.set(VSK, b.dataset.v); vsVis(); render(); };
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
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "atalhos"), sn => {
  if (sn.exists() && Array.isArray(sn.data().l)) { const l = sn.data().l, at = JSON.stringify(store.get("validamais-dbal", null)), nv = JSON.stringify(l.length ? l : null); if (at !== nv) { store.set("validamais-dbal", l.length ? l : null); try { dTop6Render(); } catch (e) {} } }
  else if (!sn.exists() && PERFIL === "Admin" && dBalCfg()) dBalSave(dBalCfg());   // primeira vez: os atalhos do Admin viram os oficiais
}, e => console.warn("atalhos", e)); } catch (e) { console.warn(e); } }

// ---------- Escala 5x2 (perfis BENASSI e Admin; os dois podem editar e configurar): duas pessoas, tudo configurável (horários, folgas, ciclo, nomes, fotos) ----------
const ESC_K = "validamais-escala", ESC_CK = "validamais-escala-cfg";
const ESC_DEF = { ini: "2026-11-09", dia: 504, int: 60, meta: 2520,
  p: { r: { n: "Renato", full: "", foto: "", ent: 660 }, y: { n: "Yossef", full: "", foto: "", ent: 420 } },
  ciclo: { r: ["FTTFTTT", "TTFFTTT"], y: ["TTFTFTT", "FTTTFTT"] } };   // ciclo = D S T Q Q S S. Renato folga sempre na quarta, Yossef na quinta; domingo alterna: quem folga no domingo já tem sua 2ª folga; quem trabalha no domingo folga também na terça (semana 1: Renato domingo+quarta, Yossef terça+quinta; semana 2: Renato terça+quarta, Yossef domingo+quinta). Ninguém passa de 5 dias seguidos.
const ESC_CICLOS_ANTIGOS = [{ r: ["FTTFTTT", "TTFTFTT"], y: ["TTFFTTT", "FTTTFTT"] }, { r: ["FTFTTTT", "TTFFTTT"], y: ["TTTFFTT", "FTTTFTT"] }, { r: ["FTTFTTT", "TTFFTTT", "FTTFTTT"], y: ["TTFTFTT", "FTTTFTT", "TTFFTTT"] }, { r: ["FTFTTTT", "TFFTTTT"], y: ["TTTTFFT", "FTTTFTT"] }].map(x => JSON.stringify(x));   // padrões antigos: migram sozinhos para o atual (o primeiro é o ciclo trocado que deixava os dois de folga toda semana)
const ESC_FER = {   // feriados: n = nacional, e = estadual (SP), f = ponto facultativo (2026: nov/dez; 2027: ano inteiro)
  "2026-11-02": { n: "Finados", t: "n" },
  "2026-11-15": { n: "Proclamação da República", t: "n" },
  "2026-11-20": { n: "Consciência Negra", t: "n" },
  "2026-12-25": { n: "Natal", t: "n" },
  "2027-01-01": { n: "Confraternização Universal", t: "n" },
  "2027-02-08": { n: "Carnaval (segunda)", t: "f" },
  "2027-02-09": { n: "Carnaval (terça)", t: "f" },
  "2027-02-10": { n: "Quarta-feira de Cinzas (até 14h)", t: "f" },
  "2027-03-26": { n: "Sexta-feira Santa", t: "n" },
  "2027-04-21": { n: "Tiradentes", t: "n" },
  "2027-05-01": { n: "Dia do Trabalho", t: "n" },
  "2027-05-27": { n: "Corpus Christi", t: "f" },
  "2027-07-09": { n: "Revolução Constitucionalista (SP)", t: "e" },
  "2027-09-07": { n: "Independência do Brasil", t: "n" },
  "2027-10-12": { n: "Nossa Senhora Aparecida", t: "n" },
  "2027-11-02": { n: "Finados", t: "n" },
  "2027-11-15": { n: "Proclamação da República", t: "n" },
  "2027-11-20": { n: "Consciência Negra", t: "n" },
  "2027-12-25": { n: "Natal", t: "n" }
};
let escDir = 0, escFull = false, escWake = null, escVista = store.get("validamais-escala-vista", "lista"), escO = store.get(ESC_K, {}) || {}, escCr = store.get(ESC_CK, null), escOk = store.get("validamais-escala-ok", {}) || {}, escMes = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
const escCfg = () => { const s = escCr || {}, sp = s.p || {}; return { ini: !s.ini || s.ini === "2026-11-08" ? ESC_DEF.ini : s.ini, dia: s.dia || ESC_DEF.dia, int: s.int ?? ESC_DEF.int, meta: s.meta || ESC_DEF.meta,
  p: { r: { ...ESC_DEF.p.r, ...(sp.r || {}) }, y: { ...ESC_DEF.p.y, ...(sp.y || {}) } }, ciclo: s.ciclo && s.ciclo.r && s.ciclo.r.length && s.ciclo.y && s.ciclo.y.length && !ESC_CICLOS_ANTIGOS.includes(JSON.stringify({ r: s.ciclo.r, y: s.ciclo.y })) ? s.ciclo : ESC_DEF.ciclo }; };
const escP = () => { const c = escCfg(); return ["r", "y"].map(k => ({ k, ...c.p[k] })); };
const escKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const escHm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const escH = m => Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : "");
const escSai = (p, c) => p.ent + c.dia + c.int;
const escIniD = c => { const [yy, mm, dd] = c.ini.split("-").map(Number); return new Date(yy, mm - 1, dd); };   // primeiro dia da escala nova (00:00)
const escParcial = (i7, c) => { const [yy, mm, dd] = c.ini.split("-").map(Number), a = new Date(yy, mm - 1, dd, 12), f = new Date(i7.getFullYear(), i7.getMonth(), i7.getDate() + 6, 12); return a.getDay() !== 0 && i7 < a && a <= f; };   // semana em que a escala nova começa no meio
function escBase(pk, d, c) { const [yy, mm, dd] = c.ini.split("-").map(Number), t0 = Date.UTC(yy, mm - 1, dd), du = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); const dom = t0 - new Date(yy, mm - 1, dd).getDay() * 864e5; if (du < dom) return "-";   // os dias antes do início, mas dentro da semana do início (ex.: domingo 08/11), mostram o ciclo sem entrar na conta
  const n = Math.round((du - dom) / 864e5);   // dias desde o domingo da semana 1
  const cl = c.ciclo[pk], w = Math.floor(n / 7), k = ((w % cl.length) + cl.length) % cl.length; return cl[k][((n % 7) + 7) % 7] || "F"; }
function escSt(pk, d, c) { c = c || escCfg(); const b = escBase(pk, d, c); if (b === "-") return "-"; const o = escO[pk] && escO[pk][escKey(d)]; return o || b; }   // antes do início da escala nova nada vale (ajustes antigos nesses dias são ignorados)
function escSalva() {   // grava sempre o ciclo já normalizado: se a nuvem tinha um ciclo antigo/trocado, ele é corrigido aqui também
  if (escCr) { const c = escCfg(), at = JSON.stringify({ r: escCr.ciclo && escCr.ciclo.r, y: escCr.ciclo && escCr.ciclo.y }); if (at !== JSON.stringify(c.ciclo)) escCr = { ...escCr, ciclo: c.ciclo }; }
  store.set(ESC_K, escO); store.set(ESC_CK, escCr); store.set("validamais-escala-ok", escOk); if (db) V.setDoc(V.doc(db, "sh_cfg", "escala"), { o: escO, cfg: escCr || null, ok: escOk, em: Date.now(), por: myName().slice(0, 40) }).catch(e => { console.error(e); toast("Não consegui salvar na nuvem."); }); }
function escToca(pk, key, el) {   // abre uma escolha pequena perto do dia; nada muda com um toque só, só ao tocar numa opção
  const c = escCfg(), P = escP(), p = P.find(x => x.k === pk), d = new Date(key + "T12:00:00"), at = escSt(pk, d, c), base = escBase(pk, d, c); if (base === "-") return toast("Esse dia é da escala antiga (a nova começa em " + escDM(new Date(c.ini + "T12:00:00")) + ").");
  document.querySelectorAll(".etip").forEach(x => x.remove());
  document.querySelectorAll(".etip-alvo").forEach(x => x.classList.remove("etip-alvo"));
  document.querySelectorAll(".etip-dia").forEach(x => x.classList.remove("etip-dia"));
  const nome = { T: "Trabalha", F: "Folga", FE: "Férias" }, temAjuste = !!(escO[pk] && escO[pk][key]), td = el.closest("td"), diaTxt = ESC_DSL[d.getDay()] + ", " + escDM(d);
  const tip = document.createElement("div"); tip.className = "etip"; tip.setAttribute("role", "dialog"); tip.setAttribute("aria-label", esc(p.n) + ", " + diaTxt);
  tip.innerHTML = `<div class="eth"><span class="edot ${p.k}"></span><div class="ei"><b>${diaTxt}</b><small>${esc(p.n)} · ${nome[at]}</small></div><button type="button" class="ex" data-ed="x" aria-label="Fechar">✕</button></div>
    <div class="eopts">${[["T", "💼", "Trabalha"], ["F", "🛌", "Folga"], ["FE", "🏖️", "Férias"]].map(([k, ic, tx]) => `<button type="button" data-ed="${k}" class="${at === k ? "on" : ""}"><i>${ic}</i><span>${tx}</span></button>`).join("")}</div>
    ${temAjuste ? `<button type="button" class="ebase" data-ed="base">↩ Voltar ao padrão (${nome[base] || "—"})</button>` : ""}`;
  document.body.appendChild(tip);
  el.classList.add("etip-alvo"); if (td) td.classList.add("etip-dia");   // marca na própria grade o dia que está sendo alterado
  const r = (td || el).getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 8;   // ancora no dia inteiro, não só no bloco, para não cobrir o outro
  const cx = r.left + r.width / 2;
  tip.style.left = Math.min(Math.max(m, cx - w / 2), innerWidth - w - m) + "px";
  let top = r.bottom + 6, pos = "baixo";
  if (top + h > innerHeight - m) { top = Math.max(m, r.top - h - 6); pos = "cima"; }
  tip.style.top = top + "px"; tip.dataset.pos = pos;
  tip.style.setProperty("--ax", Math.round(Math.min(Math.max(14, cx - parseFloat(tip.style.left)), w - 14)) + "px");   // seta apontando para o bloco
  let preso = true; setTimeout(() => { preso = false; }, 350);   // ignora o "scroll" que o próprio toque pode disparar
  const close = () => { document.removeEventListener("pointerdown", fora, true); removeEventListener("scroll", aoRolar, true); removeEventListener("resize", aoRolar); el.classList.remove("etip-alvo"); if (td) td.classList.remove("etip-dia"); tip.remove(); };
  const fora = e => { if (!tip.contains(e.target)) close(); };
  const aoRolar = () => { if (!preso) close(); };
  setTimeout(() => { document.addEventListener("pointerdown", fora, true); addEventListener("scroll", aoRolar, true); addEventListener("resize", aoRolar); }, 0);
  tip.onclick = e => { const b = e.target.closest("[data-ed]"); if (!b) return; const k = b.dataset.ed; if (k === "x") return close(); if (k === at) return close();
    escO[pk] = escO[pk] || {}; if (k === "base" || k === base) delete escO[pk][key]; else escO[pk][key] = k; escSalva(); close(); escPaint(); };
}
const escAv = (p, px) => p.foto ? `<img class="eav" style="width:${px}px;height:${px}px" src="${p.foto}" alt="${esc(p.n)}">` : `<span class="eav ini ${p.k}" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .5)}px">${esc((p.n || "?")[0].toUpperCase())}</span>`;
const escDM = d => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
const ESC_DSL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function escProblemas(y, m, c) {   // dias em que os dois folgam e semanas que não fecham a carga horária (só dentro da escala nova)
  const P = escP(), dias = [], sem = [], ini = new Date(y, m, 1), fim = new Date(y, m + 1, 0), metaDias = Math.round(c.meta / c.dia); let d = new Date(y, m, 1 - ini.getDay());
  while (d <= fim) { const i7 = new Date(d), nt = { r: 0, y: 0 }; let nova = false;
    for (let i = 0; i < 7; i++) { const ss = P.map(p => escSt(p.k, d, c)); if (ss.some(x => x !== "-")) nova = true;
      const dep = d >= escIniD(c); P.forEach((p, q) => { if (dep && ss[q] === "T") nt[p.k]++; }); if (dep && d.getMonth() === m && ss.every(x => x === "F" || x === "FE")) dias.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    if (nova && i7 >= new Date(c.ini + "T00:00:00") && !escParcial(i7, c)) P.forEach(p => { if (nt[p.k] * c.dia !== c.meta) sem.push({ i: i7, f: new Date(i7.getFullYear(), i7.getMonth(), i7.getDate() + 6), p, n: nt[p.k], mn: nt[p.k] * c.dia }); }); }
  const seq = [], ide = escIniD(c); let q0 = new Date(Math.max(ide, new Date(y, m, 1 - 14))); const run = { r: 0, y: 0 };
  for (let d2 = q0; d2 <= fim; d2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate() + 1)) P.forEach(p => { if (escSt(p.k, d2, c) === "T") { if (++run[p.k] === 6 && d2.getMonth() === m) seq.push({ p, d: new Date(d2) }); } else run[p.k] = 0; });   // 6º dia seguido trabalhando (vale entre semanas)
  return { dias, sem, seq, metaDias };
}
function escAnima(v) {   // deslize curto ao trocar de mês (só o conteúdo do mês; não anima outras trocas)
  const d = escDir; escDir = 0; if (!d || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const el = v.querySelector(".escFull .etb, .ecard"); if (!el) return; el.classList.add(d > 0 ? "esl-n" : "esl-p"); setTimeout(() => el.classList.remove("esl-n", "esl-p"), 320);
}
function escHojeCards(P, hoje, c) {   // «Hoje» embaixo do calendário: quem trabalha brilha com o horário; quem folga fica apagado, dormindo (zzz) e com a data da volta
  const agoraM = hoje.getHours() * 60 + hoje.getMinutes();
  const volta = p => { for (let i = 1; i <= 14; i++) { const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i, 12); if (escSt(p.k, d, c) === "T") return i === 1 ? "amanhã" : ESC_DSL[d.getDay()].toLowerCase() + " " + escDM(d); } return ""; };
  return P.map(p => {
    const st = escSt(p.k, hoje, c), sai = escSai(p, c), av = escAv(p, 56);
    if (st === "T") { const ja = agoraM >= p.ent && agoraM < sai, fim = agoraM >= sai, txt = ja ? `<span class="hs on">🟢 Trabalhando agora</span>` : fim ? `<span class="hs">Turno encerrado</span>` : `<span class="hs">Ainda não chegou</span>`;
      return `<div class="hc T ${p.k}${ja ? " agora" : ""}"><div class="hav">${av}</div><div class="htx"><b>${esc(p.n)}</b>${txt}<small>${escHm(p.ent)}–${escHm(sai)}</small></div></div>`; }
    if (st === "FE") return `<div class="hc FE ${p.k}"><div class="hav">${av}<i class="hbd">🏖️</i></div><div class="htx"><b>${esc(p.n)}</b><span class="hs">De férias</span></div></div>`;
    if (st === "-") return `<div class="hc N ${p.k}"><div class="hav">${av}</div><div class="htx"><b>${esc(p.n)}</b><span class="hs">Escala antiga</span></div></div>`;
    const vt = volta(p);
    return `<div class="hc F ${p.k}"><div class="hav">${av}<span class="zz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span><i class="hbd">😴</i></div><div class="htx"><b>${esc(p.n)}</b><span class="hs">Folga hoje</span>${vt ? `<small>Volta ${vt}</small>` : ""}</div></div>`;
  }).join("");
}
function escPaint() {
  const v = $("escV"); if (!v) return; const adm = PERFIL === "Admin" || PERFIL === "BENASSI" || escNome(), c = escCfg(), P = escP(), { y, m } = escMes, nomeM = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, s => s.toUpperCase());
  const hoje = new Date(), hk = escKey(hoje), ds = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], pr = escProblemas(y, m, c), hrs = `${escH(c.dia)} por dia · ${c.int} min de intervalo · ${escH(c.meta)} por semana`, ferMes = Object.keys(ESC_FER).filter(k => k.startsWith(y + "-" + String(m + 1).padStart(2, "0")));
  const [iy0, im0, id0] = c.ini.split("-").map(Number), iniD = new Date(iy0, im0 - 1, id0), hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), falta = Math.round((iniD - hoje0) / 864e5);
  const aviso = `A escala nova começa em <b>${ESC_DSL[iniD.getDay()].toLowerCase()} ${escDM(iniD)}/${iy0}</b>.`;
  const hj = falta > 0 ? `<div class="enota">${aviso} ${falta === 1 ? "É amanhã." : "Faltam " + falta + " dias."}</div>` : escHojeCards(P, hoje, c);
  const ini = new Date(y, m, 1), fim = new Date(y, m + 1, 0); let d = new Date(y, m, 1 - ini.getDay()), rows = "";
  while (d <= fim) {
    let cels = "", semAntiga = true; const sd0 = new Date(d), tw = {}, fe = {}; P.forEach(q => { tw[q.k] = 0; fe[q.k] = false; });
    for (let i = 0; i < 7; i++) {
      const fora = d.getMonth() !== m, key = escKey(d), ss = P.map(p => escSt(p.k, d, c)), nenhum = d >= iniD && ss.every(x => x === "F" || x === "FE"), fer = ESC_FER[key], fcl = fer ? " fer" + (fer.t === "f" ? " fac" : "") : "", ftit = fer ? ` title="${esc(fer.n)}${fer.t === "f" ? " (facultativo)" : fer.t === "e" ? " (estadual)" : ""}"` : "";
      if (ss.some(x => x !== "-")) semAntiga = false;
      P.forEach((q, qi) => { if (d >= iniD && ss[qi] === "T") tw[q.k]++; if (ss[qi] === "FE") fe[q.k] = true; });
      cels += ss.every(x => x === "-") ? `<td class="ec vz${fora ? " fora" : ""}${key === hk ? " hoje" : ""}${fcl}"${ftit}><i>${d.getDate()}${fer ? `<em class="efhol"></em>` : ""}</i></td>` : `<td class="ec${fora ? " fora" : ""}${key === hk ? " hoje" : ""}${nenhum && !fora ? " vazio" : ""}${fcl}"${ftit}><i>${d.getDate()}${fer ? `<em class="efhol"></em>` : ""}</i>${P.map((p, q) => `<b class="pl ${ss[q] === "-" ? "N" : ss[q]} ${p.k}"${adm ? ` data-ek="${key}" data-ep="${p.k}"` : ""}>${ss[q] === "T" ? esc((p.n[0] || "?").toUpperCase()) : ss[q] === "FE" ? "férias" : ss[q] === "-" ? "–" : "folga"}</b>`).join("")}</td>`;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    const parc = escParcial(sd0, c), tot = P.map(q => { if (parc || fe[q.k]) return `<b class="pl sm ht">–</b>`; const mn = tw[q.k] * c.dia, ok = mn === c.meta; return `<b class="pl sm ht ${ok ? "oky" : "no"}" title="${escH(mn)} na semana">${ok ? "✓" : ""}${escH(mn)}</b>`; }).join("");
    if (!semAntiga) rows += `<tr><td class="ec es en"><i>&nbsp;</i>${P.map(p => `<b class="pl sm nm ${p.k}">${esc(p.n)}</b>`).join("")}</td>${cels}<td class="ec es eh7"><i>&nbsp;</i>${tot}</td></tr>`;
  }
  const chip = (p, st, key) => `<span class="lc ${st === "T" ? p.k : st === "FE" ? "FE" : "F"}"${adm ? ` data-ek="${key}" data-ep="${p.k}"` : ""}>${escAv(p, 24)}<b>${esc(p.n)}</b>${st === "T" ? "trabalha " + escHm(p.ent) + "–" + escHm(escSai(p, c)) : st === "FE" ? "férias" : st === "-" ? "escala antiga" : "FOLGA"}</span>`;
  let lista = ""; { let dd = new Date(y, m, 1 - ini.getDay());
    while (dd <= fim) { const ini7 = new Date(dd), nt = { r: 0, y: 0 }; let linhas = "";
      for (let i = 0; i < 7; i++) { const key = escKey(dd), ss = P.map(p => escSt(p.k, dd, c)), fora = dd.getMonth() !== m, fer = ESC_FER[key], fcl = fer ? " fer" + (fer.t === "f" ? " fac" : "") : "";
        P.forEach((p, q) => { if (ss[q] === "T" && dd >= iniD) nt[p.k]++; });
        if (!ss.every(x => x === "-")) linhas += `<div class="ld${fora ? " fora" : ""}${key === hk ? " hoje" : ""}${(dd >= iniD && ss.every(x => x === "F" || x === "FE")) ? " vazio" : ""}${fcl}"><div class="ldn"><b>${dd.getDate()}${fer ? `<em class="efhol"></em>` : ""}</b><small>${ESC_DSL[i].slice(0, 3)}</small></div><div class="ldc">${P.map((p, q) => chip(p, ss[q], key)).join("")}</div>${fer ? `<div class="ferl${fer.t === "f" ? " fac" : ""}">${fer.t === "f" ? "Facultativo" : fer.t === "e" ? "Feriado estadual" : "Feriado"} · ${esc(fer.n)}</div>` : ""}${(dd >= iniD && ss.every(x => x === "F" || x === "FE")) ? `<div class="lerr">⚠ os dois folgam</div>` : ""}</div>`;
        dd = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() + 1); }
      if (linhas) { const f7 = new Date(ini7.getFullYear(), ini7.getMonth(), ini7.getDate() + 6), par = escParcial(ini7, c), tt = P.map(p => { const mn = nt[p.k] * c.dia; if (par) return `<span class="ant">${esc(p.n)}: ${nt[p.k]} dias nesta semana (começo da escala nova)</span>`; return `<span class="${mn === c.meta ? "ok" : "ruim"}">${esc(p.n)}: ${nt[p.k]} dias · ${mn === c.meta ? escH(c.meta) + " ✓" : escH(mn) + " ⚠"}</span>`; }).join("");
        lista += `<section class="lw"><h4>Semana de ${par ? escDM(new Date(c.ini + "T12:00:00")) : escDM(ini7)} a ${escDM(f7)}</h4><div class="lwn">${P.map(p => `<span class="${p.k}">${esc(p.n)}</span>`).join("")}</div>${linhas}<div class="lt">${tt}</div></section>`; } } }
  const cab = P.map(p => `<div class="epc ${p.k}">${escAv(p, 38)}<div class="epn"><b>${esc(p.n)}</b>${p.full ? `<em>${esc(p.full)}</em>` : ""}<span>${escHm(p.ent)}–${escHm(escSai(p, c))}</span></div></div>`).join("");
  const okK = y + "-" + String(m + 1).padStart(2, "0"), okSig = [...pr.dias.map(escKey), ...pr.sem.map(x => escKey(x.i) + x.p.k + x.n), ...pr.seq.map(x => x.p.k + escKey(x.d))].join("|"), okFeito = !!okSig && escOk[okK] === okSig;   // «está certo assim»: vale enquanto os avisos do mês forem os mesmos; se a escala mudar e surgir aviso novo, volta a avisar
  const alerta = okFeito ? `<div class="eok">✔ Mês conferido: está certo do jeito que está.${adm ? ` <button type="button" data-eok="desfaz">Voltar a avisar</button>` : ""}</div>` : (pr.dias.length || pr.sem.length || pr.seq.length) ? `<div class="ealert" role="alert"><b>⚠ Para corrigir neste mês</b>${pr.dias.map(dt => `<div class="eal">Os dois folgam em <b>${ESC_DSL[dt.getDay()]} ${escDM(dt)}</b>${adm ? ` <button type="button" data-efix="${escKey(dt)}">Corrigir</button>` : ""}</div>`).join("")}${pr.sem.map(s => `<div class="eal">Semana ${escDM(s.i)} a ${escDM(s.f)}: ${esc(s.p.n)} com ${s.n} dia${s.n === 1 ? "" : "s"} (${escH(s.mn)}), meta ${escH(c.meta)}</div>`).join("")}${pr.seq.map(x => `<div class="eal">${esc(x.p.n)} passa de 5 dias seguidos trabalhando em <b>${ESC_DSL[x.d.getDay()]} ${escDM(x.d)}</b></div>`).join("")}${adm ? `<div class="eal eaok"><button type="button" data-eok="${okK}" data-sig="${esc(okSig)}">✔ Está certo do jeito que está</button></div>` : ""}</div>` : "";
  if (escFull) {   // modo tela cheia: só o calendário, ocupando a tela toda (para o líder olhar sem rolar)
    v.className = "escv escFull";
    v.innerHTML = `<div class="efh"><button type="button" id="escFx" aria-label="Sair da tela cheia">✕</button><div class="efn"><button type="button" data-em="-1" aria-label="Mês anterior">‹</button><b>${nomeM}</b><button type="button" data-em="1" aria-label="Próximo mês">›</button></div></div>
      <div class="efp">${P.map(p => `<span class="${p.k}">${escAv(p, 30)}<b>${esc(p.n)}</b> ${escHm(p.ent)}–${escHm(escSai(p, c))}</span>`).join("")}${pr.dias.length ? `<span class="efal">⚠ os dois folgam: ${pr.dias.map(escDM).join(", ")}</span>` : ""}</div>
      ${rows ? `<table class="etb"><thead><tr><th></th>${ds.map(x => `<th>${x}</th>`).join("")}<th class="ht7">Sem.</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="eaviso">${aviso}<br>Antes disso não há escala 5x2.</p>`}`; escAnima(v); return; }
  v.className = "escv";
  const vista = escVista, abas = `<div class="evs"><button type="button" data-ev="lista" class="${vista === "lista" ? "on" : ""}">📋 Lista</button><button type="button" data-ev="cal" class="${vista === "cal" ? "on" : ""}">🗓️ Calendário</button><button type="button" id="escSh" class="sh" aria-label="Enviar imagem no WhatsApp" title="Enviar">📤</button><button type="button" id="escFs" class="sh" aria-label="Tela cheia" title="Tela cheia">⛶</button></div>`;
  const ferLista = ferMes.length ? `<div class="efer">${ferMes.map(k2 => { const f = ESC_FER[k2], dt = new Date(k2 + "T12:00:00"); return `<span class="${f.t === "f" ? "fac" : ""}"><b>${dt.getDate()}</b> ${esc(f.n)}${f.t === "f" ? " (facultativo)" : ""}</span>`; }).join("")}</div>` : "";   // legenda enxuta: só dia e nome, uma linha
  const card = vista === "lista" ? `<section class="ecard"><div class="epcs">${cab}</div>${abas}${lista || `<p class="eaviso">${aviso}<br>Antes disso não há escala 5x2.</p>`}</section>` : `<section class="ecard"><div class="epcs">${cab}</div>${abas}
    ${rows ? `<table class="etb"><thead><tr><th></th>${ds.map(x => `<th>${x}</th>`).join("")}<th class="ht7">Sem.</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="eaviso">${aviso}<br>Antes disso não há escala 5x2.</p>`}</section>`;
  const [iy, im, id] = c.ini.split("-").map(Number);
  v.innerHTML = `<div class="eh0"><button type="button" id="escX" class="secondary">${PERFIL === "BENASSI" ? "Trocar perfil" : "Fechar"}</button>${adm ? `<button type="button" id="escCfgB" class="secondary">⚙️ Configurar</button>` : ""}<h2>🗓️ Escala 5x2</h2></div>
    <div class="enav"><button type="button" data-em="-1" aria-label="Mês anterior">‹</button><b>${nomeM}</b><button type="button" data-em="1" aria-label="Próximo mês">›</button></div>
    ${alerta}${ferLista}${card}<div class="ehoje"><small>Hoje, ${hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}</small><div class="hcards">${hj}</div></div>
    <p class="muted eleg">${hrs}<br>Colorido = trabalha · cinza = folga · azul = férias · contorno vermelho = os dois folgam${adm ? " · Toque em um dia para mudar" : ""}</p>`;
  escAnima(v);
}
function escFixAbrir(key) {   // corrige um dia em que os dois folgam: escolhe quem trabalha e em qual outro dia da semana essa pessoa folga
  const c = escCfg(), P = escP(), d = new Date(key + "T12:00:00"), ini7 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), 12);
  const bloco = p => { const o = P.find(x => x.k !== p.k); let bt = "";
    for (let i = 0; i < 7; i++) { const dd = new Date(ini7.getFullYear(), ini7.getMonth(), ini7.getDate() + i, 12), k2 = escKey(dd); if (k2 === key) continue;
      if (escSt(p.k, dd, c) === "T" && escSt(o.k, dd, c) === "T") bt += `<button type="button" data-efx="${p.k}|${key}|${k2}">${ESC_DSL[i].slice(0, 3)} ${escDM(dd)}</button>`; }
    return `<div class="efb"><h4>${escAv(p, 28)} ${esc(p.n)} trabalha dia ${escDM(d)} e folga em:</h4><div class="efd">${bt || "<small>Nenhum dia disponível nessa semana.</small>"}</div></div>`; };
  const bg = document.createElement("div"); bg.className = "askbg"; bg.id = "escFix"; bg.style.cssText = "position:fixed;inset:0;z-index:2147483000";
  bg.innerHTML = `<div class="ask perfil"><div class="ai">⚠️</div><h3>${ESC_DSL[d.getDay()]} ${escDM(d)}: os dois folgam</h3><p>Escolha quem passa a trabalhar nesse dia. A folga dele vai para outro dia da mesma semana, para a carga continuar em ${escH(c.meta)}.</p>${P.map(bloco).join("")}<button type="button" class="secondary" data-x style="width:100%;margin-top:8px">Cancelar</button></div>`;
  bg.onclick = e => { const b = e.target.closest("[data-efx]"); if (b) { const [pk, a, z] = b.dataset.efx.split("|"), c2 = escCfg(); escO[pk] = escO[pk] || {};
      [[a, "T"], [z, "F"]].forEach(([kk, st]) => { if (st === escBase(pk, new Date(kk + "T12:00:00"), c2)) delete escO[pk][kk]; else escO[pk][kk] = st; }); escSalva(); bg.remove(); escPaint(); toast("Escala corrigida."); return; }
    if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); };
  document.body.appendChild(bg);
}
function escFoto(file, cb) {   // recorta quadrado (rosto um pouco acima do centro) e reduz para 160 px
  const im = new Image(), u = URL.createObjectURL(file); im.onload = () => { URL.revokeObjectURL(u); const s = Math.min(im.width, im.height), sx = (im.width - s) / 2, sy = Math.max(0, Math.min(im.height - s, (im.height - s) * .35)), cv = document.createElement("canvas"); cv.width = cv.height = 160;
    cv.getContext("2d").drawImage(im, sx, sy, s, s, 0, 0, 160, 160); cb(cv.toDataURL("image/jpeg", .82)); }; im.onerror = () => { URL.revokeObjectURL(u); toast("Não consegui ler essa foto."); }; im.src = u;
}
function escCfgAbrir() {
  const dr = JSON.parse(JSON.stringify(escCfg())), bg = document.createElement("div"); bg.className = "askbg"; bg.id = "escCfg"; bg.style.cssText = "position:fixed;inset:0;z-index:2147483000;overflow:auto";
  const hm = m => escHm(m), pm = t => { const [h, mi] = String(t).split(":").map(Number); return (h || 0) * 60 + (mi || 0); };
  const paint = () => { const P = ["r", "y"].map(k => ({ k, ...dr.p[k] }));
    bg.innerHTML = `<div class="ask perfil ecfg"><h3>⚙️ Configurar escala</h3>
      <div class="cfl"><label>Primeiro dia da escala nova<input type="date" id="cfIni" value="${dr.ini}"></label></div>
      <div class="cfl"><label>Horas por dia<input type="time" id="cfDia" value="${hm(dr.dia)}"></label><label>Intervalo (min)<input type="number" id="cfInt" min="0" max="180" value="${dr.int}"></label><label>Meta semanal (h)<input type="number" id="cfMeta" min="1" max="60" step="0.5" value="${dr.meta / 60}"></label></div>
      ${P.map(p => `<div class="cfp ${p.k}"><div class="cfh">${escAv(p, 56)}<div><button type="button" data-cf="foto|${p.k}">📷 ${p.foto ? "Trocar foto" : "Adicionar foto"}</button>${p.foto ? `<button type="button" data-cf="sfoto|${p.k}">Remover</button>` : ""}</div></div>
        <div class="cfl"><label>Nome<input type="text" data-cfn="${p.k}|n" value="${esc(p.n)}" maxlength="20"></label><label>Entrada<input type="time" data-cfn="${p.k}|ent" value="${hm(p.ent)}"></label></div>
        <label class="cfw">Nome completo<input type="text" data-cfn="${p.k}|full" value="${esc(p.full)}" maxlength="60"></label>
        <small class="muted" id="cfS${p.k}">Saída: ${hm(p.ent + dr.dia + dr.int)}</small>
        <div class="cfc"><b>Ciclo de folgas (D S T Q Q S S)</b>${dr.ciclo[p.k].map((w, wi) => `<div class="cfw7"><span>Sem ${wi + 1}</span>${[...w].map((x, di) => `<button type="button" class="${x === "T" ? "t" : "f"}" data-cf="dia|${p.k}|${wi}|${di}">${["D", "S", "T", "Q", "Q", "S", "S"][di]}<i>${x === "T" ? "T" : "F"}</i></button>`).join("")}</div>`).join("")}
          <div class="cfa"><button type="button" data-cf="mais|${p.k}">+ semana</button><button type="button" data-cf="menos|${p.k}">− semana</button></div></div></div>`).join("")}
      <input type="file" accept="image/*" hidden id="cfFile"><div class="arow" style="margin-top:10px"><button type="button" data-cf="cancela">Cancelar</button><button type="button" class="ok" data-cf="salva">Salvar</button></div>
      <button type="button" class="secondary" data-cf="limpa" style="width:100%;margin-top:6px">Apagar ajustes de dias avulsos (volta ao ciclo)</button><button type="button" class="secondary" data-cf="padrao" style="width:100%;margin-top:6px">Voltar ao padrão</button></div>`; };
  const le = () => { const g = id => bg.querySelector(id); if (!g("#cfIni")) return; dr.ini = g("#cfIni").value || dr.ini; dr.dia = pm(g("#cfDia").value) || dr.dia; dr.int = Number(g("#cfInt").value) || 0; dr.meta = Math.round((Number(g("#cfMeta").value) || 42) * 60);
    bg.querySelectorAll("[data-cfn]").forEach(i => { const [k, f] = i.dataset.cfn.split("|"); dr.p[k][f] = f === "ent" ? pm(i.value) : i.value.trim(); }); };
  let alvo = "";
  bg.onchange = e => { if (e.target.id === "cfFile") { const f = e.target.files && e.target.files[0]; if (f && alvo) escFoto(f, d => { le(); dr.p[alvo].foto = d; paint(); }); return; }
    le(); ["r", "y"].forEach(k => { const t = bg.querySelector("#cfS" + k); if (t) t.textContent = "Saída: " + hm(dr.p[k].ent + dr.dia + dr.int); }); };   // sem repintar: não tira o foco de quem está digitando
  bg.onclick = e => { const b = e.target.closest("[data-cf]"); if (!b) { if (e.target === bg) bg.remove(); return; } const [a, k, wi, di] = b.dataset.cf.split("|"); le();
    if (a === "foto") { alvo = k; bg.querySelector("#cfFile").click(); return; }
    if (a === "sfoto") { dr.p[k].foto = ""; return paint(); }
    if (a === "dia") { const w = dr.ciclo[k][+wi]; dr.ciclo[k][+wi] = w.slice(0, +di) + (w[+di] === "T" ? "F" : "T") + w.slice(+di + 1); return paint(); }
    if (a === "mais") { dr.ciclo[k].push(dr.ciclo[k][dr.ciclo[k].length - 1]); return paint(); }
    if (a === "menos") { if (dr.ciclo[k].length > 1) dr.ciclo[k].pop(); return paint(); }
    if (a === "padrao") { Object.assign(dr, JSON.parse(JSON.stringify({ ...ESC_DEF, p: { r: { ...ESC_DEF.p.r, foto: dr.p.r.foto, full: dr.p.r.full }, y: { ...ESC_DEF.p.y, foto: dr.p.y.foto, full: dr.p.y.full } } }))); return paint(); }
    if (a === "limpa") { askConfirm({ icon: "🧹", title: "Apagar ajustes de dias?", text: "O calendário volta ao ciclo de folgas.", ok: "Apagar", cancel: "Voltar" }).then(ok => { if (ok) { escO = {}; escSalva(); escPaint(); toast("Ajustes apagados."); } }); return; }
    if (a === "cancela") return bg.remove();
    if (a === "salva") { if (!dr.p.r.n || !dr.p.y.n) return toast("Coloque o nome das duas pessoas."); escCr = JSON.parse(JSON.stringify(dr)); escSalva(); bg.remove(); escPaint(); toast("Configuração salva."); } };
  paint(); document.body.appendChild(bg);
}
// ---- imagem do mês para compartilhar (WhatsApp) ----
const escLoadImg = src => new Promise(ok => { if (!src) return ok(null); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
async function escImagem() {   // imagem na horizontal (1600x900): dados dos dois à esquerda, calendário à direita
  const c = escCfg(), P = escP(), { y, m } = escMes, W = 1600, H = 900, GX = 510, GW = W - GX - 40, CW = GW / 7, ini = new Date(y, m, 1), fim = new Date(y, m + 1, 0), iniD = escIniD(c);
  const semanas = []; { let q = new Date(y, m, 1 - ini.getDay()); while (q <= fim) { const w0 = new Date(q); let any = false; for (let i = 0; i < 7; i++) { if (P.some(p => escSt(p.k, q, c) !== "-")) any = true; q = new Date(q.getFullYear(), q.getMonth(), q.getDate() + 1); } if (any) semanas.push(w0); } }
  const nomeM = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, t => t.toUpperCase()), imgs = await Promise.all(P.map(p => escLoadImg(p.foto)));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"), F = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const rr = (x0, y0, w, h, r, fill, stroke) => { g.beginPath(); g.roundRect(x0, y0, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); } };
  const tx = (t, x0, y0, sz, col, wt = 700, al = "left") => { g.font = `${wt} ${sz}px ${F}`; g.fillStyle = col; g.textAlign = al; g.textBaseline = "middle"; g.fillText(t, x0, y0); };
  g.fillStyle = "#fffdf6"; g.fillRect(0, 0, W, H); rr(0, 0, W, 14, 0, "#e0a030");
  tx(nomeM, 40, 80, 46, "#1b1b1f", 800); tx("Escala 5x2 · " + P.map(p => p.n).join(" e "), 40, 132, 26, "#6b6b73", 600);
  P.forEach((p, i) => { const x0 = 40, y0 = 175 + i * 210, col = p.k === "r" ? "#e0a030" : "#3fb6c4"; rr(x0, y0, 430, 190, 22, p.k === "r" ? "#fcf3df" : "#e4f5f7", col);
    g.save(); g.beginPath(); g.arc(x0 + 92, y0 + 95, 66, 0, 7); g.clip(); if (imgs[i]) g.drawImage(imgs[i], x0 + 26, y0 + 29, 132, 132); else { g.fillStyle = col; g.fillRect(x0 + 26, y0 + 29, 132, 132); } g.restore();
    if (!imgs[i]) tx((p.n[0] || "?").toUpperCase(), x0 + 92, y0 + 97, 70, "#1b1b1f", 800, "center");
    tx(p.n, x0 + 176, y0 + 52, 44, "#1b1b1f", 800); if (p.full) tx(p.full.length > 20 ? p.full.slice(0, 19) + "…" : p.full, x0 + 176, y0 + 92, 21, "#6b6b73", 600); tx(escHm(p.ent) + "–" + escHm(escSai(p, c)), x0 + 176, y0 + (p.full ? 142 : 115), 40, "#1b1b1f", 800); });
  tx(`${escH(c.dia)} por dia · ${c.int} min de intervalo`, 40, 620, 24, "#4a4a52", 700); tx(`Meta de ${escH(c.meta)} por semana`, 40, 656, 24, "#4a4a52", 700);
  tx("Cor = trabalha · cinza «folga»", 40, 710, 21, "#6b6b73", 600); tx("Linha vermelha = os dois folgam", 40, 740, 21, "#6b6b73", 600); tx("★ feriado · ☆ facultativo", 40, 770, 21, "#6b6b73", 600); tx("Valida+", 40, 850, 22, "#b0aca0", 700);
  const ds = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], Y0 = 60, areaH = H - Y0 - 70, n = Math.max(1, semanas.length), RG = 8, CH = Math.min(170, (areaH - 40 - (n - 1) * RG) / n), PH = Math.min(46, (CH - 50) / 2 - 3);
  ds.forEach((t, i) => tx(t, GX + i * CW + CW / 2, Y0 + 20, 26, "#6b6b73", 800, "center"));
  semanas.forEach((w0, row) => { for (let i = 0; i < 7; i++) { const d = new Date(w0.getFullYear(), w0.getMonth(), w0.getDate() + i), x0 = GX + i * CW + 3, y0 = Y0 + 44 + row * (CH + RG), fora = d.getMonth() !== m, ss = P.map(p => escSt(p.k, d, c)), vazio = d >= iniD && ss.every(v => v === "F" || v === "FE"), fer = ESC_FER[escKey(d)], fac = fer && fer.t === "f";
    g.globalAlpha = fora ? .35 : 1; rr(x0, y0, CW - 6, CH, 14, fer ? (fac ? "#fbf3d8" : "#fbe7e5") : "#f1eee3", vazio && !fora ? "#e5484d" : fer ? (fac ? "#c9a227" : "#d64545") : null); tx(String(d.getDate()), x0 + 14, y0 + 22, 26, "#1b1b1f", 800);
    if (fer) tx(fac ? "☆" : "★", x0 + CW - 22, y0 + 22, 24, fac ? "#b98600" : "#d64545", 800, "center");
    if (!ss.every(v => v === "-")) P.forEach((p, q) => { const yy = y0 + 42 + q * (PH + 5), st = ss[q], tw = st === "T", col = p.k === "r" ? "#e0a030" : "#3fb6c4";
      rr(x0 + 8, yy, CW - 22, PH, 10, st === "-" ? "#e4e1d6" : tw ? col : st === "FE" ? "#cddcff" : "#d3d0c6"); if (!tw && st !== "-") { g.fillStyle = col; g.fillRect(x0 + 8, yy + 4, 6, PH - 8); }
      tx(tw ? (p.n[0] || "?").toUpperCase() : st === "FE" ? "férias" : st === "-" ? "–" : "folga", x0 + 8 + (CW - 22) / 2 + (tw || st === "-" ? 0 : 3), yy + PH / 2 + 1, tw ? 28 : 24, tw ? "#1d1400" : "#4a4a52", 800, "center"); });
    g.globalAlpha = 1; } });
  return cv;
}
async function escTelaCheia(on) {   // modo painel do próprio app (sem a tela cheia do navegador, que mostra um aviso no rodapé); só mantém a tela acesa
  escFull = on; escPaint();
  try { if (on) { if (navigator.wakeLock) escWake = await navigator.wakeLock.request("screen"); } else if (escWake) { await escWake.release(); escWake = null; } } catch (e) { /* sem wake lock: segue normal */ }
}
async function escCompartilha() {
  toast("Gerando a imagem…"); const cv = await escImagem(), { y, m } = escMes, nome = `escala-${y}-${String(m + 1).padStart(2, "0")}.png`;
  cv.toBlob(async b => { if (!b) return toast("Não consegui gerar a imagem."); const f = new File([b], nome, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: "Escala 5x2", text: "Escala 5x2 · " + new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast("Imagem salva. Envie pelo WhatsApp."); }, "image/png");
}
function escAbrir() {
  logAcesso("Escala 5x2");
  let v = $("escV"); if (!v) { v = document.createElement("div"); v.id = "escV"; v.className = "escv"; document.body.appendChild(v);
    v.onclick = e => { const t = e.target.closest("[data-ek]"), mn = e.target.closest("[data-em]"), ev = e.target.closest("[data-ev]"), fx = e.target.closest("[data-efix]"), ok = e.target.closest("[data-eok]");
      if (ok) { const k = ok.dataset.eok === "desfaz" ? (escMes.y + "-" + String(escMes.m + 1).padStart(2, "0")) : ok.dataset.eok; if (ok.dataset.eok === "desfaz") delete escOk[k]; else escOk[k] = ok.dataset.sig; escSalva(); escPaint(); return toast(ok.dataset.eok === "desfaz" ? "Voltou a avisar." : "Combinado: não aviso mais neste mês."); }
      if (ev) { escVista = ev.dataset.ev; store.set("validamais-escala-vista", escVista); return escPaint(); }
      if (fx) return escFixAbrir(fx.dataset.efix);
      if (e.target.closest("#escCfgB")) return escCfgAbrir();
      if (e.target.closest("#escSh")) return escCompartilha();
      if (e.target.closest("#escFs")) return escTelaCheia(true);
      if (e.target.closest("#escFx")) return escTelaCheia(false);
      if (t) return escToca(t.dataset.ep, t.dataset.ek, t);
      if (mn) { escDir = Number(mn.dataset.em) > 0 ? 1 : -1; escMes = new Date(escMes.y, escMes.m + Number(mn.dataset.em), 1); escMes = { y: escMes.getFullYear(), m: escMes.getMonth() }; return escPaint(); }
      if (e.target.closest("#escX")) { if (PERFIL === "BENASSI") perfilEscolher(true); else v.remove(); } }; }
  document.body.classList.add("escOn"); escPaint();
}
if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "escala"), sn => { escO = (sn.exists() && sn.data().o) || {}; escCr = (sn.exists() && sn.data().cfg) || null; escOk = (sn.exists() && sn.data().ok) || {}; store.set("validamais-escala-ok", escOk); store.set(ESC_K, escO); store.set(ESC_CK, escCr); escPaint(); }, e => console.warn("escala", e)); } catch (e) { console.warn(e); } }
const escNome = () => /benassi/i.test(myName());   // quem se identificou como BENASSI também enxerga a escala (só leitura)
if (escNome()) document.body.dataset.esc = "1";
$("mnEscala").onclick = () => { if ($("moreMenu")) { $("moreMenu").classList.add("hidden"); $("moreBg").classList.add("hidden"); } escAbrir(); };
// ---------- atalhos do ícone (segurar o ícone do app): ?acao=bipar | hoje ----------
$("acaoX").onclick = () => { acaoF = ""; render(); };
$("novoBtn").onclick = () => { novoF = true; render(); window.scrollTo(0, 0); };   // «🆕 Últimos lançados»
$("novoBar").onclick = () => { novoF = false; render(); };   // v464: tocar em qualquer parte do balão volta ao normal (o botão «Ver tudo» faz o mesmo)
$("novoBar").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("novoBar").click(); } };
function acaoRoda(a) {
  if (a === "bipar") { $("fab").click(); }
  else if (a === "hoje") { if (curTab !== "Loja") tab("Loja"); acaoF = "hoje"; render(); window.scrollTo(0, 0); }
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
const ATV_ICO = { entrou: "🚪", cadastrou: "➕", editou: "✏️", retirou: "📦", devolveu: "↩️", removeu: "🗑️", "doação": "🎁", etiqueta: "🏷️", acessou: "👁️", importou: "📥", oferta: "🔥", erro: "🐞" };
const ATV_VERBO = { entrou: "entrou no app", cadastrou: "cadastrou", editou: "editou", retirou: "retirou da loja", devolveu: "devolveu à loja", removeu: "removeu", "doação": "fez doação", etiqueta: "lançou etiqueta", acessou: "acessou", importou: "importou", oferta: "criou oferta", erro: "reportou um erro" };
let atvUn = null;
function atvAbrir() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "atvModal"; const q0 = x => bg.querySelector(x);
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Atividade dos usuários"><div class="sheethead"><h2>🕘 Atividade dos usuários</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <div class="atvf" id="atvF"></div><div id="atvSum" class="atvsum"></div><div id="atvL" class="atvl"><p class="note">Carregando…</p></div><button type="button" class="secondary atvlimpa" id="atvLimpa">🗑️ Limpar histórico</button></section>`;
  document.body.appendChild(bg);
  let dados = [], buscas = [], refs = [], filtro = "", pessoa = "", corte = store.get("validamais-atv-corte", null) || { t: 0, manter: false };
  const hm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), dia = t => { const d = new Date(t), h = new Date(); h.setHours(0, 0, 0, 0); const ontem = new Date(h - 864e5); return d >= h ? "Hoje" : d >= ontem ? "Ontem" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };
  const mantem = r => r.a === "erro" || (r.a === "retirou" && r.motivo);   // erros e retiradas com motivo
  const escondido = r => r.t <= corte.t && !(corte.manter && mantem(r));
  const desenha = () => {
    const nomes = [...new Set(dados.filter(r => r.a !== "erro").map(r => r.quem))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    bg.querySelector("#atvF").innerHTML = `<label class="atvp"><select id="atvPes" aria-label="Pessoa"><option value="">Todas as pessoas</option>${nomes.map(n => `<option value="${esc(n)}"${n === pessoa ? " selected" : ""}>${esc(semAdmin(n))}</option>`).join("")}</select></label><button type="button" class="atvmais${filtro === "@tudo" ? " on" : ""}" data-n="${filtro === "@tudo" ? "" : "@tudo"}" aria-pressed="${filtro === "@tudo"}">Entradas e telas</button>`;   // v493: básico — só ações; entradas e telas ficam atrás deste botão
    bg.querySelector("#atvLimpa").classList.remove("hidden");
    const l = dados.filter(r => r.a !== "erro" && (filtro === "@tudo" || (r.a !== "acessou" && r.a !== "entrou")) && (!pessoa || r.quem === pessoa)).sort((a, b) => b.t - a.t), hj = new Date(); hj.setHours(0, 0, 0, 0);
    const res = {}; dados.filter(r => r.t >= hj).forEach(r => { const o = res[r.quem] || (res[r.quem] = { ent: 0, n: 0, ult: 0 }); if (r.a === "entrou") { if (!o.ent || r.t < o.ent) o.ent = r.t; } else o.n++; o.ult = Math.max(o.ult, r.t); });
    bg.querySelector("#atvSum").innerHTML = Object.keys(res).length ? "<b>Hoje</b>" + Object.entries(res).sort((x, y) => y[1].ult - x[1].ult).filter(([n]) => !pessoa || n === pessoa).map(([n, o]) => `<div><span>${esc(semAdmin(n))}</span><small>${o.ent ? hm(o.ent) + " – " : "até "}${hm(o.ult)}${o.n ? " · " + o.n + (o.n === 1 ? " ação" : " ações") : ""}</small></div>`).join("") : "";
    let ult = "";
    const gp = {}, l2 = [];   // várias "entrou no app" da mesma pessoa no mesmo dia viram uma linha só
    l.forEach(r => { if (r.a !== "entrou") { l2.push(r); return; } const k = r.quem + "|" + dia(r.t), g = gp[k]; if (g) { g.n++; g.prim = Math.min(g.prim, r.t); } else { const c = { ...r, n: 1, prim: r.t }; gp[k] = c; l2.push(c); } });
    bg.querySelector("#atvL").innerHTML = l2.length ? l2.map(r => { const d = dia(r.t), h = d !== ult ? `<div class="atvd">${esc(d)}</div>` : ""; ult = d;
      return h + `<div class="atvr${r.a === "entrou" ? " ent" : ""}"><time>${hm(r.t)}</time><div><b>${esc(semAdmin(r.quem))}</b> ${ATV_ICO[r.a] || "•"} ${esc(ATV_VERBO[r.a] || r.a)}${r.n > 1 ? ` <small>${r.n}× no dia · 1ª às ${hm(r.prim)}</small>` : ""}${r.a === "erro" ? `<span class="atverr"><b>${esc(r.cat || "")}</b> ${esc(r.txt || "")}<small>${esc(r.ctx || "")}</small></span>` : r.txt && r.a !== "entrou" ? `<small>${esc(r.txt)}</small>` : ""}</div></div>`; }).join("") : '<p class="note">Nenhuma ação registrada.</p>';
  };
  const fecha = () => { try { atvUn && atvUn(); } catch (e) {} atvUn = null; bg.remove(); };
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) fecha(); const b = e.target.closest("[data-n]"); if (b) { filtro = b.dataset.n; desenha(); } };
  bg.onchange = e => { if (e.target.id === "atvPes") { pessoa = e.target.value; desenha(); } };
  if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", "atividade"), sn => { if (sn.exists() && sn.data().t) { const c = { t: Number(sn.data().t) || 0, manter: !!sn.data().manter }; if (c.t > corte.t) { corte = c; store.set("validamais-atv-corte", c); dados = dados.filter(r => !escondido(r)); desenha(); } } }, () => {}); } catch (e) { console.warn(e); } }
  q0("#atvLimpa").onclick = async () => {
    const ok = await askConfirm({ icon: "🗑️", title: "Limpar histórico", subtitle: "O que apagar?", motivos: ["Só entradas e ações", "Tudo, até erros"], motivo: "Só entradas e ações", ok: "Limpar", cancel: "Cancelar" }); if (ok !== true) return;
    const tudo = window.vmMotivo === "Tudo, até erros", agora = Date.now(); let falhou = 0, n = 0;
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
// ---------- notificações de vencimento (cada pessoa liga e escolhe quantos dias antes quer ser avisada) ----------
const NTK = "validamais-notif";
const NOTIF_DIAS_PER = 3;   // Perecíveis: avisa o que vence em até 3 dias (e o que já venceu)
const NOTIF_HORA = 8;   // avisa todos os dias (seg a dom) a partir das 08h
const notifSuporte = () => "Notification" in window && "serviceWorker" in navigator;
const notifCfg = () => { const c = store.get(NTK, null) || {}; if (PERFIL === PER) return { on: true, dias: NOTIF_DIAS_PER, setores: [PER], ultimo: c.ultimo || "" };   // Perecíveis: aviso obrigatório, sem opções (sempre ligado, 3 dias, 08h)
  return { on: !!c.on, dias: Number(c.dias) > 0 ? Number(c.dias) : (PERFIL === PER ? 7 : 2), setores: c.setores || (PERFIL === PER ? [PER] : PERFIL === "FLV" ? ["FLV"] : ["FLV", PER]), ultimo: c.ultimo || "" }; };
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
// Perecíveis: ao abrir o app o navegador pede a permissão (uma vez por abertura) e o aviso diário das 08h fica ligado, sem opção de desligar
async function notifPerObrig(gesto) {
  try { if (PERFIL !== PER || !notifSuporte()) return;
    if (Notification.permission === "default" && (gesto || !sessionStorage.getItem("vm-notif-pedido"))) {
      sessionStorage.setItem("vm-notif-pedido", "1");
      try { await Notification.requestPermission(); } catch (e) { console.warn(e); }
      if (Notification.permission === "default" && !gesto) {   // o navegador (ex.: iPhone) só pergunta depois de um toque: pergunta no primeiro toque
        const um = () => { document.removeEventListener("pointerup", um, true); notifPerObrig(true); }; document.addEventListener("pointerup", um, true); } }
    if (Notification.permission === "granted") { await notifSalva(notifCfg()); notifVerifica(); } } catch (e) { console.warn(e); }
}
setTimeout(notifPerObrig, 1500);
function notifAbrirPer() {
  const bg = document.createElement("div"); bg.className = "modal"; bg.id = "notifModal";
  const sup = notifSuporte(), perm = sup ? Notification.permission : "unsupported";
  const est = !sup ? "Este navegador não permite notificações." : perm === "granted" ? "✓ Ativado neste aparelho." : perm === "denied" ? "As notificações estão bloqueadas. Libere nas configurações do celular (Configurações → Apps → Valida+/Chrome → Notificações)." : "Falta permitir as notificações neste aparelho.";
  bg.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="Notificações"><div class="sheethead"><h2>🔔 Aviso diário</h2><button type="button" class="secondary" data-x aria-label="Fechar">✕</button></div>
    <p class="note" id="nfEst">${esc(est)}</p>
    <p class="note"><b>Todos os dias, às 08h</b>, o app avisa os produtos dos Perecíveis que vencem em até <b>${NOTIF_DIAS_PER} dias</b> (e os já vencidos). Este aviso é obrigatório neste perfil.</p>
    ${sup && perm === "default" ? '<button type="button" class="primary big" id="nfPerm">Permitir notificações</button>' : ""}
    <button type="button" class="secondary big" id="nfTeste" style="margin-top:8px" ${!sup || perm !== "granted" ? "disabled" : ""}>Testar agora</button>
    <p class="note" style="margin-top:12px">No <b>Android</b>, com o app instalado na tela inicial, o aviso chega mesmo com o app fechado (o horário exato quem decide é o Android, então pode chegar alguns minutos ou horas depois das 08h). No <b>iPhone</b> o aviso aparece quando você abre o app depois das 08h.</p></section>`;
  document.body.appendChild(bg);
  bg.onclick = e => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); };
  const pm = bg.querySelector("#nfPerm"); if (pm) pm.onclick = async () => { await notifPerObrig(true); bg.remove(); notifAbrirPer(); };
  bg.querySelector("#nfTeste").onclick = async () => { const ok = await notifVerifica(true); if (ok) toast("Notificação enviada. Veja a barra do celular."); };
}
function notifAbrir() {
  if (PERFIL === PER) return notifAbrirPer();
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
const tabInicial = () => SETOR === PER ? "Loja" : "Doacao";
function trocaSetor(alvo) {   // troca FLV / Perecíveis sem recarregar a página
  if (alvo === SETOR || ![ "FLV", PER ].includes(alvo)) return;
  if (PERFIL !== "Admin" && alvo !== PERFIL) return;   // só o Admin troca de setor
  try { if (typeof stopScanner === "function") stopScanner(); closeModal(); } catch (e) {}
  const todos = db ? rawAll : products.concat(lixeira, outros);   // todos os cadastros, de todos os setores
  if (SETOR === "FLV") etqFlv = labels;
  SETOR = alvo; try { sessionStorage.setItem("validamais-setor", alvo); if (PERFIL === "Admin") localStorage.setItem("validamais-setor-adm", alvo); } catch (e) {}
  derivaSetor(); separaLixo(todos); lixoBtn();
  DK = chaveSetor("validamais-doacao"); don = store.get(DK, null) || { itens: [], inicio: new Date().toISOString() }; dSel = ""; dVal = "";
  EK = chaveSetor(EK_FLV); EHK = chaveSetor("validamais-etqhist");
  labels = alvo === "FLV" ? (etqFlv || store.get(EK_FLV, [])) : store.get(EK, []); pend = null; eHits = []; eFiltro = "";
  ["search", "cBusca", "eBusca", "dBusca"].forEach(i => { const e = $(i); if (e) e.value = ""; }); $("eRes").innerHTML = "";
  cFiltro = ""; retView = false; $("statusFilter").value = "";
  fillCategories(); $("categoryFilter").dataset.sig = ""; $("categoryFilter").value = CATSET; store.set(LC, CATSET);
  cadReset();
  pintaSetor(); rotulosSetor();
  render(); cadPaint(); renderDon(); renderLabels();
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
function etqFoto(l) {   // v501: no FLV cada etiqueta da lista mostra a foto do produto (foto exata ou da mesma família)
  if (SETOR !== "FLV" || !iconesOn()) return "";
  const d = balFoto(l.nome);
  return `<span class="elead">${d ? `<img class="ico-img" src="${d}" alt="" decoding="async">` : icoVazio()}</span>`; }
function renderLabels() {
  etqFixEan();
  $("eLimpa").classList.toggle("hidden", labels.length <= 5); { const n = labels.filter(l => l.ok).length; $("eMarc").textContent = labels.length ? `✓ ${n} de ${labels.length} já colocadas para impressão` : ""; } $("eSumP").textContent = labels.length; $("eSumQ").textContent = labels.reduce((s, l) => s + (Number(l.qtd) || 0), 0);
  const mapaE = codMapa(), infoE = labels.map(l => ({ rev: revOn(l.nome), dup: dupLabel(l, mapaE) }));
  filtBar($("eFilt"), eFiltro, infoE.filter(o => o.rev).length, infoE.filter(o => o.dup.length).length);
  const ord = { P: 0, M: 1, G: 2 };   // lista única: primeiro os P, depois M, depois G (mantém a ordem de inclusão dentro de cada tamanho)
  $("eLista").innerHTML = labels.length ? labels.map((l, i) => ({ l, i })).sort((a, b) => (ord[a.l.tam || "M"] - ord[b.l.tam || "M"]) || (a.i - b.i)).filter(({ i }) => !eFiltro || (eFiltro === "rev" ? infoE[i].rev : infoE[i].dup.length)).map(({ l, i }) => `<div class="crwrap"><div class="crw${l.ok ? " done" : ""}${infoE[i].rev ? " rv" : ""}" data-li="${i}"><button type="button" class="lchk" data-lchk="${i}" role="checkbox" aria-checked="${l.ok ? "true" : "false"}" aria-label="Já colocada para impressão: ${esc(l.nome)}">${l.ok ? "✓" : ""}</button>${etqFoto(l)}<div class="crl"><div class="ccode${(l.code || "").length > 14 ? " long" : ""}">${l.code ? esc(l.code) : "SEM CÓDIGO"}${l.orig && l.orig !== l.code ? ` <span class="unib">unificado</span>` : ""}${infoE[i].rev ? ` <span class="rvtag">🚩 revisar</span>` : ""}${infoE[i].dup.length ? ` <span class="duptag" data-dupi="${i}">⚠ repetido</span>` : ""}</div><div class="cname">${esc(l.nome)}</div>${SETOR === "FLV" ? `<div class="ctam"><span class="tbadge">${(l.tam || "P") === "P" ? "P serrilhado" : l.tam}</span></div>` : ""}</div><div class="crr"><div class="cqty">${l.qtd}${SETOR !== "FLV" && (l.tam || "M") !== "M" ? `<span class="tbadge">${l.tam}</span>` : ""}</div></div><button type="button" class="crx" data-ldrop="${i}" aria-label="Remover etiqueta: ${esc(l.nome)}">✕</button></div></div>`).join("") : '<p class="empty">Nenhum item na lista.</p>';
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

// ---------- aba Pesáveis (Perecíveis): consulta pelo nome, com o PLU e o código interno à vista ----------
function pesaveis() {   // inclui quem só tem código interno, porque alguns produtos são consultados por ele
  return products.filter(p => !p.retirado && p.category === PER && (p.codigo_balanca || p.codigo_doacao || (/^\d+$/.test(String(p.barcode || "")) && String(p.barcode).length < 8)));
}
// busca inteligente: ignora acento e maiúscula, aceita várias palavras em qualquer ordem, início de palavra, trecho do PLU/código interno/EAN (começo, fim ou meio), pequenos erros de digitação e as abreviações do cadastro (QJ → queijo, MUSS → mussarela, PC → peça…)
function pesBusca(all, qraw) {
  const q = norm(qraw).trim(); if (!q) return { rows: all, toks: [] };
  const toks = q.split(/\s+/).filter(Boolean), sc = [];
  all.forEach(p => {
    const nm = norm(p.name || ""), pal = nm.split(/[^a-z0-9]+/).filter(Boolean);
    const cpal = [...new Set(pal.map(pesCanon))], cods = [p.codigo_balanca, p.codigo_doacao, p.barcode].map(c => norm(String(c || "")));
    let total = 0, ok = true;
    for (const t of toks) {
      let s = 0;
      for (const c of cods) { if (!c) continue; if (c === t) s = Math.max(s, 100); else if (/^\d+$/.test(t)) { if (c.startsWith(t)) s = Math.max(s, 70); else if (c.endsWith(t)) s = Math.max(s, 60); else if (c.includes(t)) s = Math.max(s, 40); } }
      if (!s) { const ct = pesCanon(t);   // “queijo” também acha “QJ”, “mussarela” acha “MUSS”, “peça” acha “PC”
        if (cpal.includes(ct)) s = 80; else if (cpal.some(w => w.startsWith(ct))) s = 70; else if (ct.length >= 3 && cpal.some(w => w.includes(ct))) s = 50;
        else if (nm.includes(t)) s = 45;
        else if (t.length >= 4 && !/^\d+$/.test(t)) { if (cpal.some(w => lev(w, ct) <= (ct.length >= 7 ? 2 : 1))) s = 25; else if (cpal.some(w => lev(w.slice(0, ct.length), ct) <= 1)) s = 18; } }
      if (!s) { ok = false; break; } total += s;
    }
    if (ok) sc.push({ p, s: total / toks.length + (nm.startsWith(q) ? 20 : 0) });
  });
  sc.sort((a, b) => b.s - a.s || String(a.p.name || "").localeCompare(String(b.p.name || ""), "pt-BR", { sensitivity: "base" }));
  return { rows: sc.map(x => x.p), toks };
}
function pesHl(name, toks) {   // destaca no nome o que foi digitado — inclusive a abreviação (“queijo” acende “QJ”)
  name = String(name || ""); const nm = norm(name); if (!toks.length || nm.length !== name.length) return esc(name);
  const mk = new Array(name.length).fill(false), marca = (i, n) => { for (let k = i; k < i + n; k++) mk[k] = true; };
  toks.forEach(t => {
    if (/^\d+$/.test(t)) return;
    const ct = pesCanon(t), i = nm.indexOf(t);
    if (i >= 0) marca(i, t.length);
    else { const re = /[a-z0-9]+/g; let m; while ((m = re.exec(nm))) { const w = pesCanon(m[0]); if (w === ct || (ct.length >= 3 && w.startsWith(ct))) marca(m.index, m[0].length); } }
  });
  let out = "", open = false; for (let i = 0; i < name.length; i++) { if (mk[i] && !open) { out += "<mark>"; open = true; } if (!mk[i] && open) { out += "</mark>"; open = false; } out += esc(name[i]); } return out + (open ? "</mark>" : "");
}
function renderPesaveis() {
  const box = $("pesLista"); if (!box) return;
  const inp = $("pesBusca"), termo = (inp || {}).value || "", q = norm(termo).trim();
  const todos = pesaveis().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" }));
  const base = todos, { rows, toks } = pesBusca(base, termo);
  if ($("pesInfo")) $("pesInfo").textContent = q ? `${rows.length} de ${todos.length} pesáveis` : `${todos.length} pesáveis`;
  const linha = p => {
    const plu = p.codigo_balanca || "", itn = p.codigo_doacao || "";
    const bc = String(p.barcode || ""), esq = plu ? `<span class="pesc plu"><i>PLU</i><b>${esc(plu)}</b></span>` : bc ? `<span class="pesc cod"><i>CÓD</i><b>${esc(bc)}</b></span>` : `<span class="pesc plu vz"><i>PLU</i><b>—</b></span>`;
    const cods = esq + `<span class="pesc itn${itn ? "" : " vz"}"><i>INTERNO</i><b>${itn ? esc(itn) : "—"}</b></span>`;
    const etq = !!labelCode(p).code, lead = icoHtml(p);
    return `<div class="pesrow${pesOpen === p.id ? " open" : ""}" data-pes="${esc(p.id)}"><div class="pes-main">${lead ? `<span class="pes-lead">${lead}</span>` : ""}<div class="pesn"><div class="pesl"><b class="pesnome">${pesHl(p.name, toks)}</b></div><span class="pescods">${cods}</span></div></div><div class="pesact">${etq ? `<button type="button" class="pesb primary" data-etq="${esc(p.id)}">${ico("etq")}Lançar etiqueta</button>` : ""}<button type="button" class="pesb secondary" data-pedit="${esc(p.id)}">${ico("lapis")}Editar</button></div></div>`;
  };
  if (!rows.length) box.innerHTML = `<div class="pesvazio"><b>${q ? "Nada encontrado." : "Nenhum pesável por aqui."}</b>${q ? "Tente outro nome ou código." : "Cadastre em Perecíveis um produto com código de balança ou código interno curto para ele aparecer aqui."}</div>`;
  else if (q) box.innerHTML = rows.map(linha).join("");   // buscando: lista direta, sem grupos
  else {   // v465: agrupa pela 1ª palavra do nome (BACON, QUEIJO…); grupos de 1 item vão para «Outros»; abre sempre recolhido
    const gs = pesAgrupa(rows);
    box.innerHTML = gs.map(([w, l]) => { const ab = pesAb.has(w); return `<div class="pgh gp${ab ? "" : " rec"}" data-g="${esc(w)}" role="button" tabindex="0" aria-expanded="${ab}"><span>${esc(w)}</span><i>${l.length}</i><em class="pgc" aria-hidden="true"></em></div>` + (ab ? l.map(linha).join("") : ""); }).join("");
  }
}
// ----- buscas dos Pesáveis: histórico de cada usuário («na conta», vale em qualquer aparelho) + os mais pesquisados -----
const PES_SUG0 = ["mussarela", "minas", "bacon", "salame", "fracionado", "parmesão"];   // só enquanto o histórico ainda é pequeno
let pesHist = [], pesHKey = "", pesHTimer = 0, pesHSnap = false;   // [[termo, vezes, última]]
let pesGlob = [], pesGlobOuvindo = false;   // [[termo, vezes]] — buscas de TODOS os usuários (sh_cfg/pbh-global)
const pesGK = t => norm(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
function pesGlobOuve() {
  if (pesGlobOuvindo || !db) return; pesGlobOuvindo = true;
  try { V.onSnapshot(V.doc(db, "sh_cfg", "pbh-global"), sn => { const t = (sn.exists() && sn.data().t) || {};
      pesGlob = Object.entries(t).filter(([, o]) => o && o.w && o.n > 0).map(([k, o]) => [o.w, o.n, k]).sort((a, b) => b[1] - a[1]); pesSugRender(); }, e => { console.warn("buscas", e); pesGlobOuvindo = false; }); } catch (e) { console.warn(e); pesGlobOuvindo = false; }
}
function pesGlobSoma(t) {   // soma 1 na busca geral (todos os usuários); termos novos param de entrar se o documento já tem muitos
  if (!db) return; const k = pesGK(t); if (!k || k.length < 3) return; if (pesGlob.length > 300 && !pesGlob.some(x => x[2] === k)) return;
  try { V.setDoc(V.doc(db, "sh_cfg", "pbh-global"), { t: { [k]: { n: V.increment(1), w: t.slice(0, 40), u: Date.now() } } }, { merge: true }).catch(e => console.warn("buscas", e)); } catch (e) { console.warn(e); }
}
const pesHId = () => "pbh-" + icKey(myName());
function pesHCarrega() {
  const id = pesHId(); if (id === pesHKey) return; pesHKey = id; pesHSnap = false;
  pesHist = (store.get("validamais-" + id, []) || []).filter(x => Array.isArray(x) && x[0]);
  if (db) { try { V.onSnapshot(V.doc(db, "sh_cfg", id), sn => { if (id !== pesHKey || !sn.exists()) return; const l = sn.data().l; if (!Array.isArray(l)) return;
      const m = new Map(); [...pesHist, ...l].forEach(x => { const k = norm(x[0]); const o = m.get(k); if (!o) m.set(k, [x[0], x[1] || 1, x[2] || 0]); else { o[1] = Math.max(o[1], x[1] || 1); o[2] = Math.max(o[2], x[2] || 0); } });   // junta o que está no aparelho com o da nuvem
      pesHist = [...m.values()].sort((a, b) => b[2] - a[2]).slice(0, 60); store.set("validamais-" + id, pesHist); pesSugRender(); }, () => {}); } catch (e) { console.warn(e); } }
}
function pesHSalva() { store.set("validamais-" + pesHId(), pesHist); clearTimeout(pesHTimer); if (db) pesHTimer = setTimeout(() => { try { V.setDoc(V.doc(db, "sh_cfg", pesHId()), { l: pesHist, em: Date.now(), n: myName().slice(0, 40) }).catch(() => {}); } catch (e) {} }, 1500); }
function pesHRegistra(termo) {
  const t = String(termo || "").trim().toLowerCase(); if (norm(t).length < 3) return; pesHCarrega();
  const k = norm(t), o = pesHist.find(x => norm(x[0]) === k);
  // a mesma busca em sequência (abrir o resultado + sair do campo) conta uma vez só
  if (o) { if (Date.now() - o[2] > 30000) { o[1]++; pesGlobSoma(t); } o[2] = Date.now(); o[0] = t; } else { pesGlobSoma(t); pesHist.unshift([t, 1, Date.now()]); if (pesHist.length > 60) { pesHist.sort((a, b) => b[1] - a[1] || b[2] - a[2]); pesHist.length = 60; } }
  pesHist.sort((a, b) => b[2] - a[2]); pesHSalva();
}
function pesSugRender() {
  const box = $("pesSug"), inp = $("pesBusca"); if (!box || !inp) return;
  if (inp.value.trim() || document.activeElement !== inp) { box.classList.add("hidden"); return; }
  pesHCarrega();
  const rec = [...pesHist].sort((a, b) => b[2] - a[2]).slice(0, 8);
  pesGlobOuve();
  const top = (db ? pesGlob.filter(x => x[1] >= 2).slice(0, 6).map(x => [x[0], x[1], x[2]]) : [...pesHist].filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 6).map(x => [x[0], x[1]]));
  const tem = new Set(top.map(x => norm(x[0]))); PES_SUG0.forEach(w => { if (top.length < 6 && !tem.has(norm(w))) { top.push([w, 0]); tem.add(norm(w)); } });
  const chip = (t, extra) => `<button type="button" class="pschip" data-pst="${esc(t)}">${esc(t)}${extra || ""}</button>`;
  const adm = PERFIL === "Admin" && db;   // o Admin pode tirar uma busca sem sentido (ex.: teclou errado) da lista geral
  box.innerHTML = `<div class="pssec"><b>🔥 Mais pesquisados <small>(todos os usuários)</small></b><div class="pschips">${top.map(([t, n, k]) => adm && k ? `<span class="pschip2">${chip(t, ` <i>${n}×</i>`)}<button type="button" class="psx" data-psg="${esc(k)}" aria-label="Tirar ${esc(t)} da lista geral">×</button></span>` : chip(t, n ? ` <i>${n}×</i>` : "")).join("")}</div></div>` +
    (rec.length ? `<div class="pssec"><b>🕘 Suas últimas buscas</b><button type="button" class="pslimpa" data-psclr>limpar</button><div class="pschips">${rec.map(x => `<span class="pschip2">${chip(x[0])}<button type="button" class="psx" data-psx="${esc(x[0])}" aria-label="Apagar ${esc(x[0])}">×</button></span>`).join("")}</div></div>` : "");
  box.classList.remove("hidden");
}
const pesX = () => { $("pesX").classList.toggle("hidden", !$("pesBusca").value); $("pesMic").classList.toggle("hidden", !!$("pesBusca").value || !(window.SpeechRecognition || window.webkitSpeechRecognition)); };
$("pesBusca").oninput = () => { pesX(); renderPesaveis(); pesSugRender(); };
$("pesX").onclick = () => { const i = $("pesBusca"); i.value = ""; pesX(); renderPesaveis(); i.focus(); pesSugRender(); };   // v470: limpar com um toque e já voltar a digitar
$("pesMic").onclick = () => {   // v470: buscar falando
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return toast("Busca por voz não é suportada neste navegador.");
  const r = new R(); r.lang = "pt-BR"; r.interimResults = false; const b = $("pesMic");
  r.onresult = e => { const t = e.results[0][0].transcript.trim().replace(/[.!?]+$/, ""); $("pesBusca").value = t; pesX(); renderPesaveis(); if (t.length >= 3 && $("pesLista").querySelector("[data-pes]")) pesHRegistra(t); };
  r.onerror = e => toast(e.error === "not-allowed" ? "Permita o microfone para buscar falando." : "Não entendi, tente de novo.");
  r.onend = () => b.classList.remove("on"); b.classList.add("on"); toast("Fale o nome do produto…"); try { r.start(); } catch {} };
pesX();
$("pesBusca").onfocus = pesSugRender;
$("pesBusca").onblur = () => { const v = $("pesBusca").value; setTimeout(() => { $("pesSug").classList.add("hidden"); if (v.trim().length >= 3 && $("pesLista").querySelector("[data-pes]")) pesHRegistra(v); }, 200); };
$("pesBusca").onkeydown = e => { if (e.key === "Enter") { pesHRegistra($("pesBusca").value); $("pesBusca").blur(); } };
$("pesSug").onpointerdown = e => e.preventDefault();   // não deixa a caixa de busca perder o foco antes do toque
$("pesSug").onclick = e => {
  const x = e.target.closest("[data-psx]"); if (x) { const k = norm(x.dataset.psx); pesHist = pesHist.filter(h => norm(h[0]) !== k); pesHSalva(); pesSugRender(); return; }
  const g = e.target.closest("[data-psg]"); if (g) { const k = g.dataset.psg; pesGlob = pesGlob.filter(x => x[2] !== k); pesSugRender(); try { V.updateDoc(V.doc(db, "sh_cfg", "pbh-global"), { ["t." + k]: V.deleteField() }).catch(e => console.warn(e)); } catch (e) {} return; }
  if (e.target.closest("[data-psclr]")) { pesHist = []; pesHSalva(); pesSugRender(); return; }
  const c = e.target.closest("[data-pst]"); if (c) { const inp = $("pesBusca"); inp.value = c.dataset.pst; pesHRegistra(c.dataset.pst); renderPesaveis(); pesSugRender(); inp.blur(); }
};
$("pesLista").onclick = e => {
  const gh = e.target.closest(".pgh[data-g]"); if (gh) { const w = gh.dataset.g; pesAb.has(w) ? pesAb.delete(w) : pesAb.add(w); const y = window.scrollY; renderPesaveis(); window.scrollTo(0, y); return; }
  
  const b = e.target.closest("[data-etq]"); if (b) { const p = products.find(x => x.id === b.dataset.etq); if (p) labelPick(p); return; }
  const ed = e.target.closest("[data-pedit]"); if (ed) { edit(ed.dataset.pedit); return; }
  const r = e.target.closest("[data-pes]"); if (r) { if (pesOpen !== r.dataset.pes) pesHRegistra($("pesBusca").value); pesOpen = pesOpen === r.dataset.pes ? "" : r.dataset.pes; document.querySelectorAll("#pesLista .pesrow").forEach(x => x.classList.toggle("open", x.dataset.pes === pesOpen)); }
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
function lmDraw() { const l = labels[lmI]; if (!l) return; const flv = SETOR === "FLV"; document.querySelectorAll("#lmTam button").forEach(b => { b.classList.toggle("sel", b.dataset.t === (l.tam || (flv ? "P" : "M"))); if (b.dataset.t === "P") b.textContent = flv ? "P serrilhado" : "P"; }); $("lmQtd").value = l.qtd; }
function lmOpen(i) { const l = labels[i]; if (!l) return; lmI = i; $("lmNome").textContent = l.nome; $("lmCod").textContent = (l.code ? (l.kg ? "Código de balança: " : "EAN: ") + l.code : "Sem código") + (dupLabel(l).length ? " · ⚠ " + dupTxt(dupLabel(l)) : ""); $("lmRev").textContent = revOn(l.nome) ? "🚩 Tirar a marca de revisar" : "🚩 Marcar para revisar"; lmDraw(); $("lModal").classList.remove("hidden"); if (navigator.vibrate) navigator.vibrate(40); }
const lmSave = () => { store.set(EK, labels); renderLabels(); };
$("lmTam").onclick = e => { const b = e.target.closest("button"); const l = labels[lmI]; if (!b || !l) return; l.tam = b.dataset.t; if (l.key && !l.dup && SETOR !== "FLV") { const m = store.get(TK, {}); m[l.key] = l.tam; store.set(TK, m); } lmSave(); lmDraw(); };
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
  { let vt = 0, vtm = 0;   // 10 toques seguidos na versão (rodapé) abrem a troca de perfil; toques espaçados > 2 s recomeçam a contagem
  $("appVer").onclick = () => { clearTimeout(vtm); vt++; vtm = setTimeout(() => { vt = 0; }, 2000);
    if (vt >= 10) { vt = 0; perfilEscolher(true, true); return; }
    if (vt <= 2) { toast("Versão " + APP_VERSION + " · verificando…"); check(); } }; }
})();
let deferred; const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
$("installBtn").onclick = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; } };
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("iosHint").classList.remove("hidden");
})();
