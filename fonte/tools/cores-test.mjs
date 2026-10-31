import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const tema=process.argv[2]||"dark";
const pg=await br.newPage({viewport:{width:411,height:1700}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(t=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");localStorage.setItem("validamais-tema",t);try{localStorage.setItem("tema",t)}catch(e){}
const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const P=(id,name,n)=>({id,name,category:"Perecíveis",barcode:"b"+id,expiry:iso(n),quantity:2});
localStorage.setItem("validamais-produtos-v1",JSON.stringify([P("1","Presunto fatiado",-2),P("2","Iogurte natural",0),P("3","Queijo prato",2),P("4","Requeijão",6),P("5","Leite longa vida",20),P("6","Presunto cozido",1),P("7","Mussarela fatiada",4),P("8","Manteiga",45)]))},tema);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
if(tema==="light")await pg.evaluate(()=>document.documentElement.setAttribute("data-tema","light"));else await pg.evaluate(()=>document.documentElement.setAttribute("data-tema","dark"));
await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>[...document.querySelectorAll("#list article.pitem")].map(a=>a.querySelector(".pi-nome").textContent+" → "+a.querySelector(".pi-badge").innerText.replace(/\n/g," ")).join("\n")));
await pg.screenshot({path:`/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/cores-${tema}.png`,fullPage:false});
console.log("erros",errs);await br.close();srv.close();
