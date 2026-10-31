import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));pg.on("console",m=>{if(m.type()==="error")errs.push("C:"+m.text())});
await ctx.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"))});const url=`http://localhost:${srv.address().port}/`;
const info=()=>pg.evaluate(()=>({perfil:localStorage.getItem("validamais-perfil"),setor:document.body.dataset.setor,chip:getComputedStyle(document.getElementById("setorChip")).display,chooser:!!document.getElementById("perfilBg")}));
const pin=async(v,v2)=>{await pg.fill("#pinA",v);if(v2!==undefined)await pg.fill("#pinB",v2);await pg.click("[data-o]");await pg.waitForTimeout(500)};
await pg.goto(url);await pg.waitForTimeout(1200);console.log("1 primeira abertura:",await info());
await pg.click('[data-p="Admin"]');console.log(errs.length,await pg.evaluate(()=>document.body.innerText.slice(0,200)));await pin("1234","9999");console.log("erro:",await pg.innerText("#pinE"));
await pin("1234","1234");await pg.waitForTimeout(1500);console.log("2 admin:",await info());
// admin troca para FLV sem senha
await pg.click("#moreBtn");await pg.click("#mnPerfil");await pg.click('[data-p="FLV"]');await pg.waitForTimeout(1500);console.log("3 FLV:",await info());
// FLV tenta trocar -> senha
await pg.click("#moreBtn");await pg.click("#mnPerfil");await pg.click('[data-p="Perecíveis"]');await pg.waitForTimeout(400);
await pin("0000");console.log("senha errada:",await info().then(i=>i.perfil));
await pg.waitForTimeout(300);await pin("1234");await pg.waitForTimeout(1500);console.log("4 PER:",await info());
console.log("erros",errs);await br.close();srv.close();
