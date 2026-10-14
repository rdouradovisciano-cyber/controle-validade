try{document.documentElement.dataset.tema=localStorage.getItem("validamais-tema")||"dark"}catch(e){document.documentElement.dataset.tema="dark"}
(function(){
var K="validamais-tema",m=document.querySelector('meta[name=theme-color]'),claro=m?m.content:"#08090c";
function ap(t){document.documentElement.dataset.tema=t;if(m)m.content=t==="dark"?"#08090c":claro;
var b=document.getElementById("temaBtn");if(b){b.textContent=t==="dark"?"\u2600\uFE0F":"\uD83C\uDF19";b.setAttribute("aria-label",t==="dark"?"Modo claro":"Modo escuro")}}
document.addEventListener("DOMContentLoaded",function(){var h=document.querySelector("header");if(!h)return;
var b=document.createElement("button");b.id="temaBtn";b.type="button";
b.style.cssText="background:rgba(255,255,255,.14);color:#fff;font-size:20px;min-width:44px;padding:0;line-height:1;border-radius:12px";
h.appendChild(b);
b.onclick=function(){var t=document.documentElement.dataset.tema==="dark"?"light":"dark";try{localStorage.setItem(K,t)}catch(e){}ap(t)};
ap(document.documentElement.dataset.tema||"dark")});
})();
