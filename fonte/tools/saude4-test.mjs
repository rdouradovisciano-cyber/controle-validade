import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SHOT=process.argv[2]||"/tmp/saude4.png";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("__ini"))return;localStorage.setItem("__ini","1");localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-tema","light");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"QJ MUSS FAT INTERF ROHDEN KG",category:"Perecíveis",codigo_doacao:"263112",barcode:"1"},{id:"2",name:"Queijo rohden interfolhado",category:"Perecíveis",codigo_doacao:"263112",barcode:"2"},{id:"3",name:"Presunto",category:"Perecíveis",codigo_doacao:"900",barcode:"3"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
await pg.click("#moreBtn");await pg.click("#mnSaude");await pg.waitForTimeout(400);
const btn=pg.locator('#saudeModal [data-a="exc"]');console.log("botões Excluir:",await btn.count());
await pg.screenshot({path:SHOT});
await btn.first().click();await pg.waitForTimeout(300);console.log("confirmação:",(await pg.innerText(".askbg")).replace(/\n+/g," | "));
await pg.locator(".askbg button",{hasText:"Excluir"}).last().click();await pg.waitForTimeout(600);
const st=await pg.evaluate(()=>{const l=JSON.parse(localStorage.getItem("validamais-produtos-v1")||"[]");return l.map(p=>p.name+(p.lixo?" [LIXO]":""))});
console.log(st,errs);await br.close();srv.close();
