import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
const ctx=await br.newContext({viewport:{width:411,height:860},permissions:["camera"]});const url=`http://localhost:${srv.address().port}/`;
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis")});
await pg.goto(url);await pg.waitForTimeout(1500);
await pg.addInitScript(()=>{window.Html5QrcodeSupportedFormats={EAN_13:1,EAN_8:2,UPC_A:3,UPC_E:4,CODE_128:5,CODE_39:6,ITF:7};window.Html5Qrcode=function(){this.start=()=>Promise.reject(new Error("sem câmera"));this.stop=()=>Promise.resolve();this.clear=()=>{}};});await pg.reload();await pg.waitForTimeout(1200);await pg.click("#fab");await pg.waitForTimeout(2000);
const fabs=await pg.evaluate(()=>[...document.querySelectorAll("#fabWrap button, #fab")].map(b=>b.id+":"+b.textContent.trim().slice(0,12)));console.log("fab:",fabs.join(" | "));
console.log("modal scanning:",await pg.evaluate(()=>document.getElementById("modal").className),"| título visível:",await pg.locator("#modalTitle").isVisible());
const vis=async s=>{const b=await pg.locator(s).boundingBox();return b?Math.round(b.y+b.height)+"/"+860:"-"};
console.log("fundo do campo digitar:",await vis("#manualCode"),"| botão OK:",await vis("#manualGo"),"| Digitar código:",await vis("#scanManual"));
await pg.screenshot({path:"/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/scan.png"});
console.log("erros",errs.filter(e=>!/ServiceWorker/.test(e)));await br.close();srv.close();
