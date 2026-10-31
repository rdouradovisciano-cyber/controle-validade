import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1800);
await pg.click("#moreBtn");console.log("menu:",(await pg.locator("#moreMenu button:visible").allInnerTexts()).join(" | "));
await pg.click("#moreBg",{position:{x:5,y:600}});
await pg.click("#tbDoacao");await pg.waitForTimeout(400);
console.log("histSec visível:",await pg.locator("#histSec").isVisible(),"aberto:",await pg.evaluate(()=>document.getElementById("histBox").open));
await pg.click("#histBox summary");await pg.waitForTimeout(400);console.log("aberto após toque:",await pg.evaluate(()=>document.getElementById("histBox").open),"erros",errs);
await br.close();srv.close();
