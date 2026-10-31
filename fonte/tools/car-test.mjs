import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const nomes=["Tropical","Melão","Maçã","Tomate","Legume","Limão","Banana","Uva","Batata"];
await pg.addInitScript(n=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-dbal",JSON.stringify(n.map(w=>({w,v:[{n:w+" A",c:"",u:"kg"},{n:w+" B",c:"",u:"kg"}]}))))},nomes);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(900);
const info=()=>pg.evaluate(()=>{const r=document.getElementById("dT6"),d=document.getElementById("dT6dots");return{car:r.classList.contains("car"),disp:getComputedStyle(r).display,sw:r.scrollWidth,cw:r.clientWidth,sl:Math.round(r.scrollLeft),dots:d?d.querySelectorAll("s").length:0,on:d?[...d.querySelectorAll("s")].findIndex(s=>s.classList.contains("on")):-1,h:Math.round(document.getElementById("dDock").getBoundingClientRect().height)}});
console.log("inicial",JSON.stringify(await info()));await pg.screenshot({path:"/tmp/car1.png"});
await pg.evaluate(()=>{const r=document.getElementById("dT6");r.scrollLeft=r.scrollWidth});await pg.waitForTimeout(400);
console.log("rolado ",JSON.stringify(await info()));await pg.screenshot({path:"/tmp/car2.png"});
// abrir atalho (variantes) e voltar: mantém posição
await pg.evaluate(()=>document.querySelectorAll("#dT6 button")[7].click());await pg.waitForTimeout(250);
console.log("variantes",JSON.stringify(await info()));
await pg.evaluate(()=>document.querySelector("[data-tback]").click());await pg.waitForTimeout(250);
console.log("voltou ",JSON.stringify(await info()));
// edição = grade
await pg.evaluate(()=>document.getElementById("dBalEdit").click());await pg.waitForTimeout(250);
console.log("editar ",JSON.stringify(await info()));await pg.screenshot({path:"/tmp/car3.png"});
await pg.evaluate(()=>document.getElementById("dBalEdit").click());await pg.waitForTimeout(250);
console.log("concluir",JSON.stringify(await info()));
console.log("erros",errs);await br.close();srv.close();
