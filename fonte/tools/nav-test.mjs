import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const setor of ["FLV","Perecíveis"]){
const pg=await br.newPage({viewport:{width:411,height:860}});
await pg.addInitScript(s=>{sessionStorage.setItem("validamais-setor",s);localStorage.setItem("validamais-operador",JSON.stringify("T"))},setor);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
const t=()=>pg.evaluate(()=>document.body.dataset.tab);
await pg.evaluate(()=>document.getElementById("tbEtiquetas").click());await pg.waitForTimeout(200);console.log(setor,"etq:",await t());
await pg.evaluate(()=>document.getElementById("navCadastros").click());await pg.waitForTimeout(200);console.log(setor,"navCad:",await t());
await pg.evaluate(()=>document.getElementById("tbLoja").click());await pg.waitForTimeout(200);console.log(setor,"loja:",await t());
await pg.evaluate(()=>document.getElementById("mnCad").click());await pg.waitForTimeout(200);console.log(setor,"mnCad:",await t());
}
await br.close();srv.close();
