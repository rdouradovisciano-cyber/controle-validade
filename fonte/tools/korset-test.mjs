import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("Renato"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","KÓRIN");
localStorage.setItem("validamais-produtos-v1",JSON.stringify(["Coxa e sobrecoxa","Mamão papaya","Filé de peito","Banana prata"].map((n,i)=>({id:"p"+i,name:n,barcode:"789000"+i,quantity:"1",expiry:"",category:"FLV"}))));
localStorage.setItem("validamais-contagem-kor",JSON.stringify([{n:"Coxa e sobrecoxa",b:"",q:10,u:"un"},{n:"Filé de peito",b:"",q:5,u:"un"}]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
const lista=async()=>pg.evaluate(()=>[...document.querySelectorAll("#cLista .cadrow b")].map(b=>b.textContent));
await pg.evaluate(()=>document.getElementById("tbCadastros").click());await pg.waitForTimeout(400);
console.log("KÓRIN antes de escolher:",await lista());
await pg.click("#cKorEsc");await pg.waitForTimeout(300);
console.log("pré-marcados:",await pg.evaluate(()=>[...document.querySelectorAll("#korEscModal input:checked")].map(i=>i.nextElementSibling.textContent)));
await pg.screenshot({path:SP+"korpick.png"});
await pg.click("#kqSalva");await pg.waitForTimeout(500);
console.log("KÓRIN depois:",await lista());
// cadastrar novo em KÓRIN
await pg.fill("#cNome","Peru inteiro");await pg.click("#cSalvar");await pg.waitForTimeout(500);
console.log("após cadastrar:",await lista());
// FLV não deve ter os do KÓRIN
await pg.evaluate(()=>document.querySelector('#setorChip [data-s="FLV"]').click());await pg.waitForTimeout(600);
await pg.evaluate(()=>document.getElementById("tbCadastros")&&document.getElementById("navCadastros").click());await pg.waitForTimeout(400);
console.log("FLV:",await lista());
console.log(errs);await br.close();srv.close();
