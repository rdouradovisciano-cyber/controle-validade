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


await pg.evaluate(()=>{const dias=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);const L=[["BACON DE PERNIL ALEGRA KG",41546,131662],["BACON FRACIONADO PERDIGAO KG",60172,151212],["BACON MANTA 1KG FRIMESA",84697,133893],["QUEIJO MUSSARELA FATIADO KG",11111,222221],["QUEIJO PRATO KG",11112,222222],["BACALHAU COD MORHUA KG",8853,253626],["SALAME ITALIANO KG",21,22],["SALAME HUNGARO KG",23,24],["SALAMINHO PIMENTA KG",25,26],["PROVOLONE KG",27,28],["PROVOLONE DEFUMADO KG",29,30],["PROVOLONETE KG",31,32],["GORGONZOLA KG",33,34],["PARMESAO KG",35,36],["XPTO ESTRANHO KG",37,38],["QJ PRATO KG",1,2],["QJO MINAS KG",3,4],["Q.J COALHO KG",5,6],["Q MUSSARELA KG",7,8],["QJEO PARMESAO KG",9,10],["PRESUNTO COZIDO KG",5555,666661],["PRESUNTO PARMA KG",5556,666662]];const p=JSON.parse(localStorage.getItem("validamais-produtos-v1")||"[]");L.forEach((x,i)=>p.push({id:"P"+i,name:x[0],barcode:"",codigo_balanca:String(x[1]),codigo_doacao:String(x[2]),quantity:"1",expiry:dias(10),category:"Perecíveis",por:"T"}));localStorage.setItem("validamais-produtos-v1",JSON.stringify(p));});
await pg.reload();await pg.waitForTimeout(3000);
await pg.evaluate(()=>{[...document.querySelectorAll("button,a")].find(b=>/Pes[áa]veis/.test(b.textContent)&&b.offsetParent).click()});await pg.waitForTimeout(600);
const est=()=>pg.evaluate(()=>({hd:[...document.querySelectorAll("#pesLista .pgh")].map(h=>h.textContent.trim()),rows:document.querySelectorAll("#pesLista .pesrow").length}));
console.log("foco:",await pg.evaluate(()=>document.activeElement&&document.activeElement.id));
await pg.fill("#pesBusca","salam");await pg.waitForTimeout(400);
console.log("x visivel:",await pg.evaluate(()=>!document.getElementById("pesX").classList.contains("hidden")),"linhas:",await pg.evaluate(()=>document.querySelectorAll("#pesLista .pesrow").length));
await pg.evaluate(()=>window.scrollTo(0,400));await pg.fill("#pesBusca","");await pg.waitForTimeout(200);
await pg.evaluate(()=>{for(let k=0;k<8;k++)document.querySelectorAll("#pesLista .pgh")[k]&&document.querySelectorAll("#pesLista .pgh")[k].click()});await pg.waitForTimeout(300);
await pg.evaluate(()=>window.scrollTo(0,500));await pg.waitForTimeout(300);
console.log("barra fixa topo:",await pg.evaluate(()=>Math.round(document.querySelector(".pesbar").getBoundingClientRect().top)));
await pg.screenshot({path:SHOT+"/s1.png"});
await pg.click("#pesBusca");await pg.fill("#pesBusca","queijo");await pg.click("#pesX");
console.log("limpou:",await pg.evaluate(()=>document.getElementById("pesBusca").value===""&&document.activeElement.id==="pesBusca"),JSON.stringify(errs));
await pg.screenshot({path:SHOT+"/s2.png"});
await br.close();srv.close();
