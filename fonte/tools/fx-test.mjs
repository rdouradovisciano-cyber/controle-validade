import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const ns=[["Queijo vencido",-1],["Presunto hoje",0],["Peito 3 dias",3],["Rana 6 dias",6],["Manteiga",20]];
await pg.addInitScript(([ps])=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(ps))},[ns.map(([n,d],i)=>({id:"p"+i,name:n,barcode:"78900"+i,quantity:"1",expiry:dt(d),category:"Perecíveis"}))]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
console.log("fx:",await pg.evaluate(()=>document.documentElement.dataset.fx),"| aba siren:",await pg.evaluate(()=>document.getElementById("tbLoja").classList.contains("siren")),await pg.evaluate(()=>document.getElementById("sirN").textContent));
const anim=await pg.evaluate(()=>[".pitem.prv",".pitem.prh",".pitem.pra",".pitem.pry",".pitem.prok"].map(s=>{const e=document.querySelector(s);return e?s+": "+getComputedStyle(e).animationName:s+": -"}));console.log(anim.join(" | "));
for(const i of [0,1,2]){await pg.waitForTimeout(350);await pg.screenshot({path:SP+"fx"+i+".png",clip:{x:0,y:90,width:411,height:520}});}
// desligar
await pg.click("#moreBtn");await pg.click("#mnVis");await pg.waitForTimeout(300);await pg.evaluate(()=>{const c=document.getElementById("vsFx");c.checked=false;c.dispatchEvent(new Event("change"))});await pg.waitForTimeout(300);
console.log("desligado:",await pg.evaluate(()=>document.documentElement.dataset.fx),"| anim:",await pg.evaluate(()=>getComputedStyle(document.querySelector(".pitem.prh")).animationName),"| aba siren:",await pg.evaluate(()=>document.getElementById("tbLoja").classList.contains("siren")),await pg.evaluate(()=>document.getElementById("sirN").textContent));
console.log(errs);await br.close();srv.close();
