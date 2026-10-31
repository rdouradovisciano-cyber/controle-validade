import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},deviceScaleFactor:2,acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{sessionStorage.setItem("validamais-setor","KÓRIN");localStorage.setItem("validamais-operador",JSON.stringify("Renato admin"));if(!localStorage.getItem("validamais-produtos-v1"))localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"1",name:"PIZZA CALABRESA",barcode:"7891234567895",category:"Congelados",quantity:1,expiry:""},{id:"2",name:"PAO DE QUEIJO",barcode:"7890000000017",category:"Congelados",quantity:1,expiry:""},{id:"3",name:"BANANA",barcode:"",category:"FLV",quantity:1,expiry:""}]))});
await pg.addInitScript(()=>{window.__sh=null;Object.defineProperty(navigator,"share",{value:async d=>{window.__sh=d},configurable:true})});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1800);
console.log("tabs:",await pg.evaluate(()=>[...document.querySelectorAll(".tabbar button")].filter(b=>getComputedStyle(b).display!=="none").map(b=>b.querySelector(".tl").textContent)));
await pg.evaluate(()=>document.getElementById("tbContagem").click());await pg.waitForTimeout(300);
await pg.fill("#kBusca","piz");await pg.waitForTimeout(200);console.log("sugestões:",await pg.evaluate(()=>[...document.querySelectorAll("#kSug .pick")].map(p=>p.textContent)));
await pg.click('#kSug [data-kp="0"]');await pg.fill("#kQtd","3");await pg.click("#kAdd");
await pg.fill("#kBusca","piz");await pg.click('#kSug [data-kp="0"]');await pg.fill("#kQtd","2,5");await pg.click("#kAdd");
await pg.fill("#kBusca","sorvete");await pg.click('#kSug [data-kp="novo"]');await pg.selectOption("#kUn","cx");await pg.fill("#kQtd","4");await pg.press("#kQtd","Enter");
await pg.fill("#kBusca","pao");await pg.click('#kSug [data-kp="0"]');await pg.fill("#kQtd","10");await pg.click("#kAdd");
console.log("lista:",await pg.evaluate(()=>[...document.querySelectorAll(".krow")].map(r=>r.innerText.replace(/\n+/g," | "))),await pg.evaluate(()=>[kSumP.textContent,kSumT.textContent]));
await pg.screenshot({path:"/tmp/cont1.png"});
await pg.click("#kZap");await pg.waitForTimeout(300);console.log(await pg.evaluate(()=>window.__sh&&window.__sh.text));
await pg.evaluate(()=>{Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true})});
const dl=pg.waitForEvent("download",{timeout:8000});await pg.click("#kPdf");const d=await dl.catch(()=>null);console.log("jsPDF:",await pg.evaluate(()=>[typeof window.V,window.V&&typeof window.V.jsPDF,window.V&&typeof window.V.autoTable]),"toast:",await pg.evaluate(()=>document.getElementById("toast").textContent));if(d){await d.saveAs("/tmp/cont.pdf");console.log("pdf:",d.suggestedFilename(),fs.statSync("/tmp/cont.pdf").size)}
await pg.reload();await pg.waitForTimeout(1500);await pg.evaluate(()=>document.getElementById("tbContagem").click());console.log("persistiu:",await pg.evaluate(()=>document.querySelectorAll(".krow").length));
console.log("erros",errs);await br.close();srv.close();
