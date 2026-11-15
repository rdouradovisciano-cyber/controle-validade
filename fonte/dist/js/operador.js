/* operador, acessos e atualizações */(function(){
var g=function(i){return document.getElementById(i)},OPK="validamais-operador",ACK="validamais-acessos",FIRSTK="validamais-primeiro-acesso";
// >>> Para registrar uma nova atualização, acrescente um item NO TOPO desta lista <<<
/* UPDATES vem de js/version.js (gerado no build a partir de data/updates.json) */;
function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function fmt(iso,full){var d=new Date(iso);if(isNaN(d))return"";var p=function(n){return String(n).padStart(2,"0")};
return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+(full?" "+p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds()):" às "+p(d.getHours())+":"+p(d.getMinutes()))}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
// ---- atualizações ----
function renderUpd(){var u=UPDATES[0];if(!u)return;g("updSum").textContent="Atualizado em "+fmt(u.t)+" · ver novidades";
g("updBody").innerHTML=UPDATES.slice(0,5).map(function(x,i){return(i?'<h4>'+fmt(x.t)+'</h4>':'')+'<ul>'+x.itens.map(function(t){return'<li>'+esc(t)+'</li>'}).join("")+'</ul>'}).join("")}
renderUpd();
try{var LV="validamais-lastver",ant=JSON.parse(localStorage.getItem(LV)||'""');localStorage.setItem(LV,JSON.stringify(window.vmVersion));   // depois de atualizar: uma linha com o que mudou
var un=UPDATES[0]&&UPDATES[0].itens&&UPDATES[0].itens[0];
if(ant&&ant!==window.vmVersion&&un)setTimeout(function(){var e=g("toast");if(!e)return;e.textContent="Atualizado para v"+window.vmVersion.split("-").pop()+" · "+un;e.classList.remove("hidden");setTimeout(function(){e.classList.add("hidden")},9000)},1500)}catch(e){}
if(location.hash.indexOf("#conf=")===0)return;      // tela de conferência (link): sem identificação
// ---- acessos ----
function whenDb(cb){var k=0,i=setInterval(function(){k++;if(typeof db!=="undefined"&&db&&window.V){clearInterval(i);cb()}else if(k>40)clearInterval(i)},500)}
function uaName(){var u=navigator.userAgent;return/Android/.test(u)?"Android":/iPhone|iPad/.test(u)?"iOS":"Computador"}
function logAccess(){var n=rd(OPK,"");if(!n)return;var l=rd(ACK,[]);l.unshift({n:n,t:new Date().toISOString()});wr(ACK,l.slice(0,200));if(!rd(FIRSTK,""))wr(FIRSTK,new Date().toISOString());
  whenDb(function(){try{V.setDoc(V.doc(db,"devices",myId),{nome:n},{merge:true}).catch(function(){});
    V.addDoc(V.collection(db,"acessos"),{nome:n,em:V.serverTimestamp(),dev:String(myId).slice(0,4),ua:uaName()}).catch(function(){})}catch(e){}})}
function start(){logAccess()}
var nome=rd(OPK,"");
if(nome){start()}else{
  g("opModal").classList.remove("hidden");setTimeout(function(){g("opNome").focus()},100);
  var ok=function(){var v=g("opNome").value.replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,40);
    if(v.length<2){g("opNome").focus();return alert("Digite o seu nome (mínimo 2 letras).")}
    if(!confirm("Confirmar o nome «"+v+"»?\nDepois de salvo, ele não poderá ser alterado neste aparelho."))return;
    if(rd(OPK,""))return;                       // já existe: nunca sobrescreve
    wr(OPK,v);g("opModal").classList.add("hidden");start();};
  g("opOk").onclick=ok;g("opNome").onkeydown=function(e){if(e.key==="Enter")ok()};}
// volta ao app depois de 30 min parado conta como novo acesso
var hiddenAt=0;document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>30*60*1000&&rd(OPK,""))logAccess()});
})();
