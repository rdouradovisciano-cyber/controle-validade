import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:390,height:800}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const P=(id,name,o)=>({id,name,barcode:"",category:"FLV",quantity:1,expiry:"2026-12-01",...o});
const prods=[P("1","BANANA PRATA",{barcode:"7891000000011",codigo_balanca:"4011",codigo_doacao:"B1"}),
P("2","BANANA NANICA",{barcode:"7891000000028",codigo_balanca:"4011",codigo_doacao:"B2"}),   // balança repetida
P("3","MACA FUJI",{barcode:"7891000000035",codigo_balanca:"4131",codigo_doacao:"B2"}),       // doação repetida com NANICA
P("4","MAMAO",{barcode:"7891000000042"}),P("5","MAMAO FORMOSA",{barcode:"7891000000042"}),   // mesmo EAN, nomes diferentes
P("6","UVA",{barcode:"7891000000059",codigo_balanca:"0123"}),P("7","UVA ROXA",{codigo_balanca:"123"})];  // balança igual sem zeros
const labels=[{nome:"BANANA NANICA",code:"7891000000028",orig:"7891000000028",kg:false,tam:"M",key:"7891000000028",qtd:1},{nome:"UVA ROXA",code:"123",orig:"123",kg:true,tam:"M",key:"uva roxa",qtd:1},{nome:"MACA FUJI",code:"7891000000035",orig:"7891000000035",kg:false,tam:"M",key:"7891000000035",qtd:1}];
await pg.addInitScript(([p,l])=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));localStorage.setItem("validamais-etiquetas",JSON.stringify(l))},[prods,labels]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1000);
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(400);
pg.on("dialog",d=>{console.log("  confirm>",d.message().replace(/\n+/g," / "));d.accept()});
const nomes=()=>pg.evaluate(()=>[...document.querySelectorAll(".cadrow b")].map(b=>b.textContent));
console.log("linhas:",await nomes());
console.log("MAMAO linhas:",await pg.evaluate(()=>[...document.querySelectorAll(".cadrow")].filter(r=>/MAMAO/.test(r.querySelector("b").textContent)).map(r=>r.innerText.replace(/\n+/g," | "))));
// abrir Resolver do MAMAO
await pg.evaluate(()=>{[...document.querySelectorAll(".cadrow")].find(r=>r.querySelector("b").textContent==="MAMAO").querySelector("[data-cres]").click()});await pg.waitForTimeout(300);
console.log("dialogo:",await pg.evaluate(()=>document.getElementById("dupModal").innerText.replace(/\n+/g," | ")));
await pg.screenshot({path:"/tmp/dup1.png"});
// editar MAMAO FORMOSA a partir do dialogo, tentar renomear sem mudar EAN -> deve bloquear sem mexer no MAMAO
await pg.evaluate(()=>{const r=[...document.querySelectorAll("#dupModal .dprow")].find(r=>r.querySelector("b").textContent==="MAMAO FORMOSA");r.querySelector("[data-edit]").click()});await pg.waitForTimeout(200);
console.log("form edita:",await pg.evaluate(()=>[document.getElementById("cNome").value,document.getElementById("cEan").value,document.getElementById("dupModal")===null]));
await pg.evaluate(()=>{document.getElementById("cNome").value="MAMAO FORMOSA GRANDE";document.getElementById("cSalvar").click()});await pg.waitForTimeout(300);
console.log("após tentar salvar com EAN repetido:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).filter(p=>/MAMAO/.test(p.name)).map(p=>p.name+":"+p.barcode)));
await pg.evaluate(()=>document.getElementById("cCancela").click());
// resolver: manter no MAMAO
await pg.evaluate(()=>{[...document.querySelectorAll(".cadrow")].find(r=>r.querySelector("b").textContent==="MAMAO").querySelector("[data-cres]").click()});await pg.waitForTimeout(300);
await pg.evaluate(()=>{const r=[...document.querySelectorAll("#dupModal .dprow")].find(r=>r.querySelector("b").textContent==="MAMAO");r.querySelector("[data-keep]").click()});await pg.waitForTimeout(500);
console.log("após manter em MAMAO:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).filter(p=>/MAMAO/.test(p.name)).map(p=>p.name+":"+(p.barcode||"(sem EAN)"))));
console.log("linhas:",await nomes(),"| dialogo fechado:",await pg.evaluate(()=>document.getElementById("dupModal")===null),"| filtros:",await pg.evaluate(()=>document.getElementById("cFilt").innerText.replace(/\n+/g," | ")));
// balança repetida: banana
await pg.evaluate(()=>{[...document.querySelectorAll(".cadrow")].find(r=>r.querySelector("b").textContent==="BANANA PRATA").querySelector("[data-cres]").click()});await pg.waitForTimeout(300);
console.log("dialogo banana:",await pg.evaluate(()=>document.getElementById("dupModal").innerText.replace(/\n+/g," | ").slice(0,260)));
console.log("erros",errs);await br.close();srv.close();
