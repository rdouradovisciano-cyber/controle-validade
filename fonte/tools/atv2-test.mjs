import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("Renato"));localStorage.setItem("validamais-perfil","Admin");
const now=Date.now(),h=3600e3;const l=[];[0.2,1,3,8,15,16].forEach(x=>l.push({t:now-x*h,a:"entrou",quem:"Renato",txt:"Abriu o app",perfil:"Admin",setor:"FLV"}));l.push({t:now-2*h,a:"retirou",quem:"Renato",txt:"Queijo",perfil:"Admin",setor:"Perecíveis"});l.push({t:now-30*h,a:"entrou",quem:"Renato",txt:"Abriu o app",perfil:"Admin",setor:"FLV"});l.push({t:now-31*h,a:"entrou",quem:"Renato",txt:"Abriu o app",perfil:"Admin",setor:"FLV"});
localStorage.setItem("validamais-atv",JSON.stringify(l))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2000);
await pg.click("#moreBtn");await pg.click("#mnAtv");await pg.waitForTimeout(500);
console.log((await pg.innerText("#atvL")).replace(/\n+/g," / "));
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/atv2.png"});console.log(errs);await br.close();srv.close();
