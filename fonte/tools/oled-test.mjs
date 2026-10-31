import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist");
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(f.endsWith("index.html"))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const port=srv.address().port;
const br=await chromium.launch({executablePath:process.env.PW_CHROMIUM||"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:390,height:800}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("Teste"))});
await pg.goto(`http://localhost:${port}/`);await pg.waitForTimeout(800);
const bg=()=>pg.evaluate(()=>[getComputedStyle(document.body).backgroundColor,document.querySelector("meta[name=theme-color]").content,document.getElementById("mnOled").hidden,document.getElementById("mnOled").textContent]);
console.log("escuro",await bg());
await pg.click("#moreBtn");await pg.click("#mnOled");await pg.waitForTimeout(200);console.log("oled",await bg());
await pg.screenshot({path:"/tmp/oled.png"});
await pg.reload();await pg.waitForTimeout(600);console.log("reload",await bg());
await pg.evaluate(()=>document.getElementById("temaBtn").click());await pg.waitForTimeout(200);await pg.click("#moreBtn");console.log("claro",await bg());await pg.keyboard.press("Escape");
await pg.evaluate(()=>document.getElementById("temaBtn").click());await pg.waitForTimeout(200);console.log("volta escuro",await bg());
console.log("erros",errs);await br.close();srv.close();
