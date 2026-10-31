import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage();
await pg.addInitScript(()=>{window.__b=[];const t0=performance.now();localStorage.setItem("validamais-operador",JSON.stringify("T"));
window.AudioContext=function(){this.state="running";this.currentTime=0;this.destination={};this.createOscillator=()=>({frequency:{set value(v){window.__b.push(["tom",v,Math.round(performance.now()-t0)])}},connect(){},start(){},stop(){}});this.createGain=()=>({gain:{},connect(){}});this.resume=()=>{}}});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(1500);
console.log("bips:",JSON.stringify(await pg.evaluate(()=>window.__b)),"| splash removido:",await pg.evaluate(()=>!document.getElementById("splash")));
await br.close();srv.close();
