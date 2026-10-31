import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:390,height:800}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const prods=[{id:"a",name:"PIMENTA CAMBUCI 250G",barcode:"7891234567895",codigo_balanca:"164465",category:"FLV",quantity:1,expiry:"2026-12-01"},
{id:"b",name:"PIMENTA DE CHEIRO",barcode:"4898765078749",codigo_balanca:"1234",codigo_doacao:"B7",category:"FLV",quantity:1,expiry:"2026-12-01"},
{id:"c",name:"PIMENTA SEM EAN",barcode:"",codigo_balanca:"555111",codigo_doacao:"D9",category:"FLV",quantity:1,expiry:"2026-12-01"},{id:"d",name:"SO DOACAO",barcode:"",codigo_doacao:"Z1",category:"FLV",quantity:1,expiry:"2026-12-01"}];
const labels=[{nome:"PIMENTA CAMBUCI 250G",code:"164465",orig:"164465",kg:true,tam:"M",key:"pimenta cambuci 250g",qtd:1},{nome:"PIMENTA DE CHEIRO",code:"4898765078749",orig:"4898765078749",kg:false,tam:"M",key:"4898765078749",qtd:1},{nome:"PIMENTA SEM EAN",code:"555111",orig:"555111",kg:true,tam:"M",key:"pimenta sem ean",qtd:1},{nome:"PIMENTA SEM EAN",code:"",orig:"",plu:"555111",kg:false,tam:"M",key:"x2",qtd:1}];
await pg.addInitScript(([p,l])=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));localStorage.setItem("validamais-etiquetas",JSON.stringify(l))},[prods,labels]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1000);
await pg.evaluate(()=>document.getElementById("navEtiquetas").click());await pg.waitForTimeout(500);
console.log(await pg.evaluate(()=>[...document.querySelectorAll("#eLista .crl")].map(e=>e.innerText.replace(/\n/g," | "))));
console.log("salvo:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-etiquetas")).map(l=>[l.code,l.kg])));
// adicionar pela busca: produto FLV com balança deve entrar com EAN
await pg.fill("#eBusca","cambuci");await pg.waitForTimeout(500);console.log("busca:",await pg.evaluate(()=>document.getElementById("eRes").innerText.replace(/\n/g," | ").slice(0,200)));
await pg.screenshot({path:"/tmp/etq_ean.png"});console.log("erros",errs);await br.close();srv.close();
