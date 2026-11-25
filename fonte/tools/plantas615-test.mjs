// Teste do setor Plantas v615/v617 (regador para iniciante; o envio de fotos ao WhatsApp foi removido na v617): uso  node plantas615-test.mjs <pasta dist> <pasta das capturas>
// Precisa do playwright-core (ex.: NODE_PATH=$(npm root -g)/playwright/node_modules). Firebase fica desligado (sem chave), tudo no localStorage.
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f) && !/ocr\//.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => { res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : "")); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2, permissions: [] });
await ctx.addInitScript(() => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Renato")); localStorage.setItem("validamais-perfil", "Admin"); sessionStorage.setItem("vm-notif-pedido", "1"); });
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e))); pg.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); }); pg.on("response", r => { if (r.status() === 404) errs.push("404 " + r.url().replace(/^http:\/\/localhost:\d+/, "")); });
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(3500);
const txt = () => pg.evaluate(() => document.getElementById("plV").innerText.replace(/\s+/g, " "));
const lista = () => pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-plantas") || "[]"));

await pg.click("#moreBtn"); await pg.waitForTimeout(300); await pg.click("#mnPlantas"); await pg.waitForTimeout(500);
if (await pg.$("[data-pseed]")) { await pg.click("[data-pseed]"); await pg.waitForTimeout(500); }   // sem nuvem a v614 já traz 6 espécies sozinha; senão semeia as da loja
// v614 também acrescenta 6 espécies sozinha quando é a 1ª abertura sem nuvem: só confere que há plantas
let L = await lista(); ok("há plantas cadastradas", L.length >= 6, String(L.length));
let t = await txt();
ok("Guia do dia: «Hoje: regar N plantas»", /Hoje: regar \d+ plantas?/.test(t), t.slice(0, 200));
ok("Guia fala do teste do dedo", /teste do dedo/i.test(t));
ok("cartão não repete a espécie quando não há apelido", await pg.evaluate(() => { const c = [...document.querySelectorAll("#plLista .pitem")]; return c.length > 0 && c.every(a => { const n = a.querySelector(".pi-nome").textContent.trim(), s = a.querySelector(".pi-sub"); return !s || s.textContent.trim() !== n; }); }));
ok("cartão mostra «Ainda não regada» e «Falta foto»", /Ainda não regada/.test(t) && /Falta foto/.test(t));
ok("cartão mostra a água de partida (1 copo / ½ copo…)", /1 copo \(200 ml\)|½ copo \(100 ml\)/.test(t));
ok("«Ainda úmida» aparece em planta para regar hoje", (await pg.$$("#plLista [data-pad]")).length > 0);
ok("Guia rápido do regador existe e começa fechado", await pg.evaluate(() => { const d = document.querySelector(".plreg"); return !!d && !d.open; }));
await pg.screenshot({ path: SHOT + "/p615_1_lista.png" });

// ---- Ainda úmida → amanhã; Desfazer volta ----
const idAd = await pg.evaluate(() => document.querySelector("#plLista [data-pad]").dataset.pad);
await pg.click(`[data-pad="${idAd}"]`); await pg.waitForTimeout(400);
L = await lista(); const pA = L.find(p => p.id === idAd);
ok("«Ainda úmida» grava adiada até amanhã", pA && pA.ad === ago(-1), JSON.stringify(pA));
ok("planta adiada vira AMANHÃ e mostra «Adiada: terra úmida»", await pg.evaluate(id => { const a = document.querySelector(`#plLista [data-pid="${id}"]`); return !!a && /AMANH/.test(a.querySelector(".pi-badge").textContent.toUpperCase()) && /Adiada: terra úmida/.test(a.innerText); }, idAd));
await pg.click("#toast button"); await pg.waitForTimeout(300);
L = await lista(); ok("Desfazer tira o adiamento", !(L.find(p => p.id === idAd) || {}).ad);

// ---- Reguei: histórico; retirar volta para a rega anterior ----
await pg.click(`[data-pr="${idAd}"]`); await pg.waitForTimeout(400);
L = await lista(); const pR = L.find(p => p.id === idAd);
ok("Reguei grava última rega e histórico", pR.u === ago(0) && (pR.h || []).includes(ago(0)), JSON.stringify(pR));
await pg.click(`#plLista [data-pid="${idAd}"] .pi-main`); await pg.waitForTimeout(300);
let det = await pg.evaluate(() => document.getElementById("plM").innerText.replace(/\s+/g, " "));
ok("detalhe: Como regar, teste do dedo/quantidade e botões novos", /Como regar/i.test(det) && /Dedo 2 cm|Só regue|Raízes|Mantenha|Encha|Regue/.test(det) && /Ainda úmida: adiar 1 dia/.test(det) && !/WhatsApp/.test(det), det.slice(0, 400));
await pg.evaluate(d => { const e = document.getElementById("plMdt"); e.value = d; }, ago(5)); await pg.click("#plMd"); await pg.waitForTimeout(400);
L = await lista(); const pH = L.find(p => p.id === idAd);
ok("«Regou em outro dia» entra no histórico e a última continua a mais recente", pH.h.length === 2 && pH.u === ago(0), JSON.stringify(pH.h));
await pg.click(`#plLista [data-pid="${idAd}"] .pi-main`); await pg.waitForTimeout(300); await pg.click("#plMun"); await pg.waitForTimeout(400);
L = await lista(); ok("Retirar rega volta para a rega anterior (5 dias atrás)", L.find(p => p.id === idAd).u === ago(5), JSON.stringify(L.find(p => p.id === idAd)));
await pg.click("#plMx"); await pg.waitForTimeout(200);

// ---- cadastro de planta nova com vaso, «Não sei», foto e «Cadastrar outra» ----
await pg.click("#plNew"); await pg.waitForTimeout(300);
ok("planta nova começa sem data de rega", (await pg.inputValue("#plU")) === "");
ok("aviso «Sem data» aparece", /Sem data/.test(await pg.evaluate(() => document.getElementById("plUn").textContent)));
await pg.fill("#plE", "Suculenta"); await pg.waitForTimeout(100);
ok("água de partida para vaso médio de suculenta = ½ copo (100 ml)", /½ copo \(100 ml\)/.test(await pg.evaluate(() => document.getElementById("plAn").textContent)), await pg.evaluate(() => document.getElementById("plAn").textContent));
await pg.click('[data-vs="G"]'); await pg.waitForTimeout(100);
ok("vaso grande de suculenta = 1 copo (200 ml)", /1 copo \(200 ml\)/.test(await pg.evaluate(() => document.getElementById("plAn").textContent)));
await pg.click('[data-qu="1"]'); await pg.waitForTimeout(100);
ok("«Ontem» preenche a data", (await pg.inputValue("#plU")) === ago(1));
await pg.setInputFiles("#plFi2", { name: "f.png", mimeType: "image/png", buffer: PNG }); await pg.waitForTimeout(600);
await pg.fill("#plLc", "Bancada 1");
await pg.screenshot({ path: SHOT + "/p615_2_form.png" });
await pg.click("#plMs"); await pg.waitForTimeout(500);
L = await lista(); const pN = L.find(p => p.e === "Suculenta");
ok("sem nada de WhatsApp na tela", !/WhatsApp/.test(await txt()));
ok("planta nova salva com vaso G, data de ontem, cadastrada hoje e histórico", pN && pN.v === "G" && pN.u === ago(1) && pN.c === ago(0) && pN.h && pN.h[0] === ago(1), JSON.stringify(pN && { v: pN.v, u: pN.u, c: pN.c, h: pN.h }));
ok("aviso de salvo traz «Cadastrar outra»", await pg.evaluate(() => /Cadastrar outra/.test(document.getElementById("toast").innerText)));
await pg.click("#toast button"); await pg.waitForTimeout(400);
ok("«Cadastrar outra» abre o formulário limpo", await pg.evaluate(() => !!document.getElementById("plE") && document.getElementById("plE").value === ""));
await pg.click("#plMx"); await pg.waitForTimeout(200);

// ---- visual: tema claro ----
await pg.evaluate(() => document.documentElement.setAttribute("data-tema", "light")); await pg.waitForTimeout(300);
await pg.evaluate(() => { document.querySelector(".plreg").open = true; });
await pg.screenshot({ path: SHOT + "/p615_6_claro.png" });
// sobreposição: a foto de um cartão não pode cobrir o botão do cartão de cima
const sob = await pg.evaluate(() => { const c = [...document.querySelectorAll("#plLista .pitem")], r = []; for (let i = 1; i < c.length; i++) { const f = c[i].querySelector(".ico-img, .ico-tile"), b = c[i - 1].querySelector(".pi-act"); if (!f || !b) continue; const a = f.getBoundingClientRect(), z = b.getBoundingClientRect(); if (a.top < z.bottom - 1 && a.bottom > z.top && a.left < z.right && a.right > z.left) r.push(c[i].querySelector(".pi-nome").textContent); } return r; });
ok("foto não cobre o botão do cartão de cima", sob.length === 0, sob.join(","));
const sobH = await pg.evaluate(() => { const h = document.querySelector("#plLista .plgh"), c = document.querySelector("#plLista .pitem .ico-img"); if (!h || !c) return false; const a = h.getBoundingClientRect(), b = c.getBoundingClientRect(); return b.top < a.bottom; });
ok("foto do 1º cartão não cobre o título do grupo", !sobH);
// ---- todas as plantas com foto de verdade (silhueta): nada pode se sobrepor ----
await pg.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 240; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 240, 240); x.fillStyle = "#2e8b3e"; x.beginPath(); x.arc(120, 100, 70, 0, 7); x.fill(); x.fillStyle = "#7a4a2a"; x.fillRect(80, 160, 80, 60);
  const img = c.toDataURL("image/jpeg", .8), l = JSON.parse(localStorage.getItem("validamais-plantas")), f = {}; l.forEach(p => { f[p.id] = img; p.f = 1; }); localStorage.setItem("validamais-plantas-fotos", JSON.stringify(f)); localStorage.setItem("validamais-plantas", JSON.stringify(l)); });
await pg.reload(); await pg.waitForTimeout(3500);
await pg.click("#moreBtn"); await pg.waitForTimeout(300); await pg.click("#mnPlantas"); await pg.waitForTimeout(1500);
await pg.evaluate(() => document.documentElement.setAttribute("data-tema", "dark")); await pg.evaluate(() => { document.querySelector("#plLista").scrollIntoView(); });
await pg.screenshot({ path: SHOT + "/p615_7_fotos.png" });
const geo = await pg.evaluate(() => { const out = []; const hs = [...document.querySelectorAll("#plLista .plgh")], cs = [...document.querySelectorAll("#plLista .pitem")];
  cs.forEach((c, i) => { const im = c.querySelector(".ico-img, .ico-tile"); if (!im) return; const a = im.getBoundingClientRect(); const prev = c.previousElementSibling; if (prev) { const b = prev.getBoundingClientRect(), pa = prev.querySelector(".pi-act"); const z = pa ? pa.getBoundingClientRect() : b; if (prev.classList.contains("pitem") && a.top < z.bottom - 1 && a.bottom > z.top) out.push("foto de «" + c.querySelector(".pi-nome").textContent + "» cobre o botão do cartão de cima"); if (prev.classList.contains("plgh") && a.top < prev.getBoundingClientRect().bottom - 1) out.push("foto de «" + c.querySelector(".pi-nome").textContent + "» cobre o título do grupo"); } });
  return { out, n: cs.length, fotos: cs.filter(c => c.querySelector(".ico-img")).length }; });
ok("com foto em todas: " + geo.fotos + " de " + geo.n + " cartões com imagem", geo.fotos === geo.n, JSON.stringify(geo));
ok("fotos não se sobrepõem a botões nem a títulos", geo.out.length === 0, geo.out.join(" | "));
const reais = errs.filter(x => !/404/.test(x));   // apple-touch-icon, vendor.js e icon.svg ficam na raiz do site, não em dist
ok("sem erros de JS", reais.length === 0, reais.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
