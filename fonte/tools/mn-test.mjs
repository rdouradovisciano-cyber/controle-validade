import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
const v=async s=>await pg.locator(s).isVisible();
console.log("topo -> verTodos:",await v("#verTodos"),"verRet:",await v("#verRet"));
await pg.click("#moreBtn, [aria-label='Mais opções'], .morebtn").catch(async()=>{await pg.evaluate(()=>document.querySelector("#moreMenu").classList.remove("hidden"))});
console.log("menu:",await v("#mnRet"),await v("#mnTodos"),"|",await pg.textContent("#mnRetT"),"|",await pg.textContent("#mnTodosT"));
await pg.click("#mnRet");await pg.waitForTimeout(300);console.log("retirados -> verRet (voltar):",await v("#verRet"),await pg.textContent("#verRet"));
await pg.click("#verRet");await pg.waitForTimeout(300);console.log("voltou -> verRet:",await v("#verRet"));
console.log("erros",errs);await br.close();srv.close();
