import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]);
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:390,height:860}});
await ctx.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");const n=Date.now(),mk=(m,q,a,txt)=>({tipo:"atv",t:n-m*60000,quem:q,perfil:"Perecíveis",setor:"Perecíveis",dev:"x",a,txt});localStorage.setItem("validamais-atv",JSON.stringify([mk(1,"Renato(Admin)","acessou","Pesáveis"),mk(4,"Renato(Admin)","editou","Queijo Prato"),mk(9,"Ronaldo","retirou","Presunto Fatiado"),mk(15,"Ronaldo","cadastrou","Requeijão Cremoso"),mk(30,"Ronaldo","entrou",""),mk(40,"Benassi","doação","Iogurte Natural"),mk(60,"Renato(Admin)","entrou","")]));});
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3500);
await pg.evaluate(()=>{document.getElementById("mnAtv").click()});await pg.waitForTimeout(800);
await pg.screenshot({path:process.argv[3]+"/a493.png"});
console.log("linhas:",await pg.$$eval(".atvr",r=>r.length),JSON.stringify(errs));
await pg.click(".atvmais");await pg.waitForTimeout(300);console.log("com entradas/telas:",await pg.$$eval(".atvr",r=>r.length));
await br.close();srv.close();
