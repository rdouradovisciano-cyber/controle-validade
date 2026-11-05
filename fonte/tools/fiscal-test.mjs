import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const shot="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
for(const perfil of ["Fiscal","Admin"]){
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(p=>{localStorage.setItem("validamais-operador",JSON.stringify("Fiscal Teste"));localStorage.setItem("validamais-perfil",p);
const d=new Date(Date.now()+5*864e5).toISOString().slice(0,10);
localStorage.setItem("validamais-produtos-v1",JSON.stringify([
{id:"a",name:"Banana prata",barcode:"7890001",codigo_balanca:"1234",codigo_doacao:"500",quantity:"2",expiry:d,category:"FLV"},
{id:"b",name:"Queijo minas frescal",barcode:"7891000100103",codigo_balanca:"94320",codigo_doacao:"133423",quantity:"2",expiry:d,category:"Perecíveis"},
{id:"c",name:"Peito de frango",barcode:"",codigo_balanca:"777",codigo_doacao:"",quantity:"2",expiry:d,category:"Perecíveis"}]))},perfil);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
if(perfil==="Admin"){await pg.click('#setorChip [data-s="Fiscal"]');await pg.waitForTimeout(500);}
const st=await pg.evaluate(()=>({setor:document.body.dataset.setor,tab:document.body.dataset.tab,tabs:[...document.querySelectorAll(".tabbar button")].filter(b=>b.offsetParent).map(b=>b.innerText.trim()),fab:!!document.querySelector(".fabwrap")&&getComputedStyle(document.querySelector(".fabwrap")).display}));
console.log(perfil,JSON.stringify(st));
console.log((await pg.innerText("#cLista")).replace(/\n+/g," | "));
await pg.fill("#cBusca","943");console.log("busca parcial 943:",(await pg.innerText("#cLista")).replace(/\n+/g," | "));
await pg.fill("#cBusca","");
console.log("form visível?",await pg.evaluate(()=>getComputedStyle(document.getElementById("cForm")).display));
await pg.click("#cFisNovo");console.log("após Não achou:",await pg.evaluate(()=>getComputedStyle(document.getElementById("cForm")).display));
await pg.fill("#cNome","Coxão mole");await pg.fill("#cPlu","321");await pg.click("#cSalvar");await pg.waitForTimeout(300);
console.log("sem setor:",await pg.evaluate(()=>document.querySelector("#toast")?.innerText||""));
await pg.selectOption("#cCat","Perecíveis");await pg.click("#cSalvar");await pg.waitForTimeout(500);
console.log("form fechou?",await pg.evaluate(()=>getComputedStyle(document.getElementById("cForm")).display));
await pg.click('#cSetorF [data-fs="Perecíveis"]');console.log("filtro Perecíveis:",(await pg.innerText("#cLista")).replace(/\n+/g," | "));await pg.click('#cSetorF [data-fs=""]');
console.log("fab:",await pg.evaluate(()=>[...document.querySelectorAll(".fabwrap button")].filter(b=>b.offsetParent).map(b=>b.id)));
await pg.evaluate(()=>window.vmFiscalScan("7891000100103"));await pg.waitForTimeout(300);console.log("bipe achou:",(await pg.innerText("#codModal")).replace(/\n+/g," | ").slice(0,90));await pg.click("#codModal [data-x]");
await pg.evaluate(()=>window.vmFiscalScan("7899999999999"));await pg.waitForTimeout(300);console.log("bipe não achou:",await pg.evaluate(()=>document.querySelector("#toast")?.innerText||""));
await pg.click("#toast button").catch(()=>{});await pg.waitForTimeout(300);console.log("EAN preenchido:",await pg.inputValue("#cEan"));await pg.click("#cCanc,#cCancela").catch(()=>{});
await pg.reload();await pg.waitForTimeout(4500);
await pg.click('.cadrow:has-text("Queijo") .ci');await pg.waitForTimeout(300);
console.log("modal:",(await pg.innerText("#codModal")).replace(/\n+/g," | "),"svg:",await pg.locator("#codModal svg").count());
await pg.screenshot({path:shot+"fiscal-cod-"+perfil+".png"});await pg.click("#codModal [data-x]");
await pg.screenshot({path:shot+"fiscal-"+perfil+".png"});console.log(errs);}
await br.close();srv.close();
