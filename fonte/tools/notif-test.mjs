import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), R="/home/claude/controle-validade";
// 1) lógica do service worker (função pura)
const swSrc=fs.readFileSync(R+"/sw.js","utf8");
const f=new Function("self","caches","fetch",swSrc+";return {montaAviso}")({addEventListener(){}},{},()=>{});
const base=new Date("2026-10-31T00:00:00");const doc=(n,c,e,x={})=>({fields:{name:{stringValue:n},category:{stringValue:c},expiry:{stringValue:e},...x}});
const docs=[doc("Iogurte","Perecíveis","2026-10-30"),doc("Queijo","Perecíveis","2026-10-31"),doc("Presunto","Perecíveis","2026-11-04"),doc("Longe","Perecíveis","2026-12-31"),doc("Alface","FLV","2026-11-01"),doc("Retirado","Perecíveis","2026-11-01",{retirado:{booleanValue:true}}),doc("Lixo","Perecíveis","2026-11-01",{lixo:{integerValue:"1"}})];
console.log("SW PER 7d:",JSON.stringify(f.montaAviso(docs,{dias:7,setores:["Perecíveis"]},base)));
console.log("SW FLV 2d:",JSON.stringify(f.montaAviso(docs,{dias:2,setores:["FLV"]},base)));
console.log("SW nada:",f.montaAviso([doc("X","FLV","2027-01-01")],{dias:2,setores:["FLV"]},base));
// 2) página
const srv=http.createServer((q,r)=>{let u=q.url.split("?")[0];let f=u==="/sw.js"?R+"/sw.js":u==="/icon-192.png"?R+"/icon-192.png":path.join(D,u);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&u!=="/sw.js")b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860}});const url=`http://localhost:${srv.address().port}/`;
await ctx.grantPermissions(["notifications"],{origin:url});
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("seeded"))return;localStorage.setItem("seeded","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");
const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"Iogurte",category:"Perecíveis",barcode:"1",expiry:iso(1),quantity:1,por:"Maria"},{id:"2",name:"Queijo",category:"Perecíveis",barcode:"2",expiry:iso(5),quantity:1,por:"João"},{id:"3",name:"Alface",category:"FLV",expiry:iso(1),quantity:1,por:"Ana"}]))});
await pg.goto(url);await pg.waitForTimeout(2500);
console.log("cartões:",await pg.evaluate(()=>[...document.querySelectorAll("#list .meta")].map(m=>m.textContent).join(" | ")));
await pg.click("#moreBtn");await pg.click("#mnNotif");await pg.waitForTimeout(300);
console.log("modal:",(await pg.innerText("#notifModal")).replace(/\n+/g," / ").slice(0,200));
await pg.check("#nfOn");await pg.waitForTimeout(500);await pg.selectOption("#nfDias","7");await pg.waitForTimeout(300);
console.log("cfg:",await pg.evaluate(()=>localStorage.getItem("validamais-notif")));
console.log("cache:",await pg.evaluate(async()=>{const c=await caches.open("vm-cfg");const r=await c.match("vm-cfg.json");return r?await r.text():"(vazio)"}));
await pg.click("#nfTeste");await pg.waitForTimeout(1200);
console.log("notificações:",JSON.stringify(await pg.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).map(n=>({t:n.title,b:n.body}))})));
console.log("erros",errs.filter(e=>!/ServiceWorker/.test(e)));await br.close();srv.close();
