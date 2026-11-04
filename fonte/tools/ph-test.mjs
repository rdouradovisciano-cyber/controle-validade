import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","Perecíveis");
const old=Date.now()-3600e3;localStorage.setItem("validamais-phlog",JSON.stringify([{t:old,who:"X",k:"add",n:1,it:[{n:"Antigo entrou",d:""}]},{t:old,who:"X",k:"del",n:1,it:[{n:"Antigo saiu"}]},{t:old,who:"X",k:"chg",n:1,it:[{n:"Antigo mudou",d:"qtd 1 → 2"}]}]));
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"a",name:"Base",barcode:"1",quantity:"1",expiry:"2027-01-01",category:"Perecíveis"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
const ver=async()=>{await pg.click("#moreBtn");await pg.click("#mnHist");await pg.waitForTimeout(300);const t=(await pg.innerText("#phList")).replace(/\n+/g," / ");await pg.evaluate(()=>document.querySelector("#phModal [data-x], #phModal .secondary")&&document.querySelector("#phModal").classList.add("hidden"));return t};
console.log("1) antes:",await ver());
// cadastrar produto novo
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(300);
await pg.fill("#cNome","Produto Novo");await pg.click("#cSalvar");await pg.waitForTimeout(800);
console.log("2) depois:",await ver());
console.log(errs);await br.close();srv.close();
