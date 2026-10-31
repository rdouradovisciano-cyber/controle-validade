import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("seeded"))return;localStorage.setItem("seeded","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");
const P=(i,n,b,d)=>({id:""+i,name:n,category:"Perecíveis",barcode:"",codigo_balanca:b,codigo_doacao:d,expiry:"",quantity:1});
localStorage.setItem("validamais-produtos-v1",JSON.stringify([P(1,"BACALHAU COD MORHUA KG","8853","253626"),P(2,"BACON DE PERNIL ESPECIAL ALEGRA KG","41546","131662"),P(3,"BACON FRACIONADO PERDIGÃO KG","60172","151212"),P(4,"BACON MANTA 1KG FRIMESA","84697","133893"),P(5,"PRESUNTO COZIDO SADIA KG","11111","INT05"),P(6,"QUEIJO MUSSARELA FATIADO KG","22222","222333")]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.click("#tbPesaveis");await pg.waitForTimeout(300);
console.log("hero removido:",await pg.locator(".peshero, #pesCount").count()===0);
const q=async t=>{await pg.fill("#pesBusca",t);await pg.waitForTimeout(150);console.log(JSON.stringify(t).padEnd(22),"→",await pg.evaluate(()=>document.getElementById("pesInfo").textContent+" | "+[...document.querySelectorAll(".pesrow .pesn > b")].map(b=>b.textContent.slice(0,22)).join(" ; ")))};
for(const t of ["","bacon","bacn","frimesa bacon","perdigao","8853","6017","1212","int05","kg mussarela","presunto sadya","zzzz","bac 1kg"])await q(t);
await pg.fill("#pesBusca","bacon frimesa");await pg.waitForTimeout(150);console.log("mark:",await pg.evaluate(()=>document.querySelector(".pesrow .pesn > b").innerHTML));
console.log("erros",errs);await br.close();srv.close();
