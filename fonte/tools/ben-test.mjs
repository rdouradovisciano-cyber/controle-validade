import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const mk=async init=>{const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();pg.errs=[];pg.on("pageerror",e=>pg.errs.push(e.message));await pg.addInitScript(init);await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);return pg};
// 1) primeira vez, escolhe BENASSI no seletor (sem senha)
let pg=await mk(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Rubens"));localStorage.setItem("validamais-produtos-v1","[]")});
console.log("seletor aberto:",await pg.isVisible("#perfilBg"));
await pg.click('[data-p="BENASSI"]');await pg.waitForTimeout(3000);
console.log("após escolher BENASSI: escala visível:",await pg.isVisible("#escV"),"| pediu senha:",await pg.isVisible(".pinA, #pinA"));
// 2) operador chamado BENASSI com perfil FLV
pg=await mk(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Benassi"));localStorage.setItem("validamais-perfil","FLV");localStorage.setItem("validamais-produtos-v1","[]")});
await pg.click("#moreBtn");console.log("operador Benassi/FLV vê item:",await pg.isVisible("#mnEscala"));await pg.click("#mnEscala");await pg.waitForTimeout(300);console.log("abre escala:",await pg.isVisible("#escV"),"| editável:",await pg.locator("[data-ek]").count());
console.log(pg.errs);await br.close();srv.close();
