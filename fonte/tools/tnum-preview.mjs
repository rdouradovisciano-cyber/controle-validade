import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8220;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const L = [{ id: "a1", nome: "Banana Prata kg", code: "1181", qtd: 11, tam: "M", ok: false }, { id: "a2", nome: "Tomate Italiano kg", code: "8118", qtd: 88, tam: "P", ok: false }, { id: "a3", nome: "Pão Francês kg", code: "1011", qtd: 111, tam: "G", ok: false }, { id: "a4", nome: "Mamão Papaya kg", code: "7078", qtd: 1, tam: "M", ok: false }];
const D = { itens: [{ key: "a|kg", nome: "Banana Prata", unidade: "kg", qtd: 11.1, lanc: 2, cod: "B1" }, { key: "b|kg", nome: "Tomate", unidade: "kg", qtd: 88.8, lanc: 3, cod: "T8" }, { key: "c|kg", nome: "Mamão", unidade: "kg", qtd: 18.1, lanc: 1, cod: "M1" }, { key: "d|kg", nome: "Batata", unidade: "kg", qtd: 1.8, lanc: 1, cod: "B7" }], inicio: new Date().toISOString() };
const CSS = "#dItens,#dKg,#dUn,.cnum,.cqty{font-variant-numeric:tabular-nums}";
const out = {};
for (const depois of [false, true]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([l, d]) => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-etiquetas", JSON.stringify(l)); localStorage.setItem("validamais-doacao", JSON.stringify(d)); localStorage.setItem("validamais-tema", "dark"); } catch {} }, [L, D]);
  const pg = await ctx.newPage(); await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(2800);
  if (depois) await pg.addStyleTag({ content: CSS });
  await pg.evaluate(() => [...document.querySelectorAll("button, summary, div")].find(e => /Doação de hoje/.test(e.textContent) && e.textContent.length < 40)?.click()); await pg.waitForTimeout(500);
  const k = depois ? "depois" : "antes";
  out[k] = { larguras: await pg.evaluate(() => [...document.querySelectorAll(".cnum")].map(e => e.textContent.trim() + ":" + e.getBoundingClientRect().width.toFixed(1))) };
  await pg.screenshot({ path: `/tmp/tn_doa_${k}.png` });
  await pg.evaluate(() => document.getElementById("navEtiquetas").click()); await pg.waitForTimeout(500);
  out[k].qtds = await pg.evaluate(() => [...document.querySelectorAll(".cqty")].map(e => e.textContent.trim() + ":" + e.getBoundingClientRect().width.toFixed(1)));
  await pg.screenshot({ path: `/tmp/tn_etq_${k}.png` }); await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await br.close(); srv.close();
