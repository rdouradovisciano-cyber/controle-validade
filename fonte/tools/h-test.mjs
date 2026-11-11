import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]), SHOT=process.argv[3];
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const d=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const P=[["Iogurte Natural",-2],["Queijo Prato",0],["Presunto Fatiado",2],["Mortadela",6],["Requeijão",15],["Manteiga",20]].map(([n,e],i)=>({id:"p"+i,name:n,barcode:"789"+i,quantity:"3",expiry:d(e),category:"Perecíveis",por:"Renato",createdAt:Date.now()-i*36e5}));
P.push({id:"r1",name:"Leite Antigo",barcode:"7001",quantity:"1",expiry:d(-5),category:"Perecíveis",retirado:true,retEm:Date.now()});
const ctx=await br.newContext({viewport:{width:390,height:860},deviceScaleFactor:2});
await ctx.addInitScript(p=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Perecíveis");sessionStorage.setItem("validamais-setor","Perecíveis");localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));
const c=document.createElement("canvas");c.width=300;c.height=300;const x=c.getContext("2d");const g=x.createLinearGradient(0,0,300,300);g.addColorStop(0,"#f9a03f");g.addColorStop(1,"#c0392b");x.fillStyle=g;x.fillRect(0,0,300,300);x.fillStyle="#fff";x.font="bold 70px sans-serif";x.fillText("FOTO",50,170);
const d=c.toDataURL("image/jpeg",.8);const m={};["queijo prato","presunto fatiado","requeijao"].forEach(n=>m["foto-"+n]=d);localStorage.setItem("validamais-fotos-per",JSON.stringify(m));},P);
const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3500);
console.log(JSON.stringify({errs,fotos:await pg.evaluate(()=>document.querySelectorAll(".pitem .ico-img").length)}));
await pg.screenshot({path:SHOT+"/f_lista.png"});

const est=()=>pg.evaluate(()=>({rec:document.getElementById("list").dataset.rec,vis:[...document.querySelectorAll("#list .pitem")].filter(e=>e.offsetParent).length,hd:document.querySelectorAll(".pgh").length}));
console.log("abertura",JSON.stringify(await est()));
await pg.screenshot({path:SHOT+"/h_fechado.png"});
await pg.click(".pgh.gh");await pg.waitForTimeout(300);console.log("abre hoje",JSON.stringify(await est()));
await pg.screenshot({path:SHOT+"/h_hoje.png"});
await pg.fill("#search","queijo");await pg.waitForTimeout(400);console.log("busca",JSON.stringify(await est()));
await pg.fill("#search","");await pg.waitForTimeout(300);
await pg.evaluate(()=>document.getElementById("manualOpen").click());await pg.waitForTimeout(300);
await pg.fill("#barcode","");await pg.fill("#name","Mortadela Nova");await pg.fill("#expiry",new Date(Date.now()+9*864e5).toISOString().slice(0,10));
await pg.click('#productForm button[type=submit]');await pg.waitForTimeout(400);
const alt=await pg.$(".askalt");if(alt){await alt.click();await pg.waitForTimeout(600);}
console.log("apos lancar",JSON.stringify(await est()),JSON.stringify(errs));
await br.close();srv.close();
