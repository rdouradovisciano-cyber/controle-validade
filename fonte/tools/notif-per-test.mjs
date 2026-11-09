import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2], port = 8173;
const srv = http.createServer((q, r) => { let f = path.join(dir, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
  try { let b = fs.readFileSync(f); const ext = path.extname(f); if ([".html",".js"].includes(ext)) b = Buffer.from(b.toString("utf8").replace(/login:\s*\{\s*email:\s*"[^"]*"\s*\}/g, "login: null"));
    r.setHeader("content-type", { ".css":"text/css", ".js":"text/javascript", ".html":"text/html", ".json":"application/json" }[ext] || "application/octet-stream"); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(port);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function roda(perfil, perm0) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(([pf, p0]) => { try { localStorage.setItem("validamais-perfil", pf); localStorage.setItem("validamais-operador", JSON.stringify("Teste")); } catch {}
    window.__pedidos = 0; let perm = p0; Object.defineProperty(Notification, "permission", { get: () => perm });
    Notification.requestPermission = async () => { window.__pedidos++; perm = "granted"; return "granted"; }; }, [perfil, perm0]);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(3500);
  const o = { perfil, errs, pedidos: await pg.evaluate(() => window.__pedidos), cfg: await pg.evaluate(() => localStorage.getItem("validamais-notif")) };
  await pg.evaluate(() => document.getElementById("mnNotif").click()); await pg.waitForTimeout(400);
  o.modal = await pg.evaluate(() => { const m = document.getElementById("notifModal"); return m ? { titulo: m.querySelector("h2").textContent, checkbox: !!m.querySelector("input[type=checkbox]"), select: !!m.querySelector("select"), estado: m.querySelector("#nfEst").textContent } : null; });
  await ctx.close(); return o;
}
console.log(JSON.stringify(await roda("Perecíveis", "default"), null, 1));
console.log(JSON.stringify(await roda("FLV", "default"), null, 1));
await br.close(); srv.close();
