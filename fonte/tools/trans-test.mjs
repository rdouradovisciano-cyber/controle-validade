import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function rodar(reduz){
const ctx=await br.newContext({viewport:{width:390,height:800},reducedMotion:reduz?"reduce":"no-preference"});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(900);
const out={};
const anims=()=>pg.evaluate(()=>document.getAnimations().filter(a=>a.effect&&a.effect.getKeyframes().some(k=>k.filter)).length);
await pg.evaluate(()=>document.getElementById("navEtiquetas").click());await pg.waitForTimeout(120);out.etqAnims=await anims();
if(!reduz)await pg.screenshot({path:"/tmp/trans_meio.png"});
await pg.waitForTimeout(800);out.fim=await pg.evaluate(()=>[...document.getElementById("tabEtiquetas").children].filter(e=>getComputedStyle(e).opacity!=="1"||getComputedStyle(e).filter!=="none").length);
const dock=()=>pg.evaluate(()=>{const d=document.getElementById("dDock");const r=d.getBoundingClientRect();return[Math.round(r.left),Math.round(r.top),Math.round(r.width)]});
await pg.evaluate(()=>document.getElementById("navDoacao").click());await pg.waitForTimeout(100);out.dockMeio=await dock();out.doaAnims=await anims();await pg.waitForTimeout(800);out.dockFim=await dock();
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(100);out.cadAnims=await anims();
await pg.evaluate(()=>document.getElementById("navLoja").click());await pg.waitForTimeout(50);await pg.evaluate(()=>document.getElementById("navLoja").click());out.mesma=await anims();
out.errs=errs;await ctx.close();return out}
console.log("normal",await rodar(false));console.log("reduzido",await rodar(true));
await br.close();srv.close();
