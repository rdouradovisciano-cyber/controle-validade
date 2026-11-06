import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","FLV");localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"Banana prata",category:"FLV",barcode:"789",expiry:"2026-11-10",quantity:1},{id:"2",name:"Banana prata kg",category:"FLV",barcode:"789"},{id:"3",name:"Tomate",category:"FLV"},{id:"4",name:"Iogurte",category:"Perecíveis",barcode:"789"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
await pg.click("#moreBtn");await pg.click("#mnSaude");await pg.waitForTimeout(300);
console.log((await pg.innerText("#saudeModal")).slice(0,900));
await pg.click("#shRun");await pg.waitForTimeout(800);
console.log("RES:",await pg.innerText("#shRes"));
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/saude.png"});
await pg.click('.shg:has-text("789") [data-a="uni2"][data-n="Banana prata kg"]');await pg.waitForTimeout(300);
await pg.evaluate(()=>[...document.querySelectorAll("button")].filter(b=>b.textContent.trim()==="Unir").pop().click());await pg.waitForTimeout(500);
console.log("após unir:",JSON.stringify(JSON.parse(await pg.evaluate(()=>localStorage.getItem("validamais-produtos-v1"))).filter(p=>p.barcode==="789").map(p=>[p.name,p.barcode])));
await pg.click("#saudeModal [data-x]");console.log("fechou",await pg.locator("#saudeModal").count(),"erros",errs);await br.close();srv.close();
