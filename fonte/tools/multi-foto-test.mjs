import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), perfil=process.argv[2]||"Admin", SHOT=process.argv[3]||"/tmp/lista.png";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dias=n=>{const d=new Date(Date.now()+n*864e5);return d.toISOString().slice(0,10)};
const prods=[["PEPERONI FATUADO SADIA",9,40],["NESTLE VITAMINA DE FRUTAS MORANGO 200G",9,28],["RICOTA FRESCA FAZENDA BELA VISTA 250G",9,15],["QJ MUSS FAT INTERF ROHDEN KG",10,20],["Queijo minas frescal Tirolez light 500g",10,20],["LINGUIÇA CALABRESA CERATTI",10,15],["NINHO NESTLE",10,20],["BACON FATIADO SEARA 250G",11,10],["Bacon em cubos Sadia",12,4],["PRESUNTO COZIDO",12,4]].map((a,i)=>({id:"p"+i,name:a[0],category:"Perecíveis",barcode:"789123456"+(1000+i),expiry:dias(a[1]),quantity:a[2],por:"Ronaldo"}));
await pg.addInitScript(([pf,pr])=>{if(localStorage.getItem("__ini"))return;localStorage.setItem("__ini","1");const mk=c=>{const k=document.createElement("canvas");k.width=k.height=120;const x=k.getContext("2d");x.fillStyle=c;x.fillRect(0,0,120,120);x.fillStyle="#fff";x.fillRect(30,30,60,60);return k.toDataURL("image/jpeg",.6)};localStorage.setItem("validamais-fotos-per",JSON.stringify({"foto-ninho nestle":mk("#c33"),"foto-bacon em cubos sadia":mk("#999"),"foto-peperoni fatuado sadia":mk("#38c")}));localStorage.setItem("validamais-perfil",pf);localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(pr))},[perfil,prods]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
if(perfil==="Admin"){await pg.getByText("Perecíveis",{exact:false}).first().click();await pg.waitForTimeout(800)}
await pg.waitForTimeout(3500);
if(perfil==="Admin"){await pg.getByText("Perecíveis",{exact:false}).first().click();await pg.waitForTimeout(800)}
await pg.click("#moreBtn");await pg.click("#mnSaude");await pg.waitForTimeout(500);
await pg.fill("#shPal","bacon");
await pg.evaluate(()=>document.querySelector("#shMultiRes").scrollIntoView());
console.log("lista:",await pg.evaluate(()=>document.querySelector("#shMultiRes").innerText.replace(/\n+/g," | ")));
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64");
const fc=pg.waitForEvent("filechooser");await pg.click("[data-multifoto]");(await fc).setFiles({name:"bacon.png",mimeType:"image/png",buffer:png});await pg.waitForTimeout(500);
console.log("confirmação:",(await pg.innerText(".askbg")).replace(/\n+/g," | "));
await pg.screenshot({path:SHOT.replace(".png","-multi.png")});
await pg.locator(".askbg button",{hasText:/^Aplicar$/}).click();await pg.waitForTimeout(1200);
console.log("fotos salvas:",await pg.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem("validamais-fotos-per")||"{}"))),errs);
console.log("lista depois:",await pg.evaluate(()=>document.querySelector("#shMultiRes").innerText.replace(/\n+/g," | ")));
await br.close();srv.close();
