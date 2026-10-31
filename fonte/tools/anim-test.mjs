import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));
localStorage.setItem("validamais-doacao",JSON.stringify({itens:[{key:"banana prata|kg",nome:"Banana prata",unidade:"kg",qtd:3.2,lanc:2},{key:"tomate italiano|kg",nome:"Tomate italiano",unidade:"kg",qtd:5,lanc:1},{key:"mamao formosa|kg",nome:"Mamao formosa",unidade:"kg",qtd:1.8,lanc:1},{key:"xuxu|kg",nome:"Xuxu",unidade:"kg",qtd:2,lanc:1}]}));
localStorage.setItem("validamais-dbal",JSON.stringify(["Tropical","Melão","Maçã","Tomate","Legume","Limão"].map(w=>({w,v:[{n:w+" A",c:"",u:"kg"},{n:w+" B",c:"",u:"kg"}]}))))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1000);
// linhas com ícone (sem animação: nenhuma .novo ainda)
await pg.screenshot({path:"/tmp/an1.png"});
// disparar "novo" na linha do tomate e capturar quadros
await pg.evaluate(()=>{window.dNovo="tomate italiano|kg";window.dBurn="";const l=document.getElementById("dLista");const h=l.innerHTML;l.innerHTML=h.replace(/(class="ditem)([^"]*"[^>]*>(?:(?!<\/div>).)*Tomate)/s,'$1 novo$2')});
for(const ms of [60,260,700]){await pg.waitForTimeout(ms===60?60:ms-(ms===260?60:260));await pg.screenshot({path:`/tmp/an_f${ms}.png`,clip:{x:0,y:230,width:411,height:330}})}
// atalho afunda
const sc=await pg.evaluate(async()=>{const b=document.querySelector("#dT6 button");b.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));return 1});
// cabeçalho encolhe
await pg.evaluate(()=>{document.body.style.minHeight="3000px";window.scrollTo(0,300)});await pg.waitForTimeout(500);
console.log("rolando:",await pg.evaluate(()=>[document.body.classList.contains("hs"),Math.round(document.querySelector("header").getBoundingClientRect().height),Math.round(document.querySelector(".top").getBoundingClientRect().height)]));
await pg.screenshot({path:"/tmp/an_hs.png",clip:{x:0,y:0,width:411,height:200}});
await pg.evaluate(()=>window.scrollTo(0,0));await pg.waitForTimeout(500);
console.log("topo:",await pg.evaluate(()=>[document.body.classList.contains("hs"),Math.round(document.querySelector("header").getBoundingClientRect().height),Math.round(document.querySelector(".top").getBoundingClientRect().height)]));
console.log("erros",errs);await br.close();srv.close();
