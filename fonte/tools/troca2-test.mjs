import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const P=(id,name,o)=>({id,name,barcode:"",category:"FLV",quantity:1,expiry:"",...o});
await pg.addInitScript(p=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));if(!localStorage.getItem("validamais-produtos-v1")){localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));
localStorage.setItem("validamais-etiquetas",JSON.stringify([{nome:"BANANA",code:"1",kg:true,tam:"M",qtd:1,key:"k1"}]));}},
[P("1","BANANA",{expiry:iso(1)}),P("2","ALFACE",{}),P("3","IOGURTE GREGO",{category:"Perecíveis",expiry:iso(5)}),P("4","QUEIJO MINAS",{category:"Perecíveis",expiry:iso(10)}),P("5","PIZZA",{category:"Congelados"}),P("6","SUSHI",{category:"KÓRIN"})]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2000);
await pg.evaluate(()=>{window.__marca=1});
const st=()=>pg.evaluate(()=>({m:window.__marca,setor:document.body.dataset.setor,tab:document.body.dataset.tab,chips:[...document.querySelectorAll("#setorChip button")].filter(b=>!b.hidden).map(b=>b.textContent+(b.classList.contains("on")?"*":"")),
 val:[...document.querySelectorAll("#list .product h3")].map(h=>h.textContent),cad:[...document.querySelectorAll(".cadrow b")].map(b=>b.textContent),
 cnt:[countAll.textContent,countSoon.textContent,countExpired.textContent],etq:[...document.querySelectorAll("#eLista .crw")].length,doa:document.getElementById("dItens").textContent,
 menu:[mnSetorT.textContent,mnSetor2T.textContent],lab:document.querySelector("label[for=cDon]").textContent}));
// FLV: lança item na doação (rascunho do FLV) via localStorage + render
await pg.evaluate(()=>{});
console.log("0 FLV:",JSON.stringify(await st()));
let t0=Date.now();await pg.click('#setorChip [data-s="Perecíveis"]');await pg.waitForTimeout(100);console.log("1 PER (",Date.now()-t0,"ms ):",JSON.stringify(await st()));
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(200);console.log("  cad PER:",(await st()).cad,(await st()).lab);
await pg.evaluate(()=>document.getElementById("tbEtiquetas").click());await pg.waitForTimeout(200);console.log("  etq PER:",(await st()).etq);
// menu -> KÓRIN
await pg.evaluate(()=>document.getElementById("mnSetor2").click());await pg.waitForTimeout(100);console.log("2 KÓRIN:",JSON.stringify(await st()));
await pg.evaluate(()=>document.getElementById("tbCadastros").click());await pg.waitForTimeout(200);
await pg.fill("#cNome","Frango congelado");await pg.click("#cSalvar");await pg.waitForTimeout(300);console.log("  cad KÓRIN:",(await st()).cad);
await pg.click('#setorChip [data-s="FLV"]');await pg.waitForTimeout(100);console.log("3 FLV:",JSON.stringify(await st()));
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(200);console.log("  cad FLV:",(await st()).cad,(await st()).lab);
await pg.evaluate(()=>document.getElementById("tbEtiquetas").click());await pg.waitForTimeout(200);console.log("  etq FLV:",(await st()).etq);
await pg.evaluate(()=>document.getElementById("tbLoja").click());await pg.waitForTimeout(200);console.log("  val FLV:",(await st()).val,(await st()).cnt);
console.log("storage:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).map(p=>p.name+"|"+p.category)));
await pg.screenshot({path:"/tmp/tr2.png",clip:{x:0,y:0,width:411,height:300}});
console.log("erros",errs);await br.close();srv.close();
