// Teste das notas v624 (várias por produto, cor/ícone por tipo, autor e hora): node nota624-test.mjs <pasta dist> <pasta das capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : ""));
const dt = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ps = [[0, "Molico"], [1, "Queijo Minas"], [3, "Salsicha"]].map(([n, nm], i) => ({ id: "p" + i, name: nm, barcode: "78900" + i, quantity: "1", expiry: dt(n), category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }));
const ctx = await br.newContext({ viewport: { width: 411, height: 860 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([ps]) => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-dica-deslizar", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Ronaldo Silva")); localStorage.setItem("validamais-perfil", "Perecíveis"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(ps));
  // nota ANTIGA (uma só, sem lista) tem de continuar aparecendo
  localStorage.setItem("validamais-notas", JSON.stringify({ p2: { t: "Etiqueta manual", por: "Ana", em: Date.now() - 864e5 } })); }, [ps]);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(4500);
const notas = () => pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-notas") || "{}"));
const tags = id => pg.evaluate(id => [...document.querySelectorAll(`.pitem[data-id="${id}"] .pi-tags .pi-tag`)].map(t => ({ cls: t.className, txt: t.querySelector("b").textContent, meta: (t.querySelector("small") || {}).textContent || "", ic: t.querySelector("i").textContent })), id);
let t2 = await tags("p2");
ok("nota antiga (sem lista) aparece como etiqueta cinza «Etiqueta manual» sem nome", t2.length === 1 && /tp-et/.test(t2[0].cls) && t2[0].meta === "", JSON.stringify(t2));
// adicionar 2 notas no mesmo produto
const abre = id => pg.click(`.pitem[data-id="${id}"] .pi-main`).then(() => pg.waitForTimeout(250));
await abre("p0");
await pg.click(".pitem.open [data-ntmais]"); await pg.waitForTimeout(200); await pg.fill(".pitem.open .nt-novo", "Gôndola 3"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400);
ok("campo fica vazio para adicionar a próxima", await pg.evaluate(() => { const i = document.querySelector(".pitem.open .nt-novo"); return !i || i.value === ""; }));
if (!(await pg.$(".pitem.open"))) await abre("p0");
await pg.click('.pitem.open [data-ntf="Câmara"]'); await pg.waitForTimeout(400);
let n = await notas(); const e0 = n.p0;
ok("duas notas gravadas no mesmo produto", e0 && e0.l && e0.l.length === 2 && e0.l[0].t === "Gôndola 3" && e0.l[1].t === "Câmara", JSON.stringify(e0));
ok("cada nota guarda autor e hora", e0.l.every(x => x.por === "Ronaldo Silva" && x.em > 0));
ok("texto juntado (compatível com versões antigas)", e0.t === "Gôndola 3 · Câmara");
await pg.screenshot({ path: SHOT + "/n624_aberto.png" });
ok("cartão aberto: ícone marcado + etiqueta própria com ×", (await pg.$$(".pitem.open .nt-i.on")).length === 1 && (await pg.$$(".pitem.open .nt-lista .pi-tag")).length === 1 && (await pg.$$(".pitem.open .pi-tagx")).length === 1);
ok("linha do nome mostra as marcadas", await pg.evaluate(() => /Gôndola 3 · Câmara/.test(document.querySelector(".pitem.open .nt-nm").innerText)));
await pg.click(".pitem.open .pi-main"); await pg.waitForTimeout(300);
let t0 = await tags("p0");
ok("lista mostra 2 etiquetas: roxo (gôndola) e azul (câmara)", t0.length === 2 && /tp-lc/.test(t0[0].cls) && /tp-cm/.test(t0[1].cls), JSON.stringify(t0));
ok("etiqueta traz ícone e só a mensagem (sem nome nem hora)", t0[0].ic === "📍" && t0[1].ic === "❄️" && t0.every(x => x.meta === "") && !(await pg.evaluate(() => /Ronaldo|\d\d:\d\d/.test(document.querySelector(".pi-tags").textContent))), JSON.stringify(t0.map(x => x.meta)));
await pg.screenshot({ path: SHOT + "/n624_lista.png" });
// editor (texto + cor) numa etiqueta própria
await abre("p0"); await pg.click('.pitem.open [data-nted="Gôndola 3"]'); await pg.waitForTimeout(300);
ok("editor abre com campo e 7 cores", (await pg.$$(".pitem.open .nt-ed .nt-cor")).length === 7 && !!(await pg.$(".pitem.open [data-ntedt]")));
await pg.click('.pitem.open [data-ntcor="pm"]'); await pg.waitForTimeout(300);
n = await notas(); ok("cor escolhida fica gravada (vermelho)", n.p0.l[0].c === "pm", JSON.stringify(n.p0.l));
ok("etiqueta passa a vermelha", /tp-pm/.test(await pg.evaluate(() => document.querySelector(".pitem.open .nt-lista .pi-tag").className)));
await pg.fill(".pitem.open [data-ntedt]", "Gôndola 4"); await pg.click(".pitem.open [data-ntok]"); await pg.waitForTimeout(300);
n = await notas(); ok("texto editado e cor mantida", n.p0.l[0].t === "Gôndola 4" && n.p0.l[0].c === "pm" && n.p0.t === "Gôndola 4 · Câmara", JSON.stringify(n.p0));
if (!(await pg.$(".pitem.open"))) await abre("p0");
ok("área limpa: sem campo de texto aberto até tocar em ＋", !(await pg.$(".pitem.open .nt-novo")) && !!(await pg.$(".pitem.open [data-ntmais]")) && (await pg.$$(".pitem.open .nt-i")).length === 7);
await pg.screenshot({ path: SHOT + "/n630_aberto.png" });
await pg.click('.pitem.open .nt-lista .pi-tagx'); await pg.waitForTimeout(400);
n = await notas(); ok("× tira só aquela nota", n.p0.l.length === 1 && n.p0.l[0].t === "Câmara", JSON.stringify(n.p0.l));
await pg.click('.pitem.open [data-ntf="Câmara"]'); await pg.waitForTimeout(400);
n = await notas(); ok("tocar de novo no ícone desmarca", !n.p0.l.length && !n.p0.t, JSON.stringify(n.p0));
// repetida não duplica; limite de 5
await abre("p1");
for (const x of ["A1", "A2", "A2", "A3", "A4", "A5", "A6"]) { if (!(await pg.$(".pitem.open .nt-novo"))) { await pg.click(".pitem.open [data-ntmais]"); await pg.waitForTimeout(150); } await pg.fill(".pitem.open .nt-novo", x); await pg.keyboard.press("Enter"); await pg.waitForTimeout(250); if (!(await pg.$(".pitem.open"))) await abre("p1"); }
n = await notas(); ok("repetida não duplica e o limite é 5 notas", n.p1.l.length === 5 && !n.p1.l.some(x => x.t === "A6"), JSON.stringify(n.p1.l.map(x => x.t)));
ok("aviso do limite apareceu", await pg.evaluate(() => /No máximo 5/.test(document.getElementById("toast").innerText)));
// promoção continua como explosão na foto e fora das etiquetas
await abre("p1"); 
// sobrevive a recarregar
await pg.reload(); await pg.waitForTimeout(4500);
ok("depois de recarregar as etiquetas continuam", (await tags("p1")).length === 5 && (await tags("p2")).length === 1);
// tema escuro
await pg.evaluate(() => document.documentElement.setAttribute("data-tema", "dark")); await pg.waitForTimeout(300);
await pg.screenshot({ path: SHOT + "/n624_escuro.png" });
ok("sem erros de JS", errs.length === 0, errs.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
