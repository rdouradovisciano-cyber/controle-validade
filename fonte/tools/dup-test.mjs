import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([
{id:"1",name:"PROVOLONE MAT GRAN MESTRI KG",barcode:"7891111111111",quantity:"2",expiry:"2026-11-20",category:"Perecíveis",codigo_balanca:"501"},
{id:"2",name:"PROVOLONETE MAT GRAN MESTRI KG",barcode:"7892222222222",quantity:"3",expiry:"2026-11-12",category:"Perecíveis",codigo_doacao:"B1"},
{id:"3",name:"PROVOLONETE MAT GRAN MESTRI KG",barcode:"7892222222222",quantity:"1",expiry:"2026-12-01",category:"Perecíveis"},
{id:"4",name:"Salsicha Viena",barcode:"",quantity:"5",expiry:"",category:"Perecíveis"},
{id:"5",name:"SALSICHA VIENA KG",barcode:"7893333333333",quantity:"1",expiry:"2026-11-10",category:"Perecíveis"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2000);
await pg.evaluate(()=>window.dupReview());await pg.waitForTimeout(300);
console.log((await pg.innerText(".askbg .ask")).replace(/\n+/g," / ").slice(0,700));
await pg.screenshot({path:SP+"dup.png"});console.log(errs);await br.close();srv.close();
