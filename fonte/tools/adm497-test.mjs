import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]);
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});

const rodar=async(perfil,taps)=>{
 const ctx=await br.newContext({viewport:{width:390,height:860}});
 await ctx.addInitScript(pf=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));if(pf)localStorage.setItem("validamais-perfil",pf);},perfil);
 const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,100)));
 await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3000);
 const ops=()=>pg.$$eval("#perfilBg .perfop b",b=>b.map(x=>x.textContent).join("+"));
 let r=perfil===null?"1ª vez: "+await ops():"";
 if(taps){for(let k=0;k<taps;k++){await pg.evaluate(()=>document.getElementById("appVer").click());await pg.waitForTimeout(80)};await pg.waitForTimeout(300);r+="10 toques: "+await ops()}
 console.log((perfil||"sem perfil")+" -> "+r+" "+JSON.stringify(errs));await ctx.close()};
await rodar(null,0);await rodar("Perecíveis",10);await rodar("Admin",10);
await br.close();srv.close();
