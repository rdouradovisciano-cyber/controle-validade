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
console.log("botão ＋ visível:",await pg.isVisible("#manualOpen"),"| bipar visível:",await pg.isVisible("#fab"));
await pg.click("#moreBtn");await pg.waitForTimeout(300);console.log("menu tem Cadastro manual:",await pg.isVisible("#mnManual"));await pg.screenshot({path:SP+"mncad.png"});
await pg.click("#mnManual");await pg.waitForTimeout(400);console.log("formulário aberto:",await pg.isVisible("#productForm"),"| título:",await pg.innerText("#modalTitle"),"| menu fechou:",!(await pg.isVisible("#moreMenu")));
console.log(errs);await br.close();srv.close();
