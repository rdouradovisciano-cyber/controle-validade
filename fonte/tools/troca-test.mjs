import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2200);
const st=()=>pg.evaluate(()=>({setor:document.body.dataset.setor,tab:document.body.dataset.tab,esc:!!document.getElementById("setorEsc")}));
console.log("abertura:",await st());await pg.screenshot({path:"/tmp/tr0.png",clip:{x:0,y:0,width:411,height:140}});
await pg.click('#setorChip [data-s="Perecíveis"]');await pg.waitForTimeout(1500);console.log("após trocar:",await st());await pg.screenshot({path:"/tmp/tr1.png",clip:{x:0,y:0,width:411,height:140}});
await pg.evaluate(()=>document.getElementById("mnSetor").click());await pg.waitForTimeout(1500);console.log("pelo menu:",await st());
console.log("erros",errs);await br.close();srv.close();
