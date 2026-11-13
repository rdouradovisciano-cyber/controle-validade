import { chromium } from "playwright-core"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve(process.argv[2]);
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});

const out=[];
for(const perfil of ["Admin","FLV","Perecíveis"]){
 const ctx=await br.newContext({viewport:{width:390,height:860}});
 await ctx.addInitScript(pf=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil",pf);
  localStorage.setItem("validamais-produtos-v1",JSON.stringify([{id:"a1",name:"Banana",category:"FLV",expiry:"2026-11-20",quantity:2},{id:"a2",name:"Queijo",category:"Perecíveis",expiry:"2026-11-14",quantity:1},{id:"a3",name:"Frango",category:"KÓRIN",expiry:"2026-11-14",quantity:3}]));},perfil);
 const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,120)));
 await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(3000);
 const abas=await pg.$$eval(".tabbar button, nav.menu button, #tbLoja,#tbDoacao,#tbEtiquetas,#tbPesaveis,#tbCadastros",b=>[...new Set(b.filter(x=>x.offsetParent).map(x=>x.id))].join(","));
 const chips=await pg.$$eval("#mnSetorBox [data-s]",b=>b.filter(x=>x.offsetParent).map(x=>x.dataset.s).join("|"));
 const tabsTry=[];
 for(const id of ["tbDoacao","tbEtiquetas","tbPesaveis","tbCadastros","tbLoja"]){const ok=await pg.evaluate(i=>{const b=document.getElementById(i);if(b&&b.offsetParent){b.click();return 1}return 0},id);if(ok){await pg.waitForTimeout(500);tabsTry.push(id.slice(2))}}
 let troca="";
 if(perfil==="Admin"){await pg.click("#moreBtn");for(const s of ["FLV","Perecíveis"]){await pg.evaluate(s=>{[...document.querySelectorAll("#mnSetorBox [data-s]")].find(x=>x.dataset.s===s&&x.offsetParent)?.click()},s);await pg.waitForTimeout(700);troca+=s+":"+await pg.evaluate(()=>document.body.dataset.setor)+" ";await pg.click("#moreBtn").catch(()=>{})}}
 out.push(perfil+" | chips: "+chips+" | tabs: "+tabsTry.join(",")+(troca?" | troca: "+troca:"")+" | erros: "+JSON.stringify(errs));
 await ctx.close();
}
console.log(out.join("\n"));
await br.close();srv.close();
