import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]), SHOT=process.argv[3];
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const [nome,iso] of [["terca","2026-11-10T09:00:00"],["sabado","2026-11-14T09:00:00"],["feriado","2026-11-20T09:00:00"]]){
const ctx=await br.newContext({viewport:{width:390,height:300},deviceScaleFactor:2});
await ctx.addInitScript(t=>{const R=Date;const off=new R(t).getTime()-R.now();globalThis.Date=class extends R{constructor(...a){a.length?super(...a):super(R.now()+off)}static now(){return R.now()+off}};
if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");sessionStorage.setItem("validamais-setor","Perecíveis")},iso);
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3000);
console.log(nome,JSON.stringify({errs,txt:await pg.evaluate(()=>document.getElementById("hojeTop").innerText.replace(/\n/g," | ")),cls:await pg.evaluate(()=>document.getElementById("hojeTop").className)}));
await pg.screenshot({path:`${SHOT}/topo_${nome}.png`,clip:{x:0,y:0,width:390,height:140}});await ctx.close();}
await br.close();srv.close();
