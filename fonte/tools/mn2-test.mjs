import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));if(!localStorage.getItem("validamais-perfil"))localStorage.setItem("validamais-perfil","Perecíveis")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
const v=async s=>await pg.locator(s).isVisible();
const vis=async()=>pg.evaluate(()=>[...document.querySelectorAll("#moreMenu [role=menuitem]")].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join(" | "));
await pg.click("#moreBtn");console.log("Perecíveis:",await vis());
await pg.evaluate(()=>{localStorage.setItem("validamais-perfil","Admin")});await pg.reload();await pg.waitForTimeout(1200);await pg.click("#moreBtn");console.log("Admin:",await vis(),"| perfil body:",await pg.evaluate(()=>document.body.dataset.perfil+"/"+localStorage.getItem("validamais-perfil")));
console.log("erros",errs);await br.close();srv.close();
