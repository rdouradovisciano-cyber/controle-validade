import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8170;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const abre = async (tema, fake) => {
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(([t, fake]) => { try { localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-tema", t); } catch {}
    if (fake) { let v; Object.defineProperty(window, "V", { configurable: true, get: () => v, set: x => { v = x; const o = x.onSnapshot; x.onSnapshot = (ref, opts, cb, err) => { const isP = String(ref && (ref.path || ref.id)).includes("products"); if (!isP) return o(ref, opts, cb, err);
      setTimeout(() => cb({ metadata: { fromCache: true, hasPendingWrites: false }, docs: [{ id: "1", data: () => ({ name: "Banana Prata", category: "FLV", expiry: "2027-01-10", quantity: 2, barcode: "1" }) }, { id: "2", data: () => ({ name: "Tomate", category: "FLV", expiry: "2027-01-12", quantity: 1, barcode: "2" }) }] }), 1500); return () => {}; }; } }); } }, [tema, fake]);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 150)));
  await pg.goto(`http://localhost:${port}/index.html`); return { ctx, pg, errs };
};
const estado = pg => pg.evaluate(() => ({ silhuetas: document.querySelectorAll("#list .skelc").length, cards: document.querySelectorAll("#list article.product").length, texto: document.getElementById("list").innerText.replace(/\s+/g, " ").slice(0, 70) }));
const out = {};
// A) sem internet / sem resposta: silhueta aparece e depois de 6 s volta ao normal
for (const tema of ["dark", "light"]) { const { ctx, pg, errs } = await abre(tema, false); await pg.waitForTimeout(900); await pg.evaluate(() => document.getElementById("navLoja").click()); await pg.waitForTimeout(300);
  out["A_" + tema + "_1s"] = await estado(pg); await pg.screenshot({ path: `/tmp/skel_${tema}.png` }); await pg.waitForTimeout(6500); out["A_" + tema + "_7s"] = await estado(pg); out["A_" + tema + "_erros"] = errs; await ctx.close(); }
// B) dados do aparelho chegam em 1,5 s: some a silhueta e entram os cards
{ const { ctx, pg, errs } = await abre("dark", true); await pg.waitForTimeout(700); out.B_0_7s = await estado(pg); await pg.waitForTimeout(1500); out.B_2_2s = await estado(pg); out.B_erros = errs; await ctx.close(); }
await br.close(); srv.close(); console.log(JSON.stringify(out, null, 1));
