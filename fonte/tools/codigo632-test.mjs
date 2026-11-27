// Teste v632: código repetido é bloqueado e avisado na hora: node codigo632-test.mjs <pasta> <capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : ""));
const dt = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ps = [{ id: "a", name: "Nestle zero 1,15g", barcode: "7898755200362", quantity: "1", expiry: dt(5), category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }, { id: "b", name: "Molico 200g", barcode: "7890000000017", quantity: "1", expiry: dt(5), category: "Perecíveis", createdAt: Date.now(), addedBy: "T" }];
const ctx = await br.newContext({ viewport: { width: 411, height: 860 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([ps]) => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-dica-deslizar", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Ronaldo Silva")); localStorage.setItem("validamais-perfil", "Perecíveis"); localStorage.setItem("validamais-produtos-v1", JSON.stringify(ps)); }, [ps]);
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(4000);
const prods = () => pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-produtos-v1") || "[]"));
const askTxt = () => pg.evaluate(() => { const a = document.querySelector(".ask"); return a ? a.innerText : ""; });
const abreForm = async () => { await pg.evaluate(() => document.getElementById("manualOpen").click()); await pg.waitForTimeout(500); };
// 1) digitar código já usado + nome diferente → avisa na hora ao sair do campo do nome
await abreForm();
await pg.fill("#barcode", "7898755200362"); await pg.press("#barcode", "Tab"); await pg.waitForTimeout(400);
ok("ao digitar o código, o nome do cadastro existente é preenchido (sem aviso)", (await pg.inputValue("#name")) === "Nestle zero 1,15g" && !(await askTxt()));
await pg.fill("#name", "Nestle zero batido 1,15g"); await pg.press("#name", "Tab"); await pg.waitForTimeout(400);
let t = await askTxt(); ok("trocar o nome com código de outro produto avisa na hora", /já está cadastrado/.test(t) && /Nestle zero 1,15g/.test(t), t.replace(/\n/g, " | "));
await pg.screenshot({ path: SHOT + "/c632_aviso.png" });
ok("só há 2 botões (sem «Manter os dois»)", (await pg.$$(".ask button")).length === 2);
await pg.click(".ask [data-a='0']"); await pg.waitForTimeout(300);
ok("«Tirar o código» limpa o código", (await pg.inputValue("#barcode")) === "");
// 2) salvar com código repetido (sem passar pelo aviso do campo): bloqueia
await pg.evaluate(() => { document.getElementById("barcode").value = "7890000000017"; document.getElementById("name").value = "Molico novo 400g"; document.getElementById("category").value = "Perecíveis"; document.getElementById("expiry").value = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10); });
await pg.click("#productForm button[type=submit], #productForm .primary"); await pg.waitForTimeout(600);
t = await askTxt(); ok("salvar com código repetido mostra o aviso", /já está cadastrado/.test(t) && /Molico 200g/.test(t), t.replace(/\n/g, " | "));
await pg.click(".ask [data-a='0']"); await pg.waitForTimeout(500);
let l = await prods(); ok("cancelar NÃO cria cadastro novo", l.length === 2, String(l.length));
// 3) «Usar o existente» salva com o nome já cadastrado
await pg.click("#productForm button[type=submit], #productForm .primary"); await pg.waitForTimeout(600);
await pg.click(".ask [data-a='1']"); await pg.waitForTimeout(800);
l = await prods(); const n = l.filter(x => x.barcode === "7890000000017");
ok("«Usar o existente» grava com o nome que já existia (sem nome duplicado)", n.length >= 1 && n.every(x => x.name === "Molico 200g"), JSON.stringify(n.map(x => x.name)));
ok("nenhum código com dois nomes", Object.values(l.reduce((m, x) => ((m[x.barcode] ||= new Set()).add(x.name), m), {})).every(s => s.size === 1));
ok("sem erros de JS", errs.length === 0, errs.join(" | "));
console.log(res.join("\n")); await br.close(); srv.close();
