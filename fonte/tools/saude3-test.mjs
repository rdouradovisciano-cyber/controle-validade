import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-tema","light");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"QJ MUSS FAT INTERF ROHDEN KG",category:"Perecíveis",codigo_doacao:"263112",barcode:"1"},{id:"2",name:"Queijo rohden interfolhado",category:"Perecíveis",codigo_doacao:"263112",barcode:"2"},{id:"3",name:"Maçã",category:"FLV",codigo_doacao:"500"},{id:"4",name:"Maçã gala",category:"FLV",codigo_doacao:"500"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
await pg.click("#moreBtn");await pg.click("#mnSaude");await pg.waitForTimeout(400);
console.log((await pg.innerText("#saudeModal")).split("\n").filter(l=>/Doação|interno/.test(l)).join(" | "),errs);
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/saude3.png"});await br.close();srv.close();
