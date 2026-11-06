import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");sessionStorage.setItem("validamais-setor","Perecíveis");
localStorage.setItem("validamais-produtos-v1",JSON.stringify([
{id:"1",name:"COXA IQF 700g",barcode:"7891111111111",quantity:"2",expiry:"2026-11-20",category:"Perecíveis"},
{id:"4",name:"Salsicha Viena",barcode:"",quantity:"5",expiry:"",category:"Perecíveis"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(400);
const n=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).length);
await pg.fill("#cNome","Coxa IQF 700 g");console.log("aviso:",await pg.isVisible("#cSim"),(await pg.innerText("#cSim")).replace(/\n/g," "));
await pg.screenshot({path:SP+"sim.png"});
await pg.click("#cSalvar");console.log("1º clique -> total",await n(),"(esperado 2)");
await pg.click("#cSalvar");await pg.waitForTimeout(300);console.log("2º clique -> total",await n(),"(esperado 3)");
await pg.fill("#cNome","Maçã Fuji");console.log("sem parecido, aviso:",await pg.isVisible("#cSim"));
await pg.fill("#cNome","Coxa IQF 700g");await pg.click('#cSim [data-sim]');await pg.waitForTimeout(200);console.log("usar esse -> título:",await pg.innerText("#cTitulo"),"| nome:",await pg.inputValue("#cNome"),"| aviso:",await pg.isVisible("#cSim"));
console.log(errs);await br.close();srv.close();
