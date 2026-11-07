import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Renato"));localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-tema","light");
const t=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)};
localStorage.setItem("validamais-flores",JSON.stringify([{id:"a",nome:"Orquídea da sala",k:"phal",d:7,loc:"sala",ult:t(-9),add:t(-20),foto:"",hist:[]},{id:"b",nome:"Samambaia",k:"samb",d:3,loc:"varanda",ult:t(-3),add:t(-9),foto:"",hist:[]},{id:"c",nome:"Cacto",k:"cact",d:21,loc:"",ult:t(-2),add:t(-5),foto:"",hist:[]}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
console.log("menu visível:",await pg.evaluate(()=>getComputedStyle(document.getElementById("mnFlores")).display));
await pg.evaluate(()=>document.getElementById("mnFlores").click());await pg.waitForTimeout(400);await pg.screenshot({path:SP+"fl1.png"});
await pg.click('[data-flr="a"]');await pg.waitForTimeout(300);console.log("depois de regar:",await pg.innerText('[data-fl="a"] .fls'));
await pg.click("#flAdd");await pg.waitForTimeout(300);await pg.selectOption("#flFk","bego");await pg.waitForTimeout(200);await pg.screenshot({path:SP+"fl2.png"});
await pg.click("#flFs");await pg.waitForTimeout(300);console.log("total:",await pg.locator(".flc").count(),errs);
await br.close();srv.close();
