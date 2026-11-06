import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)&&q.url.startsWith("/vendor.js"))f="/home/claude/controle-validade/vendor.js";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const ctx=await br.newContext({viewport:{width:411,height:860},acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{if(localStorage.getItem("s"))return;localStorage.setItem("s","1");localStorage.setItem("validamais-operador",JSON.stringify("Renato(Admin)"));localStorage.setItem("validamais-perfil","Admin");sessionStorage.setItem("validamais-setor","KÓRIN");
const t=Date.now()-5*864e5,it=(n,b,q)=>({n,b,q,u:"un"});
localStorage.setItem("validamais-korin-base",JSON.stringify([{id:"b1",t,por:"Renato",itens:[it("Coxa 700g","7893753001317",7),it("Sobrecoxa 700g","7893753000273",78),it("Filé de peito 1kg","7893753602521",51)]}]));
localStorage.setItem("validamais-korin-rec-hist",JSON.stringify([{id:"r1",t:Date.now()-864e5,por:"Renato",itens:[it("Coxa 700g","7893753001317",10)]}]));
localStorage.setItem("validamais-contagem-kor",JSON.stringify([it("Coxa 700g","7893753001317",9),it("Sobrecoxa 700g","7893753000273",60),it("Filé de peito 1kg","7893753602521",40)]))});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(2500);
await pg.click("#tbContagem");await pg.click('#kModo [data-m="cont"]');await pg.waitForTimeout(300);await pg.screenshot({path:SP+"kean-cont.png"});
await pg.click('#kModo [data-m="vend"]');await pg.waitForTimeout(400);await pg.screenshot({path:SP+"kean-vend.png",fullPage:true});
const [dl]=await Promise.all([pg.waitForEvent("download",{timeout:8000}).catch(()=>null),pg.click("#kVPdf")]);if(dl){await dl.saveAs(SP+"kean.pdf");console.log("pdf ok");}else console.log("sem pdf");
await pg.click('#kModo [data-m="cont"]');
const [d2]=await Promise.all([pg.waitForEvent("download",{timeout:8000}).catch(()=>null),pg.click("#kPdf")]);if(d2){await d2.saveAs(SP+"kean-cont.pdf");console.log("pdf cont ok");}
console.log(errs);await br.close();srv.close();
