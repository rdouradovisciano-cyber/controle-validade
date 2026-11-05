import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([
{id:"a",name:"Queijo minas frescal fazenda",barcode:"",codigo_balanca:"9432",codigo_doacao:"",quantity:"20",expiry:"2026-11-18",category:"Perecíveis"},
{id:"b",name:"QUEIJO MINAS FRESCAL FAZENDA KG",barcode:"",codigo_balanca:"94320",codigo_doacao:"133423",quantity:"1",expiry:"2026-11-20",category:"Perecíveis"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
await pg.evaluate(()=>window.dupReview());await pg.waitForTimeout(300);
console.log(await pg.innerText(".dupg"));
await pg.click('[data-u="1"][data-n="1"]');await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>document.body.innerText.includes("Unir cadastros")));
await pg.evaluate(()=>[...document.querySelectorAll("button")].filter(b=>b.textContent.trim()==="Unir").pop().click());await pg.waitForTimeout(500);
console.log(JSON.stringify(JSON.parse(await pg.evaluate(()=>localStorage.getItem("validamais-produtos-v1"))).map(p=>[p.name,p.codigo_balanca,p.codigo_doacao,p.quantity,p.expiry])));
console.log(await pg.innerText(".ask").catch(()=>""),errs);await br.close();srv.close();
