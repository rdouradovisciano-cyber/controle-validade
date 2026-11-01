import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},hasTouch:true,isMobile:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{window.__v=[];navigator.vibrate=n=>{window.__v.push(n);return true};localStorage.setItem("validamais-operador",JSON.stringify("T"));if(!localStorage.getItem("validamais-perfil"))localStorage.setItem("validamais-perfil","Perecíveis")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
await pg.tap("#moreBtn");await pg.waitForTimeout(200);
console.log("vibrou ao tocar no menu:",await pg.evaluate(()=>window.__v));
await pg.tap("#mnVis");await pg.waitForTimeout(300);
await pg.evaluate(()=>{window.__v=[]});await pg.uncheck("#vsVib");console.log("após desligar:",await pg.evaluate(()=>[window.__v,localStorage.getItem("validamais-vibra")]));
await pg.evaluate(()=>{window.__v=[]});await pg.tap("#vsSalva");await pg.waitForTimeout(300);console.log("tocar com vibração desligada:",await pg.evaluate(()=>window.__v));
console.log("erros",errs);await br.close();srv.close();
