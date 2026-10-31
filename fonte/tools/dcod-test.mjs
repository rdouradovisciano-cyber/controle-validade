import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const P=(id,name,o)=>({id,name,barcode:"",category:"FLV",quantity:1,expiry:"",...o});
await pg.addInitScript(p=>{sessionStorage.setItem("validamais-setor","FLV");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));
localStorage.setItem("validamais-doacao",JSON.stringify({itens:[{key:"a|un",nome:"TOMATE GRAPE 800G",unidade:"un",qtd:3,lanc:1},{key:"b|un",nome:"TOMATE CANO 180G",unidade:"un",qtd:1,lanc:1},{key:"c|un",nome:"LIMAO TAITI 1KG",unidade:"un",qtd:1,lanc:1},{key:"d|kg",nome:"BANANA",unidade:"kg",qtd:2,lanc:1}]}))},
[P("1","TOMATE GRAPE 800G",{codigo_balanca:"246866"}),P("2","TOMATE CANO 180G",{barcode:"7898714461230",codigo_balanca:"111"}),P("3","LIMAO TAITI 1KG",{codigo_balanca:"123115",codigo_doacao:"L1"}),P("4","BANANA",{codigo_balanca:"5",codigo_doacao:"B2"})]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
console.log(await pg.evaluate(()=>[...document.querySelectorAll("#dLista .ditem")].map(r=>r.innerText.replace(/\n+/g," | "))),errs);await br.close();srv.close();
