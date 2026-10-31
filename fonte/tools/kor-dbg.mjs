import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860}});const pg=await ctx.newPage();pg.on("console",m=>console.log("c>",m.text()));pg.on("pageerror",e=>console.log("err",e.message));
await pg.addInitScript(()=>{sessionStorage.setItem("validamais-setor","KÓRIN");localStorage.setItem("validamais-operador",JSON.stringify("T"))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.fill("#cNome","Sushi");await pg.setInputFiles("#cFotoIn","/tmp/prod.jpg");await pg.waitForTimeout(500);await pg.click("#cSalvar");await pg.waitForTimeout(800);
const dump=()=>pg.evaluate(()=>new Promise(res=>{const r=indexedDB.open("validamais-fotos-kor",1);r.onsuccess=()=>{try{const q=r.result.transaction("f").objectStore("f").getAllKeys();q.onsuccess=()=>res(q.result)}catch(e){res("erro "+e)}};r.onerror=()=>res("open erro")}));
console.log("idb após salvar:",await dump(),"toast:",await pg.evaluate(()=>document.getElementById("toast").textContent));
await pg.reload();await pg.waitForTimeout(1800);console.log("idb após reload:",await dump(),"thumbs",await pg.evaluate(()=>document.querySelectorAll(".cft").length));
await br.close();srv.close();
