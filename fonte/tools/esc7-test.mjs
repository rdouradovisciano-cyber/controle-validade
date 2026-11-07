import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","BENASSI");localStorage.setItem("validamais-escala-vista",JSON.stringify("cal"));localStorage.setItem("validamais-produtos-v1","[]");
const cv=document.createElement("canvas");cv.width=cv.height=160;const g=cv.getContext("2d");g.fillStyle="#7a5";g.fillRect(0,0,160,160);g.fillStyle="#fc9";g.beginPath();g.arc(80,70,40,0,7);g.fill();
localStorage.setItem("validamais-escala-cfg",JSON.stringify({p:{r:{n:"Renato",full:"Renato Dourado Visciano",foto:cv.toDataURL("image/jpeg"),ent:660},y:{n:"Yossef",full:"Yossef Henrique da Silva",foto:"",ent:420}}}))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
while(!(await pg.innerText(".enav b")).includes("Novembro de 2026")){await pg.click('[data-em="1"]');}
await pg.click('[data-em="1"]');console.log("classe de deslize ao avançar mês:",await pg.evaluate(()=>document.querySelector(".ecard").className));await pg.waitForTimeout(500);console.log("depois:",await pg.evaluate(()=>document.querySelector(".ecard").className));await pg.click('[data-em="-1"]');
await pg.waitForTimeout(600);await pg.screenshot({path:SP+"e7-cal.png"});console.log("animação no hoje:",await pg.evaluate(()=>{const e=document.querySelector(".ec.hoje");return e?getComputedStyle(e).animationName:"(hoje não está neste mês)"}));
await pg.click("#escFs");await pg.waitForTimeout(500);console.log("tela cheia ativa:",await pg.isVisible("#escFx"),"| tabela visível:",await pg.isVisible(".escFull .etb"));await pg.screenshot({path:SP+"e4-full.png"});
await pg.click("#escFx");await pg.waitForTimeout(300);console.log("saiu:",!(await pg.isVisible("#escFx")),"| abas de volta:",await pg.isVisible("#escSh"));
const [dl]=await Promise.all([pg.waitForEvent("download"),pg.click("#escSh")]);await dl.saveAs(SP+"escala.png");console.log("arquivo:",dl.suggestedFilename());
console.log(errs);await br.close();srv.close();
