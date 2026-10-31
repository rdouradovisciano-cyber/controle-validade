import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8200;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const L = [{ id: "a1", nome: "Banana Prata kg", code: "124", qtd: 3, tam: "M", ok: false }, { id: "a2", nome: "Tomate Italiano kg", code: "456", qtd: 2, tam: "P", ok: false }];
const out = {};
for (const tema of ["dark", "light"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(([l, t]) => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-etiquetas", JSON.stringify(l)); localStorage.setItem("validamais-tema", t); } catch {} }, [L, tema]);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 150)));
  await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(2800);
  const o = { errs };
  o.iconesAbas = await pg.evaluate(() => document.querySelectorAll(".tabbar .ic").length);
  o.abasTexto = await pg.evaluate(() => [...document.querySelectorAll(".tabbar button")].map(b => b.innerText.trim()));
  // 1) aviso simples (Doação > Concluir sem itens)
  await pg.evaluate(() => { const b = document.getElementById("dFin") || [...document.querySelectorAll("button")].find(x => /Finalizar|Concluir doa/i.test(x.textContent)); b && b.click(); }); await pg.waitForTimeout(350);
  o.toastSimples = await pg.evaluate(() => { const e = document.getElementById("toast"); const r = e.getBoundingClientRect(); return { visivel: !e.classList.contains("hidden"), texto: e.innerText.replace(/\s+/g, " "), largura: Math.round(r.width), topo: Math.round(r.top) }; });
  await pg.screenshot({ path: `/tmp/vis_aviso_${tema}.png` });
  // 2) etiquetas: remover e mostrar «Desfazer»
  await pg.evaluate(() => document.getElementById("navEtiquetas").click()); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector("#eLista .crx").click()); await pg.waitForTimeout(350);
  o.toastDesfazer = await pg.evaluate(() => { const e = document.getElementById("toast"); const r = e.getBoundingClientRect(); const b = e.querySelector("button"); return { texto: e.innerText.replace(/\s+/g, " "), largura: Math.round(r.width), esq: Math.round(r.left), dir: Math.round(r.right), botao: !!b, fundoBotao: b && getComputedStyle(b).backgroundColor }; });
  await pg.screenshot({ path: `/tmp/vis_etq_${tema}.png` });
  o.some = await (async () => { await pg.waitForTimeout(6300); return await pg.evaluate(() => document.getElementById("toast").classList.contains("hidden")); })();
  // 3) menu ⋮ e troca de tema
  await pg.evaluate(() => document.getElementById("moreBtn").click()); await pg.waitForTimeout(400);
  o.iconesMenu = await pg.evaluate(() => document.querySelectorAll("#moreMenu .ic").length);
  o.iconeTemaAntes = await pg.evaluate(() => document.querySelector("#mnTema use").getAttribute("href") + " | " + document.getElementById("mnTema").innerText.trim());
  await pg.screenshot({ path: `/tmp/vis_menu_${tema}.png` });
  await pg.evaluate(() => document.getElementById("mnTema").click()); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.getElementById("moreBtn").click()); await pg.waitForTimeout(300);
  o.iconeTemaDepois = await pg.evaluate(() => document.querySelector("#mnTema use").getAttribute("href") + " | " + document.getElementById("mnTema").innerText.trim() + " | tema=" + document.documentElement.dataset.tema);
  out[tema] = o; await ctx.close();
}
await br.close(); srv.close(); console.log(JSON.stringify(out, null, 1));
