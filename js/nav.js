(function(){var $=function(i){return document.getElementById(i)};
["Loja","Doacao","Etiquetas","Cadastros","Contagem"].forEach(function(n){$("tb"+n).onclick=function(){$("nav"+n).click()}});})();
(function(){var x0=0,y0=0,ok=false,g=function(i){return document.getElementById(i)};
function blocked(t){if(t.closest&&t.closest("input,textarea,select,.ivsw,.rwrap,#reader,.side,.modal,#confView,.fabwrap,.askbg,.redit"))return true;
var m=document.querySelectorAll(".modal,#confView,.side.open");for(var i=0;i<m.length;i++){if(!m[i].classList.contains("hidden")&&getComputedStyle(m[i]).display!=="none")return true}return false}
document.addEventListener("touchstart",function(e){if(e.touches.length!==1){ok=false;return}var t=e.touches[0];x0=t.clientX;y0=t.clientY;ok=!blocked(e.target)},{passive:true});
document.addEventListener("touchend",function(e){if(!ok)return;ok=false;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;
if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*2)return;var T=document.body.dataset.setor==="Perecíveis"?["Loja","Etiquetas"]:document.body.dataset.setor==="KÓRIN"?["Contagem","Cadastros"]:["Doacao","Etiquetas","Loja"];var cur=T.indexOf(document.body.dataset.tab||"Loja");if(cur<0)return;var n=cur+(dx<0?1:-1);
if(n<0||n>=T.length)return;g("nav"+T[n]).click();window.scrollTo(0,0)},{passive:true});})();
