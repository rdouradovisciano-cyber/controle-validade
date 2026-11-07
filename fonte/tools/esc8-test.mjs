import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Renato"));localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-escala-vista",JSON.stringify("cal"));
localStorage.setItem("validamais-escala-cfg",JSON.stringify({ciclo:{r:["FTTFTTT","TTFFTTT"],y:["TTFTFTT","FTTTFTT"]}}))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5000);
await pg.evaluate(()=>document.getElementById("mnEscala").click());await pg.waitForTimeout(500);
while(!(await pg.innerText(".enav b")).includes("Novembro de 2026")){await pg.click('[data-em="1"]');}
console.log(await pg.evaluate(()=>[...document.querySelectorAll(".etb tbody tr")].map(tr=>[...tr.querySelectorAll("td.ec:not(.es)")].map(td=>[...td.querySelectorAll(".pl")].map(b=>b.textContent.trim()[0]==="f"?"F":"T").join("")).join(" "))),errs);
await pg.screenshot({path:SP+"esc8.png"});await br.close();srv.close();
