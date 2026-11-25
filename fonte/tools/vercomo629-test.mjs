// Teste v629: «Ver como usuário normal»: node vercomo629-test.mjs <pasta> <capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : ""));
const ctx = await br.newContext({ viewport: { width: 411, height: 860 } });
await ctx.addInitScript(() => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-dica-deslizar", "1"); localStorage.setItem("validamais-perfil", "Admin"); localStorage.setItem("validamais-operador", JSON.stringify("Renato")); localStorage.setItem("validamais-plantas-v622", "true"); });
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(3500);
const vis = s => pg.evaluate(s => { const e = document.querySelector(s); return !!e && !e.classList.contains("hidden") && e.offsetParent !== null || (!!e && getComputedStyle(e).display !== "none" && !e.classList.contains("hidden")); }, s);
const menu = async () => { await pg.evaluate(() => { const b = document.getElementById("moreBtn") || document.querySelector('[aria-label="Mais opções"]'); b && b.click(); }); await pg.waitForTimeout(300); };
ok("Admin: botão existe e não está escondido", await pg.evaluate(() => { const b = document.getElementById("mnVerComo"); return !!b && !b.classList.contains("hidden") && /Ver como/.test(b.textContent); }));
ok("Admin: Plantas visível para o Renato", await pg.evaluate(() => !document.getElementById("mnPlantas").classList.contains("hidden")));
await pg.evaluate(() => document.getElementById("mnVerComo").click()); await pg.waitForTimeout(3500);
ok("modo normal gravado", await pg.evaluate(() => /^(FLV|Perecíveis)$/.test(localStorage.getItem("validamais-ver-como") || "")));
ok("perfil real continua Admin", await pg.evaluate(() => localStorage.getItem("validamais-perfil") === "Admin"));
ok("faixa roxa aparece", !!(await pg.$("#verComoFaixa")));
ok("body.dataset.perfil não é Admin", await pg.evaluate(() => document.body.dataset.perfil !== "Admin"), await pg.evaluate(() => document.body.dataset.perfil));
ok("Plantas escondida no modo normal", await pg.evaluate(() => document.getElementById("mnPlantas").classList.contains("hidden")));
ok("botão do menu agora diz «Voltar ao modo Admin»", await pg.evaluate(() => /Voltar ao modo Admin/.test(document.getElementById("mnVerComo").textContent)));
await pg.screenshot({ path: SHOT + "/v629_normal.png" });
await pg.click("#verComoFaixa"); await pg.waitForTimeout(3500);
ok("voltou ao Admin: sem chave e sem faixa", await pg.evaluate(() => !localStorage.getItem("validamais-ver-como") && !document.getElementById("verComoFaixa") && document.body.dataset.perfil === "Admin"));
ok("Plantas volta a aparecer", await pg.evaluate(() => !document.getElementById("mnPlantas").classList.contains("hidden")));
ok("sem erros de JS", errs.length === 0, errs.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
