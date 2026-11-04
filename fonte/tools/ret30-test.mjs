import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const now=Date.now(),dia=864e5;
await pg.addInitScript(([e,now,dia])=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([
{id:"a",name:"Retirado velho",barcode:"1",quantity:"1",expiry:e,category:"Perecíveis",retirado:true,retEm:now-40*dia,retPor:"T"},
{id:"b",name:"Retirado recente",barcode:"2",quantity:"1",expiry:e,category:"Perecíveis",retirado:true,retEm:now-5*dia,retPor:"T"},
{id:"c",name:"Normal",barcode:"3",quantity:"1",expiry:e,category:"Perecíveis"}]))},[dt(5),now,dia]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
console.log("botão:",(await pg.locator("#verRet").textContent()),"| salvos:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).map(p=>p.name).join(",")),errs);
await br.close();srv.close();
