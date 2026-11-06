import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const D=path.resolve("dist"), SP="/tmp/claude-0/-home-claude/8acfd74b-066d-5685-9053-e1d75c13691f/scratchpad/";
const srv=http.createServer((q,r)=>{let f=path.join(D,q.url.split("?")[0]);if(f.endsWith("/"))f+="index.html";if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
let b=fs.readFileSync(f);if(/\.(html|js)$/.test(f)&&!/ocr\//.test(f))b=Buffer.from(b.toString().replace(/apiKey:\s*"[^"]*"/g,'apiKey:"COLE_"').replace(/login:\s*\{\s*email:[^}]*\}/g,"login: null"));
r.writeHead(200,{"content-type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});r.end(b)}).listen(0);
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
const pg=await (await br.newContext({viewport:{width:411,height:860}})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
await pg.addInitScript(()=>{localStorage.setItem("validamais-operador",JSON.stringify("T"));localStorage.setItem("validamais-perfil","Admin");localStorage.setItem("validamais-tema","light");localStorage.setItem("validamais-produtos-v1","[]")});
await pg.goto(`http://localhost:${srv.address().port}/`);await pg.waitForTimeout(5500);
await pg.click("#moreBtn");await pg.click("#mnEscala");await pg.waitForTimeout(300);
// ir para novembro/2026 (mês atual do relógio do teste pode ser outro)
const alvo=await pg.evaluate(()=>{const b=document.querySelector(".enav b").textContent;return b});console.log("mês inicial:",alvo);
while(!(await pg.innerText(".enav b")).includes("Novembro de 2026")){const t=(await pg.innerText(".enav b"));const ant=/2026/.test(t)&&/Dezembro/.test(t)||/2027/.test(t);await pg.click(ant?'[data-em="-1"]':'[data-em="1"]');}
console.log("alerta:",(await pg.innerText(".ealert")).replace(/\n/g," | "));await pg.screenshot({path:SP+"e2-a.png"});
await pg.click("[data-efix]");await pg.waitForTimeout(200);await pg.screenshot({path:SP+"e2-b.png"});
await pg.click('[data-efx^="y|"]');await pg.waitForTimeout(300);
console.log("depois de corrigir, alerta:",await pg.isVisible(".ealert"));
// config
await pg.click("#escCfgB");await pg.waitForTimeout(200);
await pg.fill('[data-cfn="r|ent"]',"10:30");console.log("ent só:",await pg.inputValue('[data-cfn="r|ent"]'));await pg.fill('[data-cfn="r|full"]',"Renato Teste da Silva");console.log("ent depois do nome:",await pg.inputValue('[data-cfn="r|ent"]'));
console.log("ent após fill:",await pg.inputValue('[data-cfn="r|ent"]'));
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAE0lEQVQYV2NkYGD4z0AEYBxVSF+FABJADq0VY1jDAAAAAElFTkSuQmCC","base64");
const [fc]=await Promise.all([pg.waitForEvent("filechooser"),pg.click('[data-cf="foto|r"]')]);await fc.setFiles({name:"f.png",mimeType:"image/png",buffer:png});await pg.waitForTimeout(500);
console.log("campo entrada após foto:",await pg.inputValue('[data-cfn="r|ent"]'),"| avatar com foto:",await pg.locator(".cfh img.eav").count());
await pg.screenshot({path:SP+"e2-c.png"});
await pg.click('[data-cf="salva"]');await pg.waitForTimeout(400);
console.log("cartão Renato:",(await pg.locator(".epc.r").innerText()).replace(/\n/g," | "));await pg.screenshot({path:SP+"e2-d.png"});
console.log(errs);await br.close();srv.close();
