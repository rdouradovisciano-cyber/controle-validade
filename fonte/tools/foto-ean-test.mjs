import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = process.argv[2], S = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f) && !/ocr\//.test(f)) b = Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const prods = [{ id: "a", name: "Ovos Brancos 20 un", barcode: "7891000100103", category: "FLV", quantity: 2, expiry: "2026-11-20", createdAt: 1 }, { id: "b", name: "Alface Americana Bandeja", barcode: "7890000000019", category: "FLV", quantity: 2, expiry: "2026-11-12", createdAt: 2 }, { id: "c", name: "Banana Prata kg", barcode: "", codigo_balanca: "124", category: "FLV", quantity: 5, expiry: "2026-11-12", createdAt: 3 }, { id: "d", name: "Tomate kg", barcode: "2000124000000", category: "FLV", quantity: 1, expiry: "2026-11-14", createdAt: 4 }];
const pg = await (await br.newContext({ viewport: { width: 411, height: 860 }, deviceScaleFactor: 2 })).newPage(); const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.addInitScript(p => { localStorage.setItem("validamais-operador", JSON.stringify("Renato")); localStorage.setItem("validamais-perfil", "Admin"); localStorage.setItem("validamais-tema", "dark"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(p));
  const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVR4nGP8z8Dwn4EIwESMolGFxCoEACWgAQ0uPmDtAAAAAElFTkSuQmCC"), c => c.charCodeAt(0));
  window.__chamadas = []; const of = window.fetch.bind(window);
  window.fetch = async (u, o) => { u = String(u); if (u.includes("openfoodfacts.org/api")) { window.__chamadas.push(u.match(/product\/(\d+)/)[1]); const e = u.match(/product\/(\d+)/)[1];
      return new Response(JSON.stringify(e === "7891000100103" ? { status: 1, product: { image_front_url: "https://img.test/ovos.png" } } : { status: 0, product: {} }), { status: 200, headers: { "content-type": "application/json" } }); }
    if (u.startsWith("https://img.test/")) return new Response(new Blob([PNG], { type: "image/png" }), { status: 200 }); return of(u, o); }; }, prods);
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(3000);
await pg.evaluate(() => document.getElementById("mnSaude").click()); await pg.waitForTimeout(800);
const o = { errs, antes: await pg.evaluate(() => { const b = document.querySelector("[data-eanfoto]"); const sec = b && b.closest(".shsec"); return { botao: b ? b.closest(".shn2, .shrow").innerText.replace(/\n+/g, " | ").slice(0, 200) : null, titulo: sec ? sec.querySelector(".shh b").textContent : null }; }) };
await pg.evaluate(() => document.querySelector("[data-eanfoto]").click()); await pg.waitForTimeout(4500);
o.chamadas = await pg.evaluate(() => window.__chamadas); o.salvas = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("validamais-fotos-per") || "{}")));
o.toast = await pg.evaluate(() => (document.querySelector(".toast, #toast") || {}).textContent);
o.depois = await pg.evaluate(() => { const sec = [...document.querySelectorAll(".shsec")].find(s => /FLV sem foto/.test(s.innerText)); return sec ? sec.querySelector(".shh").innerText.replace(/\n+/g, " ") + " :: " + [...sec.querySelectorAll(".shfoto b")].map(b => b.textContent).join(" | ") : null; });
await pg.screenshot({ path: S + "/ean.png" }); console.log(JSON.stringify(o, null, 1)); await br.close(); srv.close();
