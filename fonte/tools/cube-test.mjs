import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const nomes=Array.from({length:30},(_,i)=>"Produto "+String.fromCharCode(65+i%26)+i);
const ctx=await br.newContext({viewport:{width:390,height:800}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(n=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(n.map((x,i)=>({id:"p"+i,name:x,barcode:String(7890000000000+i),category:"FLV",quantity:1,expiry:"2026-12-01"}))))},nomes);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(900);
// congela a animação em 35% e 60% para fotografar
async function foto(id,pct,arq){await pg.evaluate(id=>document.getElementById(id).click(),id);await pg.evaluate(p=>{document.getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime)).forEach(a=>{a.pause();const d=a.effect.getComputedTiming().duration;a.currentTime=d*p/100})},pct);await pg.screenshot({path:arq});await pg.evaluate(()=>document.getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime)).forEach(a=>a.finish()));await pg.waitForTimeout(300)}
async function seq(id,ps){await pg.evaluate(id=>document.getElementById(id).click(),id);for(const p of ps){await pg.evaluate(p=>{document.getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime)).forEach(a=>{a.pause();a.currentTime=a.effect.getComputedTiming().duration*p/100})},p);await pg.screenshot({path:`/tmp/mg_${p}.png`})}
await pg.evaluate(()=>document.getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime)).forEach(a=>a.finish()));await pg.waitForTimeout(300)}
await seq("navEtiquetas",[8,20,40,70]);
await pg.evaluate(()=>document.getElementById("navLoja").click());await pg.waitForTimeout(900);
const r={};
r.sobras=await pg.evaluate(()=>[document.querySelectorAll("main.app > [style*=absolute]").length,document.querySelector("main.app").style.position,document.documentElement.style.overflowX,document.documentElement.scrollWidth,innerWidth]);
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(900);
r.dockOk=await pg.evaluate(()=>{const i=document.getElementById("cIdx");const b=i.getBoundingClientRect();return[Math.round(b.left),Math.round(b.width),i.hidden]});
await pg.evaluate(()=>document.getElementById("navDoacao").click());await pg.waitForTimeout(900);
r.dock=await pg.evaluate(()=>{const d=document.getElementById("dDock").getBoundingClientRect();return[Math.round(d.left),Math.round(d.top),Math.round(d.width)]});
// cliques rápidos
for(const n of ["Etiquetas","Loja","Doacao","Etiquetas"]){await pg.evaluate(n=>document.getElementById("nav"+n).click(),n);await pg.waitForTimeout(80)}
await pg.waitForTimeout(900);
r.rapido=await pg.evaluate(()=>[document.querySelectorAll("main.app > [style*=absolute]").length,[...document.querySelectorAll("[id^=tab]")].filter(e=>e.id.length>3&&!e.classList.contains("hidden")&&/^tab(Loja|Doacao|Etiquetas|Inventario|Cadastros)$/.test(e.id)).map(e=>e.id)]);
r.errs=errs;console.log(r);await br.close();srv.close();
