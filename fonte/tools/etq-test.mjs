import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8160;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const L = [{ id: "a1", nome: "Banana Prata kg", code: "124", qtd: 3, tam: "M", ok: false }, { id: "a2", nome: "Tomate Italiano kg", code: "456", qtd: 2, tam: "P", ok: false }, { id: "a3", nome: "Pão Francês kg", code: "200", qtd: 5, tam: "G", ok: true }];
const out = {};
for (const tema of ["dark", "light"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(([l, t]) => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-etiquetas", JSON.stringify(l)); localStorage.setItem("validamais-tema", t); } catch {} }, [L, tema]);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 150)));
  await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(3000);
  await pg.evaluate(() => document.getElementById("navEtiquetas").click()); await pg.waitForTimeout(500);
  const o = { errs };
  o.semSelecionar = await pg.evaluate(() => !document.body.innerText.includes("Selecionar para apagar") && !document.getElementById("eSelBtn") && !document.getElementById("eSelBar"));
  o.linhas = await pg.evaluate(() => document.querySelectorAll("#eLista .crw").length); o.xs = await pg.evaluate(() => document.querySelectorAll("#eLista .crx").length);
  await pg.screenshot({ path: `/tmp/etq_${tema}.png` });
  // toque numa linha (fora do X) abre a folha
  await pg.evaluate(() => document.querySelector("#eLista .cname").click()); await pg.waitForTimeout(300);
  o.folhaAbre = await pg.evaluate(() => !document.getElementById("lModal").classList.contains("hidden")); await pg.evaluate(() => document.getElementById("lmOk").click());
  // X remove 1, mostra Desfazer; Desfazer devolve
  const ordem = await pg.evaluate(() => [...document.querySelectorAll("#eLista .cname")].map(e => e.textContent));
  await pg.evaluate(() => document.querySelector("#eLista .crx").click()); await pg.waitForTimeout(300);
  o.depoisX = await pg.evaluate(() => [...document.querySelectorAll("#eLista .cname")].map(e => e.textContent)); o.removida = ordem.filter(n => !o.depoisX.includes(n));
  o.toast = await pg.evaluate(() => document.getElementById("toast").innerText.replace(/\s+/g, " "));
  o.salvo = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-etiquetas")).length);
  await pg.evaluate(() => { const b = [...document.querySelectorAll("#toast button, #toast a, #toast [role=button]")].find(x => /desfazer/i.test(x.textContent)); b && b.click(); }); await pg.waitForTimeout(300);
  o.depoisDesfazer = await pg.evaluate(() => document.querySelectorAll("#eLista .crw").length); o.salvoDepois = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-etiquetas")).length);
  // marcar como impressa continua funcionando
  await pg.evaluate(() => document.querySelector("#eLista .lchk").click()); await pg.waitForTimeout(200);
  o.marcou = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-etiquetas")).filter(l => l.ok).length);
  out[tema] = o; await ctx.close();
}
await br.close(); srv.close(); console.log(JSON.stringify(out, null, 1));
