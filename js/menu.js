/* menu ⋮: exportar, importar, backup, duplicados, instalar */(function(){
var g=function(i){return document.getElementById(i)},m=g("moreMenu"),bg=g("moreBg");
function fecha(){m.classList.add("hidden");bg.classList.add("hidden")}
function abre(){m.classList.remove("hidden");bg.classList.remove("hidden")}
function msg(t){var e=g("toast");e.textContent=t;e.classList.remove("hidden");clearTimeout(msg.t);msg.t=setTimeout(function(){e.classList.add("hidden")},7000)}
var h=document.querySelector("header");
if(h&&!g("moreBtn")){var b=document.createElement("button");b.id="moreBtn";b.type="button";b.textContent="⋮";b.setAttribute("aria-label","Mais opções");b.setAttribute("aria-haspopup","menu");h.appendChild(b);
b.onclick=function(){m.classList.contains("hidden")?abre():fecha()}}
bg.onclick=fecha;document.addEventListener("keydown",function(e){if(e.key==="Escape")fecha()});
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)g("mnInstall").classList.add("hidden");
g("mnCad").onclick=function(){fecha();g("navCadastros").click();window.scrollTo(0,0)};
if(window.vmSair){g("mnSair").hidden=false;g("mnSair").onclick=function(){fecha();if(confirm("Sair? Este aparelho vai pedir a senha da loja de novo."))window.vmSair()}}
g("mnInv").onclick=function(){fecha();g("navInventario").click();window.scrollTo(0,0)};
g("mnDoaAnt").onclick=function(){fecha();g("navHist").click()};
g("mnEtqHist").onclick=function(){fecha();if(window.ehOpen)window.ehOpen()};
g("mnHist").onclick=function(){fecha();if(window.phOpen)window.phOpen()};
g("mnBkp").onclick=function(){fecha();if(window.vmBackup)window.vmBackup()};
g("mnRest").onclick=function(){fecha();if(window.vmRestaurar)window.vmRestaurar()};
g("mnInstall").onclick=function(){fecha();var b=g("installBtn");
if(b&&!b.hidden){b.click();return}
if(/iphone|ipad|ipod/i.test(navigator.userAgent)){var h=g("iosHint");if(h){h.classList.remove("hidden");window.scrollTo(0,0)}msg("No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.");return}
msg("Para instalar: menu do navegador (⋮) e depois Instalar app ou Adicionar à tela inicial.")};
/* altura do topo (abas + subabas) para os elementos fixos logo abaixo */
var top=document.querySelector(".top");function alt(){document.documentElement.style.setProperty("--top-h",top.offsetHeight+"px")}
alt();if(window.ResizeObserver)new ResizeObserver(alt).observe(top);
})();
/* menu ⋮: modo mão única e tema */(function(){
var g=function(i){return document.getElementById(i)};
function lab(){var mao=g("maoBtn"),on=document.body.classList.contains("mao1"),dk=document.documentElement.dataset.tema==="dark";
var a=g("mnMao"),b=g("mnTema");
if(a)a.lastChild.textContent="Modo mão única: "+(on?"ligado":"desligado");
if(b){b.firstChild.textContent=dk?"☀️":"🌙";b.lastChild.textContent=dk?"Mudar para tema claro":"Mudar para tema escuro"}}
function clk(id){var m=g("moreMenu"),bg=g("moreBg");if(m)m.classList.add("hidden");if(bg)bg.classList.add("hidden");var e=g(id);if(e)e.click();setTimeout(lab,80)}
var a=g("mnMao"),b=g("mnTema");
if(a)a.onclick=function(){clk("maoBtn")};
if(b)b.onclick=function(){clk("temaBtn")};
var mb=g("moreBtn");if(mb)mb.addEventListener("click",lab);
lab();setTimeout(lab,500);
})();
