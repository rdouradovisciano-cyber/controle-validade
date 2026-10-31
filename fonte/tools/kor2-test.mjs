import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const setor of ["FLV","KÓRIN"]){
const pg=await br.newPage({viewport:{width:411,height:860}});
await pg.addInitScript(([s])=>{sessionStorage.setItem("validamais-setor",s);localStorage.setItem("validamais-operador",JSON.stringify("T"));if(!localStorage.getItem("validamais-produtos-v1"))localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"PIZZA",barcode:"7891234567895",category:"Congelados",quantity:1,expiry:"",codigo_balanca:"123",codigo_doacao:"B1"},{id:"2",name:"BANANA",barcode:"",category:"FLV",quantity:1,expiry:"",codigo_balanca:"55",codigo_doacao:"A1"}]))},[setor]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(300);
console.log(setor,await pg.evaluate(()=>({plu:getComputedStyle(document.getElementById("cPlu")).display,don:getComputedStyle(document.getElementById("cDon")).display,linha:document.querySelector(".cadrow small").textContent})));
if(setor==="KÓRIN"){await pg.evaluate(()=>document.querySelector("[data-ced]").click());await pg.click("#cSalvar");await pg.waitForTimeout(300);console.log("edição preserva:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).filter(p=>p.name==="PIZZA").map(p=>p.codigo_balanca+"|"+p.codigo_doacao)))}
await pg.close()}
await br.close();srv.close();
