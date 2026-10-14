/* busca da Doação fica acima do teclado */(function(){
var d=document,b=d.getElementById("dBusca"),box=d.getElementById("dFindBox"),f=d.getElementById("dFind"),sug=d.getElementById("dSug"),root=d.documentElement,vv=window.visualViewport,t;
if(!b||!box||!f)return;
function kb(){var k=0;if(vv)k=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));root.style.setProperty("--kb",k+"px")}
function abre(){clearTimeout(t);if(!d.body.classList.contains("dfocus")){box.style.minHeight=f.offsetHeight+"px";d.body.classList.add("dfocus")}kb()}
function fecha(){t=setTimeout(function(){if(d.activeElement===b)return;d.body.classList.remove("dfocus");box.style.minHeight="";root.style.removeProperty("--kb")},120)}
b.addEventListener("focus",abre);b.addEventListener("blur",fecha);
sug.addEventListener("pointerdown",function(e){e.preventDefault()});   // tocar numa sugestão não fecha antes de escolher
if(vv){vv.addEventListener("resize",kb);vv.addEventListener("scroll",kb)}
d.addEventListener("keydown",function(e){if(e.key==="Escape"&&d.activeElement===b)b.blur()});
})();
