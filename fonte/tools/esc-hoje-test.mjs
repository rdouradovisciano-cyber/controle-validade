import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]), SHOT=process.argv[3];
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:390,height:860},deviceScaleFactor:2});
await ctx.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","Perecíveis")});
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3500);
await pg.evaluate(()=>document.getElementById("mnEscala").click());await pg.waitForTimeout(800);
const r=await pg.evaluate(()=>[...document.querySelectorAll(".hc")].map(e=>e.className+" | "+e.innerText.replace(/\s+/g," ")+" | zz="+!!e.querySelector(".zz")));
console.log(JSON.stringify({errs,r},null,1));
await pg.evaluate(()=>document.querySelector(".ehoje").scrollIntoView({block:"center"}));await pg.waitForTimeout(1200);
await pg.screenshot({path:SHOT+"/esc_hoje.png"});
await pg.evaluate(()=>{document.documentElement.setAttribute("data-tema","light")});await pg.waitForTimeout(500);
await pg.screenshot({path:SHOT+"/esc_hoje_claro.png"});
await br.close();srv.close();
