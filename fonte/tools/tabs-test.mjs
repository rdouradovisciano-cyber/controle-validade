import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
const tabs=()=>pg.evaluate(()=>[...document.querySelectorAll(".tabbar button")].filter(b=>getComputedStyle(b).display!=="none").sort((a,b)=>(+getComputedStyle(a).order)-(+getComputedStyle(b).order)).map(b=>b.querySelector(".tl").textContent));
console.log("abas PER:",await tabs());await pg.click("#tbPesaveis");await pg.waitForTimeout(300);console.log("aba:",await pg.evaluate(()=>document.body.dataset.tab));console.log("erros",errs);await br.close();srv.close();
