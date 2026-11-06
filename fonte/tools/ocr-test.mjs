import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");sessionStorage.setItem("validamais-setor","Perecíveis");localStorage.setItem("validamais-produtos-v1","[]")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(400);
await pg.setInputFiles("#cFotoIn",SP+"rotulo.jpg");
await pg.waitForFunction(()=>!/Lendo/.test(document.getElementById("cFotoSt")?.textContent||"Lendo"),null,{timeout:90000}).catch(()=>{});
console.log("status:",await pg.innerText("#cFotoSt"),"| nome:",await pg.inputValue("#cNome"),"| opções:",await pg.locator("#cFotoOp button").allInnerTexts());
await pg.screenshot({path:SP+"ocr.png"});
await pg.click("#cSalvar");await pg.waitForTimeout(1200);
console.log("produto:",await pg.evaluate(()=>JSON.parse(localStorage.getItem("validamais-produtos-v1")).map(p=>p.name)),"| foto salva:",await pg.evaluate(()=>{const m=JSON.parse(localStorage.getItem("validamais-fotos-per")||"{}");return Object.keys(m).map(k=>k+":"+m[k].length)}));
console.log(errs);await br.close();srv.close();
