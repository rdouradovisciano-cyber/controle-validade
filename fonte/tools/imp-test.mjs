import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("seeded"))return;localStorage.setItem("seeded","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"Iogurte Natural",category:"Perecíveis",barcode:"",expiry:"",quantity:1},{id:"2",name:"Banana",category:"FLV",expiry:"",quantity:1}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.click("#moreBtn");await pg.click("#mnImp");await pg.waitForTimeout(300);
console.log("título:",await pg.innerText("#impTitle"),"|",(await pg.innerText("#impNote")).slice(0,120));
await pg.fill("#impText","nome;codigo_balanca;codigo_interno;ean;categoria\nIogurte Natural;;INT01;7891234567890;FLV\nQueijo Minas;;INT02;7891234567891;Padaria\nBanana;;;;FLV");
await pg.click("#impCheck");await pg.waitForTimeout(300);console.log("prévia:",(await pg.innerText("#impPrev")).replace(/\n/g," / "));
await pg.click("#impGo");await pg.waitForTimeout(500);
console.log(await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).map(p=>p.name+"|"+p.category+"|"+(p.barcode||"")+"|"+(p.codigo_doacao||"")).join("  ;  ")));
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(300);console.log("botão na aba:",await pg.locator("#cImportar").isVisible());
console.log("erros",errs);await br.close();srv.close();
