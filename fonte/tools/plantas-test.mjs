// Teste do setor Plantas (v609): uso  node plantas-test.mjs <pasta dist> <pasta das capturas>
import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D = path.resolve(process.argv[2]), SHOT = process.argv[3];
const srv = http.createServer((q, r) => { let f = path.join(D, q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html"; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f); if (/\.(html|js)$/.test(f) && !/ocr\//.test(f)) b = Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g, 'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g, "login: null"));
  r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); r.end(b); }).listen(0);
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const res = []; const ok = (n, c, x = "") => { res.push((c ? "OK   " : "FALHA ") + n + (x ? "  → " + x : "")); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const fator = d => { const m = d.getMonth(); return m === 11 || m <= 2 ? 0.85 : m >= 5 && m <= 7 ? 1.3 : 1; };

async function novo(nome) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(n => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-operador", JSON.stringify(n)); localStorage.setItem("validamais-perfil", "Admin"); sessionStorage.setItem("vm-notif-pedido", "1"); }, nome);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e))); pg.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(3500);
  return { ctx, pg, errs };
}
const abreMenu = async pg => { await pg.click("#moreBtn"); await pg.waitForTimeout(300); };

// ---- 1) outro operador NÃO vê o item ----
{ const { ctx, pg, errs } = await novo("Maria"); await abreMenu(pg);
  const vis = await pg.evaluate(() => { const b = document.getElementById("mnPlantas"); return !!b && getComputedStyle(b).display !== "none"; });
  ok("operador Maria não vê «Plantas» no menu", !vis); ok("sem erros (Maria)", errs.length === 0, errs.join(" | "));
  const pv = await pg.evaluate(() => { document.getElementById("mnPlantas").click(); return !!document.getElementById("plV"); }); ok("clique forçado não abre a tela para Maria", !pv);
  await ctx.close(); }

// ---- 2) Renato ----
const { ctx, pg, errs } = await novo("Renato");
await abreMenu(pg);
ok("Renato vê «Plantas» no menu", await pg.evaluate(() => getComputedStyle(document.getElementById("mnPlantas")).display !== "none"));
await pg.screenshot({ path: SHOT + "/pl_0_menu.png" });
await pg.click("#mnPlantas"); await pg.waitForTimeout(500);
ok("tela abre (vazia)", await pg.evaluate(() => !!document.getElementById("plV") && /Nenhuma planta cadastrada/.test(document.getElementById("plLista").innerText)));
ok("menu fechou", await pg.evaluate(() => document.getElementById("moreMenu").classList.contains("hidden")));
await pg.screenshot({ path: SHOT + "/pl_1_vazio.png" });

// nova planta 1: Samambaia, atrasada
await pg.click("#plNew"); await pg.waitForTimeout(300);
await pg.fill("#plE", "Samambaia"); await pg.waitForTimeout(100);
ok("espécie preenche rega a cada 2 dias (3x por semana)", (await pg.inputValue("#plI")) === "2");
ok("mostra luz e cuidados da espécie", await pg.evaluate(() => /Meia-sombra/.test(document.getElementById("plInfo").innerText) && /levemente úmido/.test(document.getElementById("plInfo").innerText)));
await pg.fill("#plN", "Samambaia da entrada"); await pg.fill("#plLc", "Bancada 2");
await pg.click("#plQp"); await pg.click("#plQp");
await pg.setInputFiles("#plFi2", { name: "f.png", mimeType: "image/png", buffer: PNG }); await pg.waitForTimeout(500);
ok("foto aparece na pré-visualização", await pg.evaluate(() => !!document.querySelector("#plFb img")));
await pg.evaluate(d => { const e = document.getElementById("plU"); e.value = d; e.dispatchEvent(new Event("input")); }, ago(30));
await pg.screenshot({ path: SHOT + "/pl_2_form.png" });
await pg.click("#plMs"); await pg.waitForTimeout(500);
ok("fechou o formulário ao salvar", await pg.evaluate(() => !document.getElementById("plM")));

// planta 2: Suculenta regada hoje (próxima)
await pg.click("#plNew"); await pg.waitForTimeout(200); await pg.fill("#plE", "Suculenta"); await pg.click("#plMs"); await pg.waitForTimeout(400);
// planta 3: Jiboia (7 dias) pensada para vencer hoje, usando a mesma conta do app
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
let n3 = 0; for (let k = 1; k <= 20; k++) { const u = new Date(hoje); u.setDate(u.getDate() - k); if (Math.max(1, Math.round(2 * fator(u))) === k) { n3 = k; break; } }
await pg.click("#plNew"); await pg.waitForTimeout(200); await pg.fill("#plE", "Jiboia");
await pg.evaluate(d => { const e = document.getElementById("plU"); e.value = d; e.dispatchEvent(new Event("input")); }, ago(n3)); await pg.click("#plMs"); await pg.waitForTimeout(400);

let txt = await pg.evaluate(() => document.getElementById("plV").innerText.replace(/\s+/g, " "));
ok("3 plantas cadastradas", (await pg.$$(".plc")).length === 3, txt);
ok("grupo Atrasadas com a Samambaia", /Atrasadas.*Samambaia da entrada.*Atrasada há \d+ dias?/i.test(txt));
ok("grupo Regar hoje com a Jiboia (dia calculado " + n3 + ")", /Regar hoje.*Jiboia/i.test(txt), txt);
ok("grupo Próximas com a Suculenta", /Próximas.*Suculenta/i.test(txt));
ok("resumo 1 / 1 / 1", await pg.evaluate(() => [...document.querySelectorAll("#plRes b")].map(b => b.textContent).join(",") === "1,1,1"));
ok("mostra local e 3 vasos", /Bancada 2 · 3 vasos/.test(txt));
ok("foto salva aparece no cartão", await pg.evaluate(() => !!document.querySelector(".plc .plf img")));
ok("distintivo no menu e ponto no ⋮", await pg.evaluate(() => document.body.classList.contains("pldue")));
await pg.screenshot({ path: SHOT + "/pl_3_lista.png" });

const heads = async () => pg.evaluate(() => [...document.querySelectorAll(".plgh")].map(e => e.firstChild.textContent.trim()).join("|"));
// regar + desfazer
await pg.click('.plc.atr [data-pr]'); await pg.waitForTimeout(400);
txt = await pg.evaluate(() => document.getElementById("plV").innerText.replace(/\s+/g, " "));
ok("depois de regar a Samambaia sai de Atrasadas", !/Atrasadas/i.test(await heads()) && /Regar em [234] dias/.test(txt), await heads());
ok("toast com Desfazer visível acima da tela", await pg.evaluate(() => { const t = document.getElementById("toast"); const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !t.classList.contains("hidden") && (t === el || t.contains(el)); }));
await pg.screenshot({ path: SHOT + "/pl_4_regou.png" });
await pg.click("#toast button"); await pg.waitForTimeout(300);
ok("Desfazer devolve a Samambaia para Atrasadas", /Atrasadas/i.test(await heads()), await heads());

// detalhe
await pg.click('.plc.atr .plx'); await pg.waitForTimeout(300);
const det = await pg.evaluate(() => document.getElementById("plM").innerText.replace(/\s+/g, " "));
ok("detalhe mostra espécie, local, cuidados", /Samambaia/.test(det) && /Bancada 2/.test(det) && /Cuidados/i.test(det) && /Borrife as folhas/.test(det), det);
ok("detalhe mostra próxima rega e última rega", /Próxima rega/.test(det) && /Última rega/.test(det));
await pg.screenshot({ path: SHOT + "/pl_5_detalhe.png" });
await pg.evaluate(d => { const e = document.getElementById("plMdt"); e.value = d; }, ago(1)); await pg.click("#plMd"); await pg.waitForTimeout(400);
txt = await pg.evaluate(() => document.getElementById("plV").innerText.replace(/\s+/g, " "));
ok("«regou em outro dia» (ontem) deixa a Samambaia nas próximas", !/Atrasadas/i.test(await heads()), await heads());

// editar
await pg.click('.plc:has(.plf img) .plx'); await pg.waitForTimeout(250); await pg.click("#plMe"); await pg.waitForTimeout(250);
ok("editar abre com os dados e a foto", (await pg.inputValue("#plE")) !== "" && await pg.evaluate(() => !!document.querySelector("#plFb img")));
await pg.fill("#plO", "Folhas amareladas"); await pg.click("#plMs"); await pg.waitForTimeout(400);
const salvo = await pg.evaluate(() => JSON.parse(localStorage.getItem("validamais-plantas")));
ok("anotação salva no aparelho", salvo.some(p => p.o === "Folhas amareladas") && salvo.length === 3, JSON.stringify(salvo).slice(0, 200));

// busca
await pg.fill("#plQ0", "suc"); await pg.waitForTimeout(200);
ok("busca filtra por espécie", (await pg.$$(".plc")).length === 1);
await pg.fill("#plQ0", "bancada"); await pg.waitForTimeout(200);
ok("busca filtra por local", (await pg.$$(".plc")).length === 1);
await pg.fill("#plQ0", ""); await pg.waitForTimeout(200);

// apagar
await pg.click('.plc .plx'); await pg.waitForTimeout(250); await pg.click("#plMe"); await pg.waitForTimeout(250);
await pg.click("#plMdel"); await pg.waitForTimeout(300); await pg.click(".askbg .arow .ok");
await pg.waitForTimeout(500);
ok("apagar remove a planta", (await pg.$$(".plc")).length === 2, String((await pg.$$(".plc")).length));

// tema claro
await pg.evaluate(() => document.documentElement.setAttribute("data-tema", "light")); await pg.waitForTimeout(300);
await pg.screenshot({ path: SHOT + "/pl_6_lista_claro.png" });
await pg.click("#plNew"); await pg.waitForTimeout(300); await pg.screenshot({ path: SHOT + "/pl_7_form_claro.png" });
await pg.click("#plMx"); await pg.waitForTimeout(200);

// aviso (sem permissão no headless): só confere que a faixa aparece e o botão não derruba nada
ok("faixa do aviso de rega aparece", await pg.evaluate(() => document.getElementById("plAv").innerText.length > 10), await pg.evaluate(() => document.getElementById("plAv").innerText));
await pg.evaluate(() => { const b = document.querySelector("[data-pav]"); if (b) b.click(); }); await pg.waitForTimeout(500);

// fechar e voltar ao app
await pg.click("#plX"); await pg.waitForTimeout(300);
ok("fechar volta ao app", await pg.evaluate(() => !document.getElementById("plV") && !document.body.classList.contains("plOn") && !!document.getElementById("list")));
await pg.screenshot({ path: SHOT + "/pl_8_app_ponto.png" });
ok("sem erros de JS (Renato)", errs.length === 0, errs.join(" | "));

// ---- 3) planta atrasada já cadastrada: distintivo no menu e ponto no ⋮ ----
{ const ctx2 = await br.newContext({ viewport: { width: 390, height: 860 }, deviceScaleFactor: 2 });
  await ctx2.addInitScript(l => { if (localStorage.getItem("s")) return; localStorage.setItem("s", "1"); localStorage.setItem("validamais-operador", JSON.stringify("Renato Dourado")); localStorage.setItem("validamais-perfil", "FLV"); localStorage.setItem("validamais-plantas", JSON.stringify(l)); sessionStorage.setItem("vm-notif-pedido", "1"); },
    [{ id: "a1", n: "", e: "Samambaia", loc: "", q: 1, i: 3, u: ago(10), o: "", f: 0 }, { id: "a2", n: "Orquídea da vitrine", e: "Orquídea Phalaenopsis", loc: "Vitrine", q: 2, i: 7, u: ago(7), o: "", f: 0 }]);
  const p2 = await ctx2.newPage(); const e2 = []; p2.on("pageerror", e => e2.push(String(e))); await p2.goto(`http://localhost:${srv.address().port}/`); await p2.waitForTimeout(4000);
  ok("perfil FLV + nome «Renato Dourado»: ponto vermelho no ⋮", await p2.evaluate(() => document.body.classList.contains("pldue")));
  await p2.screenshot({ path: SHOT + "/pl_9_ponto.png", clip: { x: 0, y: 0, width: 390, height: 120 } });
  await p2.click("#moreBtn"); await p2.waitForTimeout(300);
  ok("menu mostra o número de plantas para regar", await p2.evaluate(() => document.getElementById("mnPlN").textContent.trim()) === "2", await p2.evaluate(() => document.getElementById("mnPlN").textContent));
  await p2.screenshot({ path: SHOT + "/pl_10_menu.png" });
  ok("sem erros de JS (cenário 3)", e2.length === 0, e2.join(" | ")); await ctx2.close(); }
console.log(res.join("\n")); await br.close(); srv.close();
