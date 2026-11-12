import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]), SHOT=process.argv[3];
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const perfil of ["Perecíveis","FLV"]){
const ctx=await br.newContext({viewport:{width:390,height:860},deviceScaleFactor:2});
await ctx.addInitScript(pf=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil",pf);},perfil);
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(4500);
const total=await pg.evaluate(()=>(document.querySelector(".tr-n")||{}).textContent);
console.log(perfil,"abriu sozinho:",total);
const tit=[];for(let k=0;k<14;k++){const h=await pg.evaluate(()=>{const c=document.querySelector(".tr-card h3");return c&&c.textContent});if(!h)break;tit.push(h);
 if(k===1||k===3)await pg.screenshot({path:`${SHOT}/tour-${perfil[0]}${k}.png`});
 await pg.click(".tr-next");await pg.waitForTimeout(350)}
console.log(JSON.stringify(tit));
console.log("fechou:",!(await pg.$(".tr-ov")),"visto:",await pg.evaluate(()=>localStorage.getItem("validamais-tour-v1")));
await pg.reload();await pg.waitForTimeout(4000);console.log("reabre sozinho?",!!(await pg.$(".tr-ov")));
await pg.click("#moreBtn");await pg.click("#mnTour");await pg.waitForTimeout(600);console.log("replay pelo menu:",!!(await pg.$(".tr-ov")));
await pg.keyboard.press("Escape");console.log("esc fecha:",!(await pg.$(".tr-ov")),JSON.stringify(errs));await ctx.close()}
await br.close();srv.close();
