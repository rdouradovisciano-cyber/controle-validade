// Teste: «Últimos lançados» (selo NOVO, efeito ao lançar, filtro dos 15 mais recentes) — Perecíveis, modo local
// Uso: node novo-test.mjs <pasta dist> [pasta das capturas]
import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2] || "dist"), SHOT = process.argv[3] || ".";
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f) && !/ocr\//.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const dia = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), agora = Date.now();
const prods = [
  { id: "A", name: "Queijo Antigo", barcode: "", quantity: "2", expiry: dia(10), category: "Perecíveis", por: "Ana" },                       // sem createdAt (cadastro velho)
  { id: "B", name: "Presunto Meia Hora", barcode: "", quantity: "3", expiry: dia(4), category: "Perecíveis", por: "Bia", createdAt: agora - 5 * 60e3 },
  { id: "C", name: "Salame Tres Horas", barcode: "", quantity: "1", expiry: dia(2), category: "Perecíveis", por: "Caio", createdAt: agora - 3 * 3600e3 },
];
const ctx = await br.newContext({ viewport: { width: 390, height: 860 } });
await ctx.addInitScript(p => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Teste")); localStorage.setItem("validamais-perfil", "Perecíveis"); sessionStorage.setItem("validamais-setor", "Perecíveis"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(p)); }, prods);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0, 160)));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(3500);
const out = { errs };
const nomes = () => pg.evaluate(() => [...document.querySelectorAll("#list .pitem .pi-nome")].map(e => e.textContent.replace(/\s+/g, " ").trim()));
out.l1_nomes = await nomes();
out.l1_pnovo = await pg.evaluate(() => document.querySelectorAll("#list .pitem.pnovo").length);          // esperado 1 (só o de 5 min)
out.l1_chega = await pg.evaluate(() => document.querySelectorAll("#list .pitem.chega").length);          // esperado 0 (abertura não pisca)
out.l1_btn = await pg.evaluate(() => { const b = document.getElementById("novoBtn"); return { oculto: b.classList.contains("hidden"), txt: b.textContent.trim() }; });
await pg.screenshot({ path: `${SHOT}/novo1_lista.png` });
await pg.click("#novoBtn"); await pg.waitForTimeout(300);
out.f_nomes = await nomes();   // esperado: Presunto (5 min) depois Salame (3 h); o antigo sem createdAt fica de fora
out.f_lt = await pg.evaluate(() => [...document.querySelectorAll("#list .pi-lt")].map(e => e.textContent));
out.f_barra = await pg.evaluate(() => ({ barra: !document.getElementById("novoBar").classList.contains("hidden"), btnOculto: document.getElementById("novoBtn").classList.contains("hidden"), grupos: document.querySelectorAll("#list .pgh").length }));
await pg.screenshot({ path: `${SHOT}/novo2_filtro.png` });
await pg.click("#novoX"); await pg.waitForTimeout(300);
out.v_nomes = (await nomes()).length;   // esperado 3
// lança um lote novo pelo formulário (manual)
await pg.evaluate(() => document.getElementById("manualOpen").click()); await pg.waitForTimeout(300);
await pg.fill("#barcode", ""); await pg.fill("#name", "Mortadela Nova"); await pg.fill("#expiry", dia(6));
await pg.click('#productForm button[type=submit]'); await pg.waitForTimeout(400);
await pg.click(".askalt"); await pg.waitForTimeout(500);   // «Cadastrar manual»
out.n_chega = await pg.evaluate(() => [...document.querySelectorAll("#list .pitem.chega .pi-nome")].map(e => e.textContent.replace(/\s+/g, " ").trim()));
out.n_pnovo = await pg.evaluate(() => document.querySelectorAll("#list .pitem.pnovo").length);   // esperado 2
out.n_naTela = await pg.evaluate(() => { const el = document.querySelector("#list .pitem.chega"); if (!el) return null; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
await pg.screenshot({ path: `${SHOT}/novo3_chegada.png` });
await pg.waitForTimeout(2200);
out.n_chegaDepois = await pg.evaluate(() => document.querySelectorAll("#list .pitem.chega").length);   // esperado 0 (efeito acaba)
await pg.click("#novoBtn"); await pg.waitForTimeout(300);
out.f2_nomes = await nomes();   // Mortadela primeiro
out.f2_lt = await pg.evaluate(() => [...document.querySelectorAll("#list .pi-lt")].map(e => e.textContent));
// repintar não repete o efeito
await pg.click("#novoX"); await pg.waitForTimeout(300);
out.repete = await pg.evaluate(() => document.querySelectorAll("#list .pitem.chega").length);   // esperado 0
// modo claro: contraste do selo e do botão
await pg.evaluate(() => { localStorage.setItem("validamais-tema", "light"); document.documentElement.setAttribute("data-tema", "light"); }); await pg.waitForTimeout(300);
await pg.screenshot({ path: `${SHOT}/novo4_claro.png` });
console.log(JSON.stringify(out, null, 1)); await br.close(); srv.close();
