import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function rodar(reduz){
const ctx=await br.newContext({viewport:{width:390,height:800},reducedMotion:reduz?"reduce":"no-preference"});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const itens=[{nome:"Banana kg",unidade:"kg",qtd:12.5,lanc:1,cod:"B1",key:"a"},{nome:"Abacaxi un",unidade:"un",qtd:3,lanc:1,cod:"",key:"b"},{nome:"Tomate kg",unidade:"kg",qtd:7.25,lanc:1,cod:"T1",key:"c"}];
await pg.addInitScript(i=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-doacao",JSON.stringify({itens:i,inicio:new Date().toISOString()}))},itens);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1000);
await pg.evaluate(()=>document.getElementById("navDoacao").click());await pg.waitForTimeout(300);
await pg.evaluate(()=>document.getElementById("dFinalizar").click());await pg.waitForTimeout(450);
const o={};o.totalVisivel=await pg.evaluate(()=>{const e=document.querySelector("#romBody .romtotal");return e?e.innerText:null});
o.particulas=await pg.evaluate(()=>document.querySelectorAll("body > div[aria-hidden=true] > i").length);
if(!reduz){await pg.evaluate(()=>document.getAnimations().filter(a=>isFinite(a.effect.getComputedTiming().endTime)).forEach(a=>{a.pause();a.currentTime=Math.min(a.effect.getComputedTiming().endTime,(a.effect.getComputedTiming().delay||0)+ (a.effect.getComputedTiming().duration*0.38))}));await pg.screenshot({path:"/tmp/confete.png"})}
await pg.waitForTimeout(100);await pg.evaluate(()=>document.getAnimations().forEach(a=>{try{a.play()}catch(e){}}));await pg.waitForTimeout(2300);
o.restos=await pg.evaluate(()=>document.querySelectorAll("body > div[aria-hidden=true] > i").length);o.errs=errs;await ctx.close();return o}
console.log("normal",await rodar(false));console.log("reduzido",await rodar(true));await br.close();srv.close();
