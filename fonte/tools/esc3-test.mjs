import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","BENASSI");localStorage.setItem("validamais-escala-vista",JSON.stringify("cal"));localStorage.setItem("validamais-produtos-v1","[]");
// config antiga já salva (com o ciclo antigo): deve migrar para o novo
localStorage.setItem("validamais-escala-cfg",JSON.stringify({ini:"2026-11-08",dia:504,int:60,meta:2520,p:{r:{n:"Renato",full:"Renato Dourado Visciano",foto:"",ent:660},y:{n:"Yossef",full:"",foto:"",ent:420}},ciclo:{r:["FTTFTTT","TTFFTTT","FTTFTTT"],y:["TTFTFTT","FTTTFTT","TTFFTTT"]}}))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
const mes=()=>pg.innerText(".enav b");
while(!(await mes()).includes("Novembro de 2026")){await pg.click((await mes()).includes("2027")||/Dezembro|Janeiro/.test(await mes())?'[data-em="-1"]':'[data-em="1"]');}
await pg.screenshot({path:SP+"e3-a.png"});
let bad=[];for(const m of ["Novembro de 2026","Dezembro de 2026","Janeiro de 2027"]){while(!(await mes()).includes(m))await pg.click('[data-em="1"]');bad.push(m+": alerta="+await pg.isVisible(".ealert"));}
console.log(bad.join(" | "));
while(!(await mes()).includes("Novembro de 2026"))await pg.click('[data-em="-1"]');
await pg.click('.pl.r[data-ek="2026-11-12"]');await pg.waitForTimeout(200);console.log("1 toque abriu janela:",await pg.isVisible(".efc"),"| texto:",(await pg.innerText(".askbg")).replace(/\n/g," ").slice(0,80));
await pg.screenshot({path:SP+"e3-b.png"});
await pg.click('[data-ed="F"]');await pg.waitForTimeout(300);console.log("depois de marcar folga, alerta:",await pg.isVisible(".ealert"),"|",(await pg.locator(".ealert").innerText().catch(()=>"")).replace(/\n/g," "));
console.log(errs);await br.close();srv.close();
