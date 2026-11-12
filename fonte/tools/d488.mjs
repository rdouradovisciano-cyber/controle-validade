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
const fut=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
async function tenta(dias){
 await pg.evaluate(()=>{document.getElementById("manualOpen").click()});await pg.waitForTimeout(500);
 await pg.fill("#name","Teste "+dias);await pg.selectOption("#category","Perecíveis").catch(()=>{});await pg.fill("#expiry",fut(dias));
 await pg.evaluate(()=>{document.getElementById("name").form.requestSubmit()});await pg.waitForTimeout(500);
 const lê=()=>pg.evaluate(()=>{const a=document.querySelector(".askbg");return a?a.textContent.replace(/\s+/g," ").slice(0,150):"sem aviso"});
 let t=await lê();
 if(/Bipe o produto/.test(t)){await pg.evaluate(()=>{[...document.querySelectorAll(".askbg button")].find(b=>/manual/i.test(b.textContent)).click()});await pg.waitForTimeout(500);t="[bipe→manual] "+await lê();}
 return t;}
console.log("60 dias:",await tenta(60));
await pg.evaluate(()=>{document.querySelectorAll(".askbg").forEach(x=>x.remove())});
console.log("400 dias:",await tenta(400));
const sh=await pg.$(".askbg");if(sh)await pg.screenshot({path:process.argv[3]+"/d488.png"});
console.log(JSON.stringify(errs));
await br.close();srv.close();
