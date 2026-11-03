import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
pg.on("dialog",d=>d.accept());
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Renato"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","KÓRIN")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
const vis=async s=>pg.locator(s).isVisible();
console.log("aba contagem?",await vis("#kModo"),"| botão base:",await vis("#kBase"),"| fechar:",await vis("#kFecha"));
const add=async(n,q,u="un")=>{await pg.fill("#kBusca",n);await pg.waitForTimeout(150);await pg.click('[data-kp="novo"]');await pg.fill("#kQtd",String(q));await pg.selectOption("#kUn",u);await pg.click("#kAdd");};
// 1) estoque inicial
await add("Vinho Tinto",10);await add("Queijo Brie",6);await add("Azeite",8);
await pg.click("#kBase");await pg.waitForTimeout(200);
// 2) recebimento
await pg.click('#kModo [data-m="rec"]');await pg.waitForTimeout(200);
console.log("modo rec | base visível:",await vis("#kBase"),"| fechar:",await vis("#kFecha"),"| lista:",(await pg.innerText("#kLista")).replace(/\n+/g," ").slice(0,40));
await add("Vinho Tinto",12);await add("Queijo Brie",6);
await pg.click("#kFecha");await pg.waitForTimeout(300);
// 3) contagem atual
await pg.click('#kModo [data-m="cont"]');await pg.waitForTimeout(200);
await pg.click("#kLimpa");await pg.waitForTimeout(200);
await add("Vinho Tinto",15);await add("Queijo Brie",9);await add("Azeite",9);
// 4) vendas
await pg.click('#kModo [data-m="vend"]');await pg.waitForTimeout(300);
console.log((await pg.innerText("#kVend")).replace(/\n+/g," / "));
await pg.screenshot({path:SP+"kor-vend.png",fullPage:true});
await pg.click("#kVNova");await pg.waitForTimeout(300);
console.log("após novo ref:",(await pg.innerText("#kVend")).replace(/\n+/g," / ").slice(0,200));
await pg.click('#kConta [data-c="depois"]');await pg.waitForTimeout(200);console.log("depois:",(await pg.innerText("#kVend")).replace(/\n+/g," / ").slice(150,420));
await pg.evaluate(()=>{navigator.share=t=>{window.__t=t.text;return Promise.resolve()}});await pg.click("#kVZap");await pg.waitForTimeout(200);console.log(await pg.evaluate(()=>window.__t));
console.log(errs);await br.close();srv.close();
