import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]), SHOT=process.argv[3];
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const P=[["a","2026-11-10"],["b","2026-11-12"],["c","2026-11-13"],["d","2026-11-13"],["e","2026-11-16"]].map(([id,e])=>({id,name:"Prod "+id,barcode:"",quantity:"1",expiry:e,category:"Perecíveis",por:"T"}));
for(const [nome,iso] of [["terca","2026-11-10T09:00:00"],["quinta","2026-11-12T09:00:00"]]){
const ctx=await br.newContext({viewport:{width:390,height:300},deviceScaleFactor:2});
await ctx.addInitScript(([t,p])=>{const R=Date;const off=new R(t).getTime()-R.now();globalThis.Date=class extends R{constructor(...a){a.length?super(...a):super(R.now()+off)}static now(){return R.now()+off}};
if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");sessionStorage.setItem("validamais-setor","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(p))},[iso,P]);
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3200);
console.log(nome,JSON.stringify({errs,dias:await pg.evaluate(()=>[...document.querySelectorAll(".hd")].map(e=>e.innerText.replace(/\n/g,"")+(e.querySelector("u").className?"•"+e.querySelector("u").className:"")+(e.classList.contains("fer")?"F":"")+(e.classList.contains("fds")?"w":"")))}));
await pg.screenshot({path:`${SHOT}/faixa_${nome}.png`,clip:{x:0,y:0,width:390,height:140}});await ctx.close();}
await br.close();srv.close();
