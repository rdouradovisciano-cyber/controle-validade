import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(q.url.startsWith("/vendor.js"))f="/home/claude/controle-validade/vendor.js";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{sessionStorage.setItem("validamais-setor","KÓRIN");localStorage.setItem("validamais-operador",JSON.stringify("Rafael"));localStorage.setItem("validamais-contagem-kor",JSON.stringify([{n:"PIZZA CALABRESA",b:"7891234567895",q:5.5,u:"un"},{n:"Sorvete",b:"",q:4,u:"cx"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
await pg.evaluate(()=>document.getElementById("tbContagem").click());await pg.waitForTimeout(300);
const dl=pg.waitForEvent("download",{timeout:10000});await pg.click("#kPdf");const d=await dl.catch(()=>null);
console.log("V:",await pg.evaluate(()=>[typeof window.V,window.V&&typeof window.V.jsPDF]),"toast:",await pg.evaluate(()=>document.getElementById("toast").textContent));
if(d){await d.saveAs("/tmp/cont.pdf");console.log("pdf:",d.suggestedFilename(),fs.statSync("/tmp/cont.pdf").size)}
console.log("erros",errs);await br.close();srv.close();
