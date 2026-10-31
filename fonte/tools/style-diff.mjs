import { chromium } from "playwright-core";
const dirs = process.argv.slice(2);
const run = async (dir, port) => {
  const http = await import("node:http"), fs = await import("node:fs"), path = await import("node:path");
  const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
    try { const b = fs.readFileSync(f); r.setHeader("content-type", f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : f.endsWith(".html") ? "text/html" : "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const out = {}; const errs = [];
  for (const theme of ["dark", "light"]) for (const w of [390, 1100]) {
    const ctx = await br.newContext({ viewport: { width: w, height: 800 } });
    await ctx.addInitScript(t => { try { localStorage.setItem("validamais-tema", t); localStorage.setItem("validamais-operador", "Teste"); } catch {} }, theme);
    const pg = await ctx.newPage(); pg.on("pageerror", e => errs.push(String(e).slice(0, 100)));
    await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(800);
    for (const tab of ["navDoacao", "navEtiquetas", "navLoja", "navInventario", "navValidades"]) {
      const clicked = await pg.evaluate(id => { const e = document.getElementById(id); if (!e) return false; e.click(); return true; }, tab);
      await pg.waitForTimeout(250);
      out[`${theme}-${w}-${tab}-${clicked}`] = await pg.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.id).map(e => { const c = getComputedStyle(e), r = e.getBoundingClientRect();
        return e.id + "|" + ["display","position","color","backgroundColor","fontSize","fontWeight","margin","padding","border","borderRadius","opacity","zIndex","boxShadow","width","height","overflow","gridTemplateColumns","flexDirection","gap","visibility"].map(p => c[p]).join(";") + "|" + Math.round(r.width) + "x" + Math.round(r.height); }));
    }
    await ctx.close();
  }
  await br.close(); srv.close(); return { out, errs: [...new Set(errs)] };
};
const A = await run(dirs[0], 8101), B = await run(dirs[1], 8102);
let diffs = 0, total = 0;
for (const k of Object.keys(A.out)) { const a = Object.fromEntries(A.out[k].map(s => [s.split("|")[0], s])), b = Object.fromEntries((B.out[k] || []).map(s => [s.split("|")[0], s]));
  for (const id of Object.keys(a)) { total++; if (a[id] !== b[id]) { diffs++; if (diffs <= 15) console.log("DIF", k, "\n  A:", a[id], "\n  B:", b[id]); } } }
console.log("abas/temas/larguras:", Object.keys(A.out).length, "| elementos comparados:", total, "| diferenças:", diffs);
console.log("erros JS (A):", A.errs.join(" || ") || "nenhum"); console.log("erros JS (B):", B.errs.join(" || ") || "nenhum");
