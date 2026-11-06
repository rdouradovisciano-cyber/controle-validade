import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("/home/claude/valida/dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:700}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Ronaldo"));localStorage.setItem("validamais-perfil","Perecíveis");const d=new Date(Date.now()+5*864e5).toISOString().slice(0,10);
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"a",name:"Queijo minas frescal zero fazenda",barcode:"1",codigo_balanca:"1151",quantity:"2",expiry:d,category:"Perecíveis"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5000);
await pg.click('.pitem[data-id="a"] .pi-main');await pg.waitForTimeout(400);
console.log(await pg.evaluate(()=>[...document.querySelectorAll('.pitem[data-id="a"] .pi-act button')].map(b=>b.innerText.trim())));
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/card.png"});console.log(errs);await br.close();srv.close();
