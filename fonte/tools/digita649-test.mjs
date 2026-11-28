// Teste v649: digitar etiqueta com atualização remota no meio + nome do produto sem sobreposição: node digita649-test.mjs <pasta> <capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : ""));
const d0 = new Date(); const hoje = d0.getFullYear() + "-" + String(d0.getMonth() + 1).padStart(2, "0") + "-" + String(d0.getDate()).padStart(2, "0");
const ps = [{ id: "p0", name: "Sanduíche Frango Temperado Ateliê Clássico Integral Extra Grande 125g", barcode: "7899985000517", quantity: "15", expiry: hoje, category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }, { id: "p1", name: "Molico", barcode: "7890001", quantity: "1", expiry: hoje, category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }];
const ctx = await br.newContext({ viewport: { width: 340, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await ctx.addInitScript(([ps]) => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-dica-deslizar", "1"); localStorage.setItem("validamais-dica-scrub", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Ronaldo Silva")); localStorage.setItem("validamais-perfil", "Perecíveis"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(ps)); localStorage.setItem("validamais-notas", JSON.stringify({ p0: { t: "Câmara", por: "A", em: 1, l: [{ t: "Câmara", por: "A", em: 1 }] }, p1: { t: "Câmara", por: "A", em: 1, l: [{ t: "Câmara", por: "A", em: 1 }] } })); }, [ps]);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(4000);
await pg.evaluate(() => document.querySelector("#list .pitem .pi-main").click()); await pg.waitForTimeout(500);
const g = await pg.evaluate(() => { const n = document.querySelector(".pitem.open .pi-nome"), q = n.parentElement.querySelector(".pi-sub, .pi-meta, small, p") ; const r = n.getBoundingClientRect(); const next = n.nextElementSibling ? n.nextElementSibling.getBoundingClientRect() : null; return { nomeBottom: Math.round(r.bottom), nextTop: next ? Math.round(next.top) : null, h: Math.round(r.height), sh: n.scrollHeight, lines: Math.round(r.height / parseFloat(getComputedStyle(n).lineHeight)) }; });
ok("nome longo aparece inteiro e não passa por cima do texto de baixo", g.h >= g.sh - 1 && (g.nextTop === null || g.nomeBottom <= g.nextTop + 1), JSON.stringify(g));
await pg.screenshot({ path: SHOT + "/d649_nome.png" });
await pg.tap(".pitem.open [data-ntmais]"); await pg.waitForTimeout(400);
await pg.tap(".pitem.open .nt-novo"); await pg.waitForTimeout(200);
await pg.keyboard.type("Gôndola 7"); await pg.waitForTimeout(100);
await pg.evaluate(() => document.querySelector("[data-ntfil]").click());   // redesenho no meio da digitação (como uma atualização vinda de outro aparelho)
await pg.waitForTimeout(400);
const st = await pg.evaluate(() => { const i = document.querySelector(".pitem.open .nt-novo"); return { v: i && i.value, f: document.activeElement === i }; });
ok("atualização remota não apaga o texto nem tira o foco", st.v === "Gôndola 7" && st.f, JSON.stringify(st));
await pg.screenshot({ path: SHOT + "/d649_digitando.png" });
await pg.tap(".pitem.open .nt-okadd"); await pg.waitForTimeout(600);
const n = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-notas") || "{}"));
ok("toque em OK grava a etiqueta", n.p0 && n.p0.l && n.p0.l[0] && n.p0.l.some(x => x.t === "Gôndola 7"), JSON.stringify(n.p0));
ok("campo fecha depois de gravar", !(await pg.$(".pitem.open .nt-novo")));
if (!(await pg.$(".pitem.open"))) { await pg.evaluate(() => document.querySelector("#list .pitem .pi-main").click()); await pg.waitForTimeout(400); }
await pg.tap(".pitem.open [data-ntmais]"); await pg.waitForTimeout(300); await pg.tap(".pitem.open .nt-novo"); await pg.keyboard.type("Bancada 2"); await pg.keyboard.press("Enter"); await pg.waitForTimeout(600);
const n2 = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-notas") || "{}"));
ok("Enter também grava", n2.p0 && n2.p0.l.some(x => x.t === "Bancada 2"), JSON.stringify(n2.p0 && n2.p0.l.map(x => x.t)));
ok("sem erros de JS", errs.length === 0, errs.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
