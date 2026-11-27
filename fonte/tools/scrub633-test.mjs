// Teste v633: barra de rolagem rápida: node scrub633-test.mjs <pasta> <capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : ""));
const dt = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const mk = N => Array.from({ length: N }, (_, i) => ({ id: "p" + i, name: "Produto " + String(i + 1).padStart(3, "0"), barcode: "78900" + String(1000 + i), quantity: "1", expiry: dt(i % 20), category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }));
async function abre(N) { const ctx = await br.newContext({ viewport: { width: 411, height: 860 }, hasTouch: false });
  await ctx.addInitScript(([ps]) => { localStorage.setItem("validamais-dica-deslizar", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Ronaldo Silva")); localStorage.setItem("validamais-perfil", "Perecíveis"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(ps)); }, [mk(N)]);
  const pg = await ctx.newPage(); pg.errs = []; pg.on("pageerror", e => pg.errs.push(e.message)); await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(4000); return pg; }
let pg = await abre(8); await pg.waitForTimeout(1500);
ok("com poucos itens a barra não aparece", await pg.evaluate(() => getComputedStyle(document.getElementById("scrub")).display === "none"));
pg = await abre(120); await pg.waitForTimeout(1500);
ok("com 120 itens a barra aparece", await pg.evaluate(() => getComputedStyle(document.getElementById("scrub")).display !== "none"));
const r = await pg.evaluate(() => { const b = document.getElementById("scrub").getBoundingClientRect(); return { x: b.left + b.width / 2, t: b.top, h: b.height }; });
await pg.mouse.move(r.x, r.t + 5); await pg.mouse.down(); await pg.waitForTimeout(150);
const s0 = await pg.evaluate(() => window.scrollY);
await pg.mouse.move(r.x, r.t + r.h / 2, { steps: 6 }); await pg.waitForTimeout(250);
const sm = await pg.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - innerHeight, b: document.getElementById("scrubBolha").innerText, on: document.getElementById("scrubBolha").classList.contains("on") }));
ok("arrastar até o meio leva a lista ao meio", Math.abs(sm.y / sm.max - 0.5) < 0.12, JSON.stringify(sm));
ok("etiqueta mostra o produto", sm.on && /Produto \d+/.test(sm.b), sm.b.replace(/\n/g, " | "));
await pg.screenshot({ path: SHOT + "/s633_meio.png" });
await pg.mouse.move(r.x, r.t + r.h + 40, { steps: 6 }); await pg.waitForTimeout(250);
const fimS = await pg.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - innerHeight }));
ok("arrastar até o fim chega no fim da lista", fimS.max - fimS.y < 6, JSON.stringify(fimS));
await pg.mouse.up(); await pg.waitForTimeout(250);
ok("soltar esconde a etiqueta", await pg.evaluate(() => !document.getElementById("scrubBolha").classList.contains("on")));
await pg.mouse.move(r.x, r.t + 2); await pg.mouse.down(); await pg.mouse.move(r.x, r.t - 30, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(250);
ok("arrastar para cima volta ao início", await pg.evaluate(() => window.scrollY < 6), String(await pg.evaluate(() => window.scrollY)));
await pg.evaluate(() => window.scrollTo(0, 3000)); await pg.waitForTimeout(400);
ok("a alça acompanha a rolagem normal", await pg.evaluate(() => /translateY\((?!0px)/.test(document.querySelector(".scrub-th").style.transform)), await pg.evaluate(() => document.querySelector(".scrub-th").style.transform));
ok("sem erros de JS", pg.errs.length === 0, pg.errs.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
