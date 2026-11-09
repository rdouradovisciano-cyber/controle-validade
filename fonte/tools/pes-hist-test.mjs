import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), perfil=process.argv[2]||"Admin", SHOT=process.argv[3]||"/tmp/lista.png";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await br.newPage({viewport:{width:411,height:860},deviceScaleFactor:2});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
const dias=n=>{const d=new Date(Date.now()+n*864e5);return d.toISOString().slice(0,10)};
const prods=[["PEPERONI FATUADO SADIA",9,40],["NESTLE VITAMINA DE FRUTAS MORANGO 200G",9,28],["RICOTA FRESCA FAZENDA BELA VISTA 250G",9,15],["QJ MUSS FAT INTERF ROHDEN KG",10,20],["Queijo minas frescal Tirolez light 500g",10,20],["LINGUIÇA CALABRESA CERATTI",10,15],["BACON FATIADO SEARA",10,20],["LEITE UHT 1L",11,10]].map((a,i)=>({id:"p"+i,name:a[0],category:"Perecíveis",barcode:"789123456"+(1000+i),expiry:dias(a[1]),quantity:a[2],por:"Ronaldo",codigo_balanca:String(100+i)}));
await pg.addInitScript(([pf,pr])=>{if(localStorage.getItem("__ini"))return;localStorage.setItem("__ini","1");const mk=c=>{const k=document.createElement("canvas");k.width=k.height=120;const x=k.getContext("2d");x.fillStyle=c;x.fillRect(0,0,120,120);x.fillStyle="#fff";x.fillRect(30,30,60,60);return k.toDataURL("image/jpeg",.6)};localStorage.setItem("validamais-fotos-per",JSON.stringify({"foto-ninho nestle":mk("#c33"),"foto-peperoni fatuado sadia":mk("#38c")}));localStorage.setItem("validamais-perfil",pf);localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-produtos-v1",JSON.stringify(pr))},[perfil,prods]);
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
if(perfil==="Admin"){await pg.getByText("Perecíveis",{exact:false}).first().click();await pg.waitForTimeout(800)}
await pg.waitForTimeout(3500);
if(perfil==="Admin"){await pg.getByText("Perecíveis",{exact:false}).first().click();await pg.waitForTimeout(800)}
await pg.getByRole("button",{name:/Pesáveis/}).first().click();await pg.waitForTimeout(600);
console.log("chips de tipo:",await pg.evaluate(()=>!!document.querySelector("#pesTipos,.pestipos")));
await pg.click("#pesBusca");await pg.waitForTimeout(300);
const sug=()=>pg.evaluate(()=>{const b=document.querySelector("#pesSug");return b.classList.contains("hidden")?"(oculto)":b.innerText.replace(/\n+/g," | ")});
console.log("1) vazio:",await sug());
await pg.screenshot({path:SHOT.replace(".png","-p1.png")});
await pg.fill("#pesBusca","bacon");console.log("2) digitando:",await sug());
await pg.click("#pesLista [data-pes]");await pg.waitForTimeout(200);await pg.fill("#pesBusca","");await pg.locator("#pesBusca").blur();await pg.waitForTimeout(400);
await pg.fill("#pesBusca","queijo");await pg.keyboard.press("Enter");await pg.waitForTimeout(400);
await pg.fill("#pesBusca","bacon");await pg.click("#pesLista [data-pes]");await pg.fill("#pesBusca","");await pg.locator("#pesBusca").blur();await pg.waitForTimeout(400);
await pg.click("#pesBusca");console.log("3) depois:",await sug());
await pg.screenshot({path:SHOT.replace(".png","-p2.png")});
await pg.click('#pesSug [data-pst="queijo"]');await pg.waitForTimeout(300);console.log("4) tocou queijo → campo:",await pg.inputValue("#pesBusca"),"| info:",await pg.innerText("#pesInfo"));
await pg.fill("#pesBusca","");await pg.click("#pesBusca");await pg.click('#pesSug [data-psx="queijo"]');console.log("5) apagou queijo:",await sug());
console.log("guardado:",await pg.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.includes("pbh")).map(([k,v])=>k+"="+v)),errs);
await br.close();srv.close();
