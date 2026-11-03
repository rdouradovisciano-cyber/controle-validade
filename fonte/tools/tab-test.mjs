import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860},hasTouch:true})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
await pg.addInitScript(([e])=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(["Queijo","Presunto","Peito"].map((n,i)=>({id:"p"+i,name:n,barcode:"78900"+i,quantity:"1",expiry:e[i],category:"Perecíveis"}))))},[[dt(1),dt(5),dt(12)]]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
const pill=()=>pg.evaluate(()=>{const p=document.getElementById("tabPill"),a=document.querySelector("nav.tabbar .active"),r=p.getBoundingClientRect(),b=a.getBoundingClientRect();return {pill:[Math.round(r.left),Math.round(r.right)],ativo:a.id,btn:[Math.round(b.left),Math.round(b.right)]}});
console.log("inicio",await pill(),await pg.evaluate(()=>[...document.querySelectorAll("nav.tabbar button")].filter(b=>b.offsetParent).map(b=>b.id+":"+b.offsetLeft)));
await pg.click("#tbEtiquetas");
for(const ms of [60,120,200]){await pg.waitForTimeout(ms-(ms==60?0:ms==120?60:120));console.log(ms,"ms",JSON.stringify(await pill()));}
await pg.screenshot({path:SP+"tab-mid.png",clip:{x:0,y:0,width:411,height:200}});
await pg.waitForTimeout(500);console.log("fim",JSON.stringify(await pill()));
const swipe=async dx=>pg.evaluate(dx=>{const el=document.querySelector("#list")||document.body;const mk=(x,t)=>new Touch({identifier:1,target:el,clientX:x,clientY:400});const fire=(type,x)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type=="touchend"?[]:[mk(x)],changedTouches:[mk(x)]}));fire("touchstart",200);fire("touchmove",200+dx/2);fire("touchend",200+dx)},dx);
await pg.evaluate(()=>{window.__c=[];document.querySelectorAll("nav.tabbar button").forEach(b=>b.addEventListener("click",()=>window.__c.push(b.id)))});await swipe(120);await pg.waitForTimeout(600);console.log("cliques",await pg.evaluate(()=>window.__c));console.log("direita (Etiquetas->Pesáveis):",(await pill()).ativo);
await swipe(-120);await pg.waitForTimeout(600);console.log("esquerda (volta):",(await pill()).ativo);await swipe(-120);await pg.waitForTimeout(600);console.log("esquerda de novo:",(await pill()).ativo);
await pg.click("#tbPesaveis");await pg.waitForTimeout(500);await pg.screenshot({path:SP+"tab-end.png",clip:{x:0,y:0,width:411,height:200}});
console.log(errs);await br.close();srv.close();
