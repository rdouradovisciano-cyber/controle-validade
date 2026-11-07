import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const [nome,perfil] of [["Benassi","Perecíveis"],["Ana","Perecíveis"],["Renato","Admin"],["Rubens",null]]){
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(([n,p])=>{localStorage.setItem("validamais-operador",JSON.stringify(n));if(p)localStorage.setItem("validamais-perfil",p)},[nome,perfil]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(4500);
const info=await pg.evaluate(()=>({esc:getComputedStyle(document.getElementById("mnEscala")).display,seletor:!!document.getElementById("perfilBg"),temBenassi:!!document.querySelector('[data-p="BENASSI"]')}));
console.log(nome,perfil,JSON.stringify(info),errs);}
await br.close();srv.close();
