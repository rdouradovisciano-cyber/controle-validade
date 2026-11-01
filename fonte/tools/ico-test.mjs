import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const nomes=["Queijo minas búfala","Nestle vitamina de frutas","Peito de peru","Rana ravioli azul escuro","Bacon tablete","Manteiga aviação","Pop cheese","Salmão fresco","Produto xyz","Salsicha Viena","Linguiça calabresa"];
await pg.addInitScript(([ns,e])=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(ns.map((n,i)=>({id:"p"+i,name:n,barcode:"789000"+i,quantity:"1",expiry:e[i%e.length],category:"Perecíveis"}))))},[nomes,[dt(2),dt(5),dt(9)]]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
console.log(await pg.evaluate(()=>[...document.querySelectorAll(".pi-nome")].map(e=>e.textContent.trim())));
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/ico.png"});
await pg.click("#moreBtn");await pg.click("#mnVis");await pg.waitForTimeout(300);await pg.uncheck("#vsIco");await pg.waitForTimeout(300);
console.log("desligado:",await pg.evaluate(()=>[...document.querySelectorAll(".pi-nome")].slice(0,3).map(e=>e.textContent.trim()+"|ico:"+e.querySelectorAll(".ico").length)));
console.log("erros",errs);await br.close();srv.close();
