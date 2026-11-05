import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const perfil=process.argv[2]||"Admin";
const pg=await (await br.newContext({viewport:{width:411,height:860},deviceScaleFactor:1})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(p=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil",p);sessionStorage.setItem("validamais-setor","Perecíveis");
const d=new Date(Date.now()+5*864e5).toISOString().slice(0,10);
localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"a",name:"Queijo Minas Frescal",barcode:"1",quantity:"2",expiry:d,category:"Perecíveis"},{id:"b",name:"Pop Cheese",barcode:"2",quantity:"2",expiry:d,category:"Perecíveis"}]))},perfil);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
// foto grande de teste
const big=await pg.evaluate(()=>{const c=document.createElement("canvas");c.width=3000;c.height=2000;const x=c.getContext("2d");for(let i=0;i<400;i++){x.fillStyle=`hsl(${i*7},70%,50%)`;x.fillRect(Math.random()*3000,Math.random()*2000,300,300)}return c.toDataURL("image/jpeg",.95)});
fs.writeFileSync("/tmp/foto.jpg",Buffer.from(big.split(",")[1],"base64"));console.log("original KB",Math.round(fs.statSync("/tmp/foto.jpg").size/1024));
await pg.click('.pitem[data-id="a"] .pi-main');await pg.waitForTimeout(400);
console.log("btn:",await pg.innerText('.pitem[data-id="a"] .pi-foto'));
await pg.setInputFiles('.pitem[data-id="a"] [data-fin]:not([capture])',"/tmp/foto.jpg");await pg.waitForTimeout(1200);
console.log("img:",await pg.evaluate(()=>{const i=document.querySelector('.pitem[data-id="a"] .pf-img');return i?[i.naturalWidth,i.naturalHeight,Math.round(i.src.length*0.75/1024)+" KB"]:null}));
await pg.click('.pitem[data-id="b"] .pi-main');await pg.waitForTimeout(300);console.log("outro item:",await pg.innerText('.pitem[data-id="b"] .pi-foto'));
await pg.screenshot({path:"/tmp/foto-"+perfil+".png"});console.log(errs);await br.close();srv.close();
