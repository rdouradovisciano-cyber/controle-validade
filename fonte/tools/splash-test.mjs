import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:390,height:800}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"))});
const url=`http://localhost:${srv.address().port}/`;
const t0=Date.now();await pg.goto(url,{waitUntil:"commit"});
for(const ms of [60,300,680]){await pg.waitForTimeout(Math.max(0,ms-(Date.now()-t0)));await pg.screenshot({path:`/tmp/sp${ms}.png`})}
await pg.waitForTimeout(1400-(Date.now()-t0));
console.log("splash após ~1,4s:",await pg.evaluate(()=>!!document.getElementById("splash")));
await pg.reload();await pg.waitForTimeout(400);console.log("reload na mesma sessão tem splash:",await pg.evaluate(()=>!!document.getElementById("splash")));
console.log("erros",errs);await br.close();srv.close();
