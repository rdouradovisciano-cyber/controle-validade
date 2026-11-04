import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)&&q.url.startsWith("/vendor.js"))f="/home/claude/controle-validade/vendor.js";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!f.endsWith("vendor.js"))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const dt=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
for(const [perfil,setor] of [["Perecíveis",null],["FLV",null],["Admin","KÓRIN"],["Admin","FLV"]]){
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[],cons=[];pg.on("pageerror",e=>errs.push(e.message));pg.on("console",m=>{if(m.type()==="error")cons.push(m.text().slice(0,140))});
await pg.addInitScript(([p,s,e])=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil",p);if(s)sessionStorage.setItem("validamais-setor",s);
localStorage.setItem("validamais-produtos-v1",JSON.stringify(["Queijo","Presunto","Peito"].map((n,i)=>({id:"p"+i,name:n,barcode:"78900"+i,quantity:"1",expiry:e[i],category:p==="FLV"||s==="FLV"?"FLV":"Perecíveis",codigo_balanca:i?"":"123"}))))},[perfil,setor,[dt(-1),dt(2),dt(9)]]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
const tabs=await pg.evaluate(()=>[...document.querySelectorAll("nav.tabbar button")].filter(b=>b.offsetParent).map(b=>b.id));
for(const t of tabs){await pg.click("#"+t).catch(e=>errs.push("click "+t+": "+e.message.slice(0,60)));await pg.waitForTimeout(400);}
const menu=await pg.evaluate(()=>{document.getElementById("moreBtn").click();return [...document.querySelectorAll("#moreMenu button")].filter(b=>b.offsetParent).map(b=>b.id)});
for(const m of menu){if(["mnTema","mnInstall"].includes(m))continue;await pg.evaluate(()=>{const mm=document.getElementById("moreMenu");if(mm.classList.contains("hidden"))document.getElementById("moreBtn").click()});await pg.evaluate(id=>document.getElementById(id).click(),m);await pg.waitForTimeout(400);
 await pg.evaluate(()=>{document.querySelectorAll(".modal:not(.hidden) [data-x],.askbg [data-x],#perfilBg").forEach(b=>b.click());document.querySelectorAll("#erroModal,#saudeModal,#atvModal,#visModal,#perfilBg,.askbg").forEach(e=>e.remove())});}
console.log(perfil,setor||"","abas:",tabs.join(","),"| menu:",menu.length,"| erros:",errs.length?errs:"nenhum","| console:",cons.length?cons:"-");await pg.context().close();}
await br.close();srv.close();
