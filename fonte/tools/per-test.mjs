import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const setor of ["Perecíveis","FLV"]){
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(s=>{sessionStorage.setItem("validamais-setor",s);localStorage.setItem("validamais-operador",JSON.stringify("T"))},setor);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
console.log(setor,await pg.evaluate(()=>({lab:document.querySelector("label[for=cDoacao]").textContent,labCad:document.querySelector("label[for=cDon]").textContent,mic:getComputedStyle(document.getElementById("micBtn")).display})),errs);
await pg.close()}
await br.close();srv.close();
