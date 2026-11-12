import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]);
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:390,height:860}});
await ctx.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");});
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3500);
await pg.evaluate(()=>{const b=[...document.querySelectorAll("button,[role=tab]")].find(x=>/Pes/.test(x.textContent)&&x.offsetParent);b&&b.click()});await pg.waitForTimeout(800);
console.log("busca visível:",await pg.evaluate(()=>!!document.getElementById("pesBusca").offsetParent),"focada:",await pg.evaluate(()=>document.activeElement&&document.activeElement.id==="pesBusca"),JSON.stringify(errs));
await br.close();srv.close();
