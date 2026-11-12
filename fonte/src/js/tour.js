/* tour de boas-vindas: aparece uma vez por aparelho e pode ser revisto em Menu ⋮ › Ajuda › Ver o tour */(function(){
var K="validamais-tour-v1",g=function(i){return document.getElementById(i)};
var S=[
{t:"Bem-vindo ao Valida+",d:"Um passeio rápido de 1 minuto pelo que o app faz. Você pode pular quando quiser e rever depois no menu ⋮, em Ajuda."},
{sel:"#fab",t:"Bipar o código de barras",d:"Aponte a câmera para o código do produto. O app reconhece o item, e você só informa a quantidade e a validade."},
{sel:"#manualOpen",t:"Cadastro manual",d:"Sem código de barras, ou produto novo? Cadastre aqui, digitando o nome, a quantidade e a validade."},
{sel:"#tbLoja",t:"Validades",d:"Tudo o que vence, em grupos por urgência: Vencidos, Vence hoje, 1 a 3 dias e assim por diante. Toque na barra do grupo para abrir ou fechar, e no item para ver as opções, editar ou retirar."},
{sel:"#tbPesaveis",t:"Pesáveis",d:"Os produtos de balança, agrupados por tipo. A busca fica fixa no topo: digite ou use o microfone para achar rápido."},
{sel:"#tbEtiquetas",t:"Etiquetas",d:"Lance e acompanhe as etiquetas dos produtos."},
{sel:"#tbDoacao",t:"Doação",d:"Registre o que vai para doação e consulte a lista do dia."},
{sel:"#tbCadastros",t:"Cadastros",d:"A lista de produtos cadastrados. Dá para consultar, corrigir e organizar."},
{sel:"#tbContagem",t:"Contagem",d:"Conte o estoque item a item, bipando ou digitando."},
{sel:"#moreBtn",t:"Menu e ajustes",d:"Aqui ficam o tema claro e escuro, as cores e prazos, as notificações, o perfil deste aparelho, e a opção de rever este tour. Em Cores e prazos você escolhe ver os produtos em grade ou em lista, e se as fotos aparecem."},
{p:1,t:"Dicas que ajudam",d:"Segure a foto de um produto para ampliar. Dentro do item aberto, escreva uma nota: ela vira um post-it amarelo no cartão. As notas mais usadas viram atalhos."},
{t:"Tudo pronto",d:"É isso. Bons lançamentos! Para rever este passeio, abra o menu ⋮ e toque em «Ver o tour»."}
];
var ov,hl,card,i=0,list=[],aberto=false;
function seen(){try{localStorage.setItem(K,"1")}catch(e){}}
function jaVisto(){try{return localStorage.getItem(K)==="1"}catch(e){return false}}
function vis(s){if(s.p){var pf="";try{pf=localStorage.getItem("validamais-perfil")||""}catch(e){}if(pf!=="Admin"&&pf.indexOf("Perec")!==0)return false}if(!s.sel)return true;var e=document.querySelector(s.sel);if(!e)return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=="hidden"}
function fim(){if(!aberto)return;aberto=false;seen();ov.remove();document.removeEventListener("keydown",tecla);window.removeEventListener("resize",pos);}
function tecla(e){if(e.key==="Escape")fim();else if(e.key==="ArrowRight"||e.key==="Enter"){e.preventDefault();ir(1)}else if(e.key==="ArrowLeft")ir(-1)}
function ir(d){var n=i+d;if(n<0)return;if(n>=list.length)return fim();i=n;mostra()}
function pos(){if(!aberto)return;var s=list[i],e=s.sel&&document.querySelector(s.sel),vw=innerWidth,vh=innerHeight;
var cw=card.offsetWidth,ch=card.offsetHeight;
if(e){var r=e.getBoundingClientRect(),p=6;hl.style.cssText="display:block;left:"+(r.left-p)+"px;top:"+(r.top-p)+"px;width:"+(r.width+2*p)+"px;height:"+(r.height+2*p)+"px";
var abaixo=r.top+r.height/2<vh/2,top=abaixo?r.bottom+p+14:r.top-p-14-ch;top=Math.max(12,Math.min(vh-ch-12,top));
var left=Math.max(12,Math.min(vw-cw-12,r.left+r.width/2-cw/2));card.style.left=left+"px";card.style.top=top+"px"}
else{hl.style.display="none";card.style.left=Math.max(12,(vw-cw)/2)+"px";card.style.top=Math.max(12,(vh-ch)/2)+"px"}}
function mostra(){var s=list[i],ult=i===list.length-1;
card.innerHTML='<div class="tr-n">'+(i+1)+' de '+list.length+'</div><h3>'+s.t+'</h3><p>'+s.d+'</p><div class="tr-dots" aria-hidden="true">'+list.map(function(_,k){return '<i'+(k===i?' class="on"':'')+'></i>'}).join("")+'</div><div class="tr-bt">'+(ult?'':'<button type="button" class="tr-skip" data-a="x">Pular</button>')+(i>0?'<button type="button" class="tr-back" data-a="b">Voltar</button>':'')+'<button type="button" class="tr-next" data-a="n">'+(ult?'Começar':'Próximo')+'</button></div>';
requestAnimationFrame(function(){pos();var b=card.querySelector(".tr-next");if(b)b.focus({preventScroll:true})})}
function inicia(){if(aberto)return;list=S.filter(vis);i=0;if(!list.length)return;aberto=true;
ov=document.createElement("div");ov.className="tr-ov";ov.innerHTML='<div class="tr-hl"></div><div class="tr-card" role="dialog" aria-modal="true" aria-label="Tour do Valida+"></div>';
hl=ov.firstChild;card=ov.lastChild;
card.onclick=function(e){var b=e.target.closest("[data-a]");if(!b)return;var a=b.dataset.a;if(a==="x")fim();else ir(a==="n"?1:-1)};
ov.onclick=function(e){if(e.target===ov)ir(1)};
document.body.appendChild(ov);document.addEventListener("keydown",tecla);window.addEventListener("resize",pos);mostra()}
window.vmTour=function(){window.scrollTo(0,0);inicia()};
var mn=g("mnTour");if(mn)mn.onclick=function(){var m=g("moreMenu"),bg=g("moreBg");if(m)m.classList.add("hidden");if(bg)bg.classList.add("hidden");setTimeout(window.vmTour,150)};
/* primeira entrada: espera o app abrir (sem escolha de perfil nem login na frente) */
if(!jaVisto()){var n=0,t=setInterval(function(){n++;
var bloq=document.querySelector(".askbg,#vmLogin");
if(n>40){clearInterval(t);return}
if(bloq||!localStorage.getItem("validamais-perfil"))return;
clearInterval(t);setTimeout(inicia,900)},500)}
})();
