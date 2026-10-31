import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},hasTouch:true});const pg=await ctx.newPage();
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-dbal",JSON.stringify(["Tropical","Melão","Maçã","Tomate","Legume","Limão"].map(w=>({w,v:[{n:w+" A",c:"",u:"kg"},{n:w+" B",c:"",u:"kg"}]}))))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(900);
const swipe=async(x1,y,x2)=>{await pg.evaluate(([x1,y,x2])=>{const mk=(type,x)=>{const t=new Touch({identifier:1,target:document.elementFromPoint(x1,y),clientX:x,clientY:y});return new TouchEvent(type,{touches:type==="touchend"?[]:[t],changedTouches:[t],bubbles:true,cancelable:true})};
const el=document.elementFromPoint(x1,y);el.dispatchEvent(mk("touchstart",x1));el.dispatchEvent(mk("touchend",x2))},[x1,y,x2]);await pg.waitForTimeout(300)};
const aba=()=>pg.evaluate(()=>document.body.dataset.tab);
console.log("antes:",await aba());
const y=await pg.evaluate(()=>{const r=document.getElementById("dT6").getBoundingClientRect();return Math.round(r.top+r.height/2)});
await swipe(330,y,60);console.log("deslizar nos atalhos →",await aba(),"(deve continuar Doacao)");
await swipe(330,300,60);console.log("deslizar no resto da tela →",await aba(),"(deve mudar)");
await br.close();srv.close();
