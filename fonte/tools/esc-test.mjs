import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function run(perfil){
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(p=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil",p);localStorage.setItem("validamais-produtos-v1","[]")},perfil);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);return {pg,errs};}
let {pg,errs}=await run("BENASSI");
console.log("BENASSI abre direto:",await pg.isVisible("#escV"),"| botão:",await pg.innerText("#escX"),"| células editáveis:",await pg.locator("[data-ek]").count());
await pg.evaluate(()=>{});
// vai para novembro 2026 simulando navegação
await pg.screenshot({path:SP+"esc-ben.png"});
({pg,errs}=await run("Perecíveis"));console.log("Perecíveis vê item de menu:",await (async()=>{await pg.click("#moreBtn");return pg.isVisible("#mnEscala")})());
({pg,errs}=await run("Admin"));await pg.click("#moreBtn");console.log("Admin vê item:",await pg.isVisible("#mnEscala"));await pg.click("#mnEscala");await pg.waitForTimeout(300);
console.log("overlay:",await pg.isVisible("#escV"),"| editáveis:",await pg.locator("[data-ek]").count());
// ir ao mês 11/2026 ou mostrar o atual
const mes=(await pg.innerText(".enav b"));console.log("mês:",mes);
const c=pg.locator(".pl.r[data-ek]").nth(3);const antes=await c.innerText();await c.click();console.log("toque:",antes.replace(/\n/g," "),"->",(await pg.locator(".pl.r[data-ek]").nth(3).innerText()).replace(/\n/g," "),"| resumo semana:",(await pg.locator(".es").first().innerText()).replace(/\n/g," "));
await pg.screenshot({path:SP+"esc-adm.png"});
console.log(errs);await br.close();srv.close();
