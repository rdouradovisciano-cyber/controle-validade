import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const ps=[[-1,"Vencido"],[0,"Hoje"],[1,"Um dia"],[3,"Tres dias"],[4,"Quatro dias"],[7,"Sete dias"],[12,"Doze dias"]].map(([n,nm],i)=>({id:"p"+i,name:nm,barcode:"789000"+i,quantity:"1",expiry:dt(n),category:"Perecíveis",createdAt:Date.now()}));
await pg.addInitScript(([ps])=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(ps));},[ps]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
console.log("total:",await pg.textContent("#listTotal"));
await pg.fill("#search","Um");await pg.waitForTimeout(300);console.log("busca:",await pg.textContent("#listTotal"));
console.log("erros",errs);await br.close();srv.close();
