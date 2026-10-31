import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8190;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await br.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-tema", "dark"); } catch {} });
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 150))); pg.on("dialog", d => d.accept());
await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(2500);
const log = [];
await pg.getByRole("button", { name: /^Banana/ }).first().click(); await pg.waitForTimeout(500); log.push("balão clicado");
const vis = await pg.evaluate(() => { const e = document.getElementById("dAddItem"); const r = e && e.getBoundingClientRect(); return { dAddItem: !!e, w: r && r.width, h: r && r.height, peso: document.getElementById("dPeso")?.getBoundingClientRect().height }; }); log.push(JSON.stringify(vis));
await pg.screenshot({ path: "/tmp/flow1.png" });
// digita 2,5 no teclado numérico próprio
for (const k of ["2", ",", "5"]) { await pg.evaluate(k => { const b = [...document.querySelectorAll("#numpad button, .np button, [data-np] button")].find(x => x.textContent.trim() === k); b && b.click(); }, k); }
log.push("peso: " + await pg.evaluate(() => document.getElementById("dPeso").value));
await pg.evaluate(() => document.getElementById("dAddItem").click()); await pg.waitForTimeout(500);
const t = await pg.evaluate(() => { const e = document.getElementById("toast"); return { visivel: !e.classList.contains("hidden"), texto: e.innerText.replace(/\s+/g, " ") }; });
const itens = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem("validamais-doacao")).itens.map(i => i.nome + " " + i.qtd + " " + i.unidade); } catch { return null; } });
console.log(JSON.stringify({ log, toast: t, itens, errs })); await pg.screenshot({ path: "/tmp/flow2.png" }); await br.close(); srv.close();
