import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:390,height:800}});
const nomes=["Abacaxi","Banana","Cebola","Ovo","Tomate","Uva"];
const hoje=new Date();const d=n=>{const x=new Date(hoje);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
await pg.addInitScript(([n,d0,d1,d5])=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(n.map((x,i)=>({id:"p"+i,name:x,barcode:String(7890000000000+i),category:i%2?"Ovos":"FLV",quantity:3+i,expiry:[d0,d1,d5][i%3]}))));},[nomes,d(-1),d(1),d(5)]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(900);
const tag=process.argv[2]||"x";const out={};
for(const n of ["Doacao","Etiquetas","Loja","Inventario","Cadastros"]){await pg.evaluate(n=>document.getElementById("nav"+n).click(),n);await pg.waitForTimeout(400);
out[n]=await pg.evaluate(()=>[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=="visible"&&e.clientWidth>0}).map(e=>e.tagName.toLowerCase()+(e.id?"#"+e.id:"")+"."+String(e.className).split(" ")[0]).slice(0,8));
await pg.screenshot({path:`/tmp/f_${tag}_${n}.png`})}
out.fonte=await pg.evaluate(async()=>{await document.fonts.ready;const f=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).fontFamily.slice(0,28):"-"};return{brand:f(".vmsr"),body:f("body"),h2:f("h2"),carregada:document.fonts.check("800 20px Outfit")}});
console.log(tag,JSON.stringify(out));await br.close();srv.close();
