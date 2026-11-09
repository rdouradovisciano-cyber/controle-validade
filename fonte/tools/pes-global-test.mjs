import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), perfil=process.argv[2]||"Admin", SHOT=process.argv[3]||"/tmp/lista.png";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(f.endsWith("js/app.js"))b=Buffer.from(b.toString().replace(/\n\}\)\(\);\s*$/,"\nwindow.__t={setDb:v=>{db=v},V};\n})();"));if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
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
await pg.evaluate(()=>{ window.__log=[]; window.__cb=null; const V=__t.V;V.doc=(d,c,id)=>({c,id}); V.increment=n=>({inc:n}); V.deleteField=()=>"DEL"; V.updateDoc=(r,d)=>{__log.push(["upd",r.id,JSON.stringify(d)]);return Promise.resolve()};
  V.setDoc=(r,d,o)=>{__log.push(["set",r.id,JSON.stringify(d),JSON.stringify(o)]);return Promise.resolve()};
  V.onSnapshot=(r,cb)=>{ if(r.id==="pbh-global") window.__cb=cb; return ()=>{}; }; __t.setDb({}); });
await pg.click("#pesBusca");await pg.waitForTimeout(300);
const sug=()=>pg.evaluate(()=>{const b=document.querySelector("#pesSug");return b.classList.contains("hidden")?"(oculto)":b.innerText.replace(/\n+/g," | ")});
console.log("1) sem dados gerais:",await sug());
await pg.evaluate(()=>__cb({exists:()=>true,data:()=>({t:{queijo_minas:{n:12,w:"queijo minas",u:1},bacon:{n:7,w:"bacon",u:1},salame:{n:1,w:"salame",u:1},mussarela:{n:5,w:"mussarela",u:1}}})}));await pg.waitForTimeout(200);
console.log("2) com dados gerais:",await sug());
await pg.screenshot({path:SHOT.replace(".png","-g.png")});
await pg.fill("#pesBusca","bacon");await pg.click("#pesLista [data-pes]");await pg.fill("#pesBusca","");await pg.locator("#pesBusca").blur();await pg.waitForTimeout(500);
await pg.fill("#pesBusca","bacon");await pg.click("#pesLista [data-pes]");await pg.waitForTimeout(200);
console.log("3) gravações:",await pg.evaluate(()=>__log.filter(x=>x[1]==="pbh-global").map(x=>x.join(" "))));
await pg.fill("#pesBusca","");await pg.click("#pesBusca");await pg.click('#pesSug [data-psg="bacon"]');
console.log("4) admin tirou bacon:",await pg.evaluate(()=>__log.filter(x=>x[0]==="upd").map(x=>x.join(" "))),errs);
await br.close();srv.close();
