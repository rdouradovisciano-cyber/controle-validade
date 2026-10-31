import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const run = async (dir, port) => {
  const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
    try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
      r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-tema", "dark"); } catch {} });
  const pg = await ctx.newPage(); const errs = [];
  pg.on("pageerror", e => errs.push(String(e).slice(0, 160))); pg.on("dialog", d => d.dismiss());
  await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(3000);
  const out = { rodape: await pg.evaluate(() => document.getElementById("rodVer")?.textContent), appVer: await pg.evaluate(() => document.getElementById("appVer")?.textContent), tabs: {} };
  for (const t of ["navDoacao", "navEtiquetas", "navLoja", "navInventario", "navHist", "navImport", "navCadastros"]) {
    const ok = await pg.evaluate(id => { const e = document.getElementById(id); if (!e) return false; e.click(); return true; }, t); await pg.waitForTimeout(400);
    out.tabs[t] = ok ? await pg.evaluate(() => document.body.innerText.replace(/v\d{3}\b|VERSÃO [\d.-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 3000)) : "(sem aba)"; }
  // lança um item na Doação
  await pg.evaluate(() => document.getElementById("navDoacao").click()); await pg.waitForTimeout(300);
  out.doacao = await pg.evaluate(() => { const b = document.getElementById("dBusca"); if (!b) return "sem busca"; b.value = "banana"; b.dispatchEvent(new Event("input", { bubbles: true })); return document.getElementById("dSug")?.innerText.slice(0, 80) || ""; });
  await pg.screenshot({ path: `/tmp/shot_${port}.png` });
  await br.close(); srv.close(); return { out, errs: [...new Set(errs)] };
};
const A = await run("/tmp/orig", 8120), B = await run("/tmp/n153", 8121);
console.log("rodapé  orig:", A.out.rodape, "| novo:", B.out.rodape); console.log("appVer  orig:", A.out.appVer, "| novo:", B.out.appVer);
console.log("erros   orig:", A.errs.join(" || ") || "nenhum", "| novo:", B.errs.join(" || ") || "nenhum");
for (const t of Object.keys(A.out.tabs)) { const same = A.out.tabs[t] === B.out.tabs[t]; console.log((same ? "IGUAL  " : "DIFERE ") + t, same ? "" : "\n  orig: " + A.out.tabs[t].slice(0, 300) + "\n  novo: " + B.out.tabs[t].slice(0, 300)); }
console.log("busca doação orig:", JSON.stringify(A.out.doacao), "| novo:", JSON.stringify(B.out.doacao));
