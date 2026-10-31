import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("seeded"))return;localStorage.setItem("seeded","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"Presunto fatiado",category:"Perecíveis",barcode:"",codigo_balanca:"123",codigo_doacao:"INT01",expiry:"2026-11-03",quantity:1},{id:"2",name:"Queijo prato",category:"Perecíveis",barcode:"",codigo_balanca:"456",expiry:"",quantity:1},{id:"3",name:"Mortadela",category:"Perecíveis",barcode:"",codigo_balanca:"789",codigo_doacao:"INT09",expiry:"",quantity:1}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.click("#tbPesaveis");await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>[...document.querySelectorAll(".pesrow")].map(r=>r.innerText.replace(/\n+/g," ¦ ")).join("\n")));
await pg.fill("#pesBusca","int09");await pg.waitForTimeout(200);console.log("busca int09:",await pg.evaluate(()=>[...document.querySelectorAll(".pesrow .pesn b")].map(b=>b.textContent)));
await pg.fill("#pesBusca","");await pg.waitForTimeout(200);await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/pes.png"});
console.log("erros",errs);await br.close();srv.close();
