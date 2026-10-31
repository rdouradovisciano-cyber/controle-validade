import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
pg.on("dialog",d=>d.accept("Banana nanica"));
await pg.addInitScript(()=>{if(localStorage.getItem("seeded"))return;localStorage.setItem("seeded","1");localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"Banana prata",category:"FLV",barcode:"789"},{id:"2",name:"Maçã",category:"FLV",barcode:"789"},{id:"3",name:"Tomate",category:"FLV"},{id:"4",name:"Tomate",category:"FLV",barcode:"555"},{id:"5",name:"Iogurte",category:"Perecíveis",barcode:"789"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1800);
const abre=async()=>{await pg.click("#moreBtn");await pg.click("#mnSaude");await pg.waitForTimeout(300)};
const sum=async()=>(await pg.innerText("#saudeModal")).split("\n").filter(l=>/ponto|Nada p|EAN|Tomate|cadastros/.test(l)).join(" / ");
await abre();console.log(await sum());
// tirar EAN 789 da Maçã
await pg.click('[data-a="lim"][data-n="Maçã"]');await pg.waitForTimeout(300);await pg.click(".ask .ok, .askbg button.ok");await pg.waitForTimeout(400);console.log("1:",await sum());
// juntar tomates
await pg.click('[data-a="jun"]');await pg.waitForTimeout(300);await pg.click(".askbg button.ok");await pg.waitForTimeout(400);console.log("2:",await sum());
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/saude2.png"});
console.log((await pg.innerText("#saudeModal")).slice(0,700));console.log("erros",errs);await br.close();srv.close();
