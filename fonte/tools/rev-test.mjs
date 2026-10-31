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
const txt=s=>pg.evaluate(s=>document.querySelector(s).innerText.replace(/\n+/g," | "),s);
console.log("CAD filtros:",await txt("#cFilt"));
console.log("CAD duplicados:",await pg.evaluate(()=>[...document.querySelectorAll(".cadrow")].filter(r=>r.querySelector(".duptxt")).map(r=>r.querySelector("b").textContent+" → "+r.querySelector(".duptxt").textContent)));
await pg.screenshot({path:"/tmp/rev1.png"});
// marcar MAMAO para revisar e filtrar
await pg.evaluate(()=>{const b=[...document.querySelectorAll(".cadrow")].find(r=>r.querySelector("b").textContent==="MAMAO").querySelector("[data-crev]");b.click()});await pg.waitForTimeout(300);
console.log("CAD após marcar:",await txt("#cFilt"));
await pg.click('#cFilt [data-f="rev"]');await pg.waitForTimeout(200);console.log("filtro revisar:",await pg.evaluate(()=>[...document.querySelectorAll(".cadrow b")].map(b=>b.textContent)));
await pg.click('#cFilt [data-f="rev"]');await pg.click('#cFilt [data-f="dup"]');await pg.waitForTimeout(200);console.log("filtro repetidos:",await pg.evaluate(()=>[...document.querySelectorAll(".cadrow b")].map(b=>b.textContent)));
// etiquetas
await pg.evaluate(()=>document.getElementById("navEtiquetas").click());await pg.waitForTimeout(500);
console.log("ETQ filtros:",await txt("#eFilt"));
console.log("ETQ linhas:",await pg.evaluate(()=>[...document.querySelectorAll("#eLista .crl")].map(e=>e.innerText.replace(/\n+/g," | "))));
await pg.screenshot({path:"/tmp/rev2.png"});
// modal: marcar UVA ROXA
await pg.evaluate(()=>{const r=[...document.querySelectorAll("#eLista .crw")].find(e=>e.innerText.includes("UVA ROXA"));r.click()});await pg.waitForTimeout(300);
console.log("modal:",await txt("#lmCod"),"|",await txt("#lmRev"));
await pg.click("#lmRev");await pg.waitForTimeout(300);console.log("modal depois:",await txt("#lmRev"),"| linha:",await pg.evaluate(()=>[...document.querySelectorAll("#eLista .crw")].map(e=>e.classList.contains("rv")+":"+e.querySelector(".cname").textContent)));
console.log("erros",errs);await br.close();srv.close();
