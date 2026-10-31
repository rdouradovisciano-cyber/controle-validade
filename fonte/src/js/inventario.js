/* aba Inventário: contagem de FLV por banca (sem banco; troca de dados por link) */(function(){
"use strict";
var g=function(i){return document.getElementById(i)};
var KEY="validamais-inventario-v1";
function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var S=rd(KEY,null);if(!S||!Array.isArray(S.bancas))S={bancas:[]};
var CL={on:false,adopted:false,started:false,err:"",fc:true,hps:{},bancas:{},lan:{},fin:{},hist:null,sig:"",force:false,late:false,tm:0,migT:0,warned:false},swiping=false,hashQ=null;
function save(){wr(KEY,S);CL.sig=sigNow()}
function me(){var n=rd("validamais-operador","");return typeof n==="string"&&n?n:"Aparelho"}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function normS(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim()}
function fmt(n){return(Math.round(n*10)/10).toLocaleString("pt-BR",{maximumFractionDigits:1})}
function fmt3(n){return(Math.round(n*1000)/1000).toLocaleString("pt-BR",{maximumFractionDigits:3})}
function num(s){var n=parseFloat(String(s).replace(",","."));return isNaN(n)?null:n}
function uid(){return Math.random().toString(36).slice(2,8)}
function hhmm(t){return t?new Date(t).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}
var tmo;function toast(t){var e=g("toast");if(!e)return;e.textContent=t;e.classList.remove("hidden");clearTimeout(tmo);tmo=setTimeout(function(){e.classList.add("hidden")},3500)}

/* ---- cores das bancas ---- */
var PAL=["#4f79a8","#b5804d","#7b6aa6","#a86b88","#4f8a8d","#a38d4a","#b56a64","#5f8a68"];
var LEG={"#2f80ed":0,"#f2994a":1,"#9b51e0":2,"#e0559b":3,"#17a2b8":4,"#d9a400":5,"#eb5757":6,"#43a047":7};
function okCor(c){return/^#[0-9a-f]{6}$/i.test(c||"")}
function corOf(b){var c=okCor(b.cor)?String(b.cor).toLowerCase():"";if(c&&LEG[c]!==undefined)return PAL[LEG[c]];return c||PAL[Math.max(0,S.bancas.indexOf(b))%PAL.length]}
function inkOn(hex){var n=parseInt(hex.slice(1),16),r=n>>16,gg=(n>>8)&255,bb=n&255;return(r*299+gg*587+bb*114)/1000>150?"#1a1405":"#fff"}
function tag(b,big){var c=corOf(b);return'<span class="ivtag'+(big?' big':'')+'" style="background:'+c+';color:'+inkOn(c)+'">'+esc(b.nome)+'</span>'}
function firstUnused(){var used=S.bancas.map(corOf);return PAL.filter(function(c){return used.indexOf(c)<0})[0]||PAL[S.bancas.length%PAL.length]}

/* ---- lançamentos e cálculo ---- */
/* b.cont[chave] = total do produto (existe só quando o produto foi concluído); b.lan[chave] = [[peso,hora],...] */
function eff(b){
  var loc={por:b.por||me(),cont:b.cont||{},lan:b.lan||{},t:b.t||0},e=b.ext;
  if(e&&e.cont&&(e.t>loc.t||(e.t===loc.t&&Object.keys(e.cont).length>Object.keys(loc.cont).length)))return{por:e.por,cont:e.cont,lan:e.lan||{},t:e.t};
  return loc;
}
function sumL(a){return Math.round(a.reduce(function(s,x){return s+x[0]},0)*1000)/1000}
function lansOf(b,key){var e=eff(b),a=e.lan&&e.lan[key];if(a)return a;var v=e.cont[key];return(typeof v==="number"&&v>0)?[[v,e.t||0]]:[]}
function lanArr(b,key){   // versão editável (só neste aparelho)
  b.lan=b.lan||{};b.cont=b.cont||{};
  if(!b.lan[key])b.lan[key]=(typeof b.cont[key]==="number"&&b.cont[key]>0)?[[b.cont[key],b.t||0]]:[];
  return b.lan[key];
}
function stats(b){
  var e=eff(b),kg=0,un=0,n=0;
  b.itens.forEach(function(it){var v=e.cont[it.c];if(typeof v==="number"){n++;if(it.u==="un")un+=v;else kg+=v}});
  var m=b.itens.length;
  return{kg:kg,un:un,n:n,m:m,pct:m?Math.round(n/m*100):0,por:(n>0||Object.keys(e.lan||{}).length)?e.por:"",e:e};
}
function totals(){
  var kg=0,un=0,n=0,m=0,prod={};
  var rows=S.bancas.map(function(b){
    var s=stats(b);kg+=s.kg;un+=s.un;n+=s.n;m+=s.m;
    b.itens.forEach(function(it){var v=s.e.cont[it.c];if(typeof v!=="number")return;
      var p=prod[it.c]||(prod[it.c]={c:it.c,n:it.n,u:it.u,b:it.b,d:it.d,e:it.e,bn:b.nome,bc:corOf(b),v:0});p.v+=v});
    return{b:b,s:s};
  });
  var arr=Object.keys(prod).map(function(k){return prod[k]}).sort(function(a,b){return b.v-a.v});
  return{rows:rows,kg:kg,un:un,n:n,m:m,pct:m?Math.round(n/m*100):0,prod:arr};
}
function pctOf(a,b){return b?Math.round(a/b*100):0}

/* ---- cadastro de produtos do app (busca por código de balança, código interno, EAN ou nome) ---- */
function catalog(){try{return typeof window.vmProducts==="function"?(window.vmProducts()||[]):[]}catch(e){return[]}}
function unitFor(name){var m=rd("validamais-dunid",{});return m[normS(name)]||(/^abacaxi/.test(normS(name))?"un":"kg")}
function merged(){
  var map={},list=[];
  catalog().forEach(function(p){
    var n=String(p.name||"").trim();if(!n)return;
    var k=normS(n),m=map[k];
    if(!m){m=map[k]={n:n,b:"",d:"",e:"",cat:p.category||""};list.push(m)}
    if(!m.b&&p.codigo_balanca)m.b=String(p.codigo_balanca).slice(0,12);
    if(!m.d&&p.codigo_doacao)m.d=String(p.codigo_doacao).slice(0,12);
    if(!m.e&&p.barcode)m.e=String(p.barcode).slice(0,20);
  });
  return list;
}
function isNum(s){return/^\d+$/.test(s)}
function codeEq(q,code){
  if(!code)return false;var c=String(code).toLowerCase();
  return c===q||(isNum(q)&&isNum(c)&&Number(c)===Number(q));
}
function search(q){
  q=normS(q);if(!q)return[];
  if(window.vmScale&&vmScale.is(q))q=String(Number(vmScale.parse(q).item));   // etiqueta de balança: usa o código do item
  var toks=q.split(/\s+/),out=[];
  merged().forEach(function(h){
    var n=normS(h.n),sc=0;
    if(codeEq(q,h.b)||codeEq(q,h.d)||codeEq(q,h.e))sc=100;
    else if((h.b&&String(h.b).toLowerCase().indexOf(q)===0)||(h.d&&String(h.d).toLowerCase().indexOf(q)===0)||(h.e&&String(h.e).indexOf(q)===0))sc=60;
    else if(n.indexOf(q)===0)sc=40;
    else if(toks.every(function(t){return n.indexOf(t)>=0}))sc=20;
    if(sc){var x={};for(var k in h)x[k]=h[k];x.sc=sc;out.push(x)}
  });
  out.sort(function(a,b){return b.sc-a.sc||(a.cat==="FLV"?0:1)-(b.cat==="FLV"?0:1)||a.n.localeCompare(b.n)});
  return out.slice(0,8);
}
function keyOf(h){return h.b?"b"+h.b:h.d?"d"+h.d:h.e?"e"+h.e:"n"+normS(h.n).slice(0,38)}
function toItem(h){return{c:keyOf(h),n:h.n,u:unitFor(h.n),b:h.b||"",d:h.d||"",e:h.e||""}}
function ownerOf(it){   // banca (outra que a em edição) à qual o produto já pertence
  var nm=normS(it.n),mv=(V&&V.moved)||[];
  for(var i=0;i<S.bancas.length;i++){
    var b=S.bancas[i];if(b.id===(V&&V.id))continue;
    for(var j=0;j<b.itens.length;j++){
      var x=b.itens[j];
      if((x.c===it.c||normS(x.n)===nm)&&!mv.some(function(m){return m.id===b.id&&m.c===x.c}))return{b:b,x:x};
    }
  }
  return null;
}
function codesTxt(it){
  var p=[];
  if(it.b)p.push("Balança "+it.b);
  if(it.d)p.push("Cód. interno "+it.d);
  if(!p.length&&it.e)p.push("EAN "+it.e);
  if(!p.length&&it.c&&normS(it.c)!==normS(it.n))p.push("Cód. "+it.c);
  return esc(p.join(" · "));
}
function codesBig(it){
  var p=[];
  if(it.b)p.push("<span><small>BALANÇA</small><b>"+esc(it.b)+"</b></span>");
  if(it.d)p.push("<span><small>CÓD. INTERNO</small><b>"+esc(it.d)+"</b></span>");
  if(!p.length&&it.e)p.push("<span><small>EAN</small><b>"+esc(it.e)+"</b></span>");
  if(!p.length&&it.c&&normS(it.c)!==normS(it.n))p.push("<span><small>CÓDIGO</small><b>"+esc(it.c)+"</b></span>");
  return p.join("");
}

/* ---- lista colada (código;nome;un) ---- */
function parseItens(txt){
  var out=[],seen={},cat=merged();
  txt.split(/\n/).forEach(function(line){
    line=line.trim();if(!line)return;
    var p;
    if(/[;\t]/.test(line))p=line.split(/[;\t]/).map(function(x){return x.trim()});
    else{var m=line.match(/^(\S+)\s+(.+)$/);p=m?[m[1],m[2]]:[line,line]}
    var c=p[0],n=p[1]||p[0],un=/^un/i.test(p[2]||"");
    if(!c)return;
    var q=c.toLowerCase(),hit=null;
    for(var i=0;i<cat.length&&!hit;i++){if(codeEq(q,cat[i].b)||codeEq(q,cat[i].d)||codeEq(q,cat[i].e))hit=cat[i]}
    var it=hit?toItem(hit):{c:c.slice(0,24),n:n.slice(0,60),u:"kg",b:"",d:"",e:""};
    if(un)it.u="un";
    if(seen[it.c])return;seen[it.c]=1;out.push(it);
  });
  return out;
}

/* ---- código de barras EAN-13 no formato da etiqueta de balança ---- */
function fmtB(){   // formato da etiqueta PRIX: UPC-A, 12 dígitos, o valor é o preço total em centavos
  return{cd:5,vd:5,div:100,ok:true,upc:true,price:true};
}
function pad(s,n){s=String(s);while(s.length<n)s="0"+s;return s}
function chk(b12){var s=0;for(var i=0;i<12;i++)s+=(+b12[i])*(i%2===0?1:3);return(10-s%10)%10}
function pkFor(it){   // preço do kg: guardado na Doação (por nome), pela conferência (por código) ou digitado no relatório
  var v=window.vmPk?window.vmPk.get(it.n):0;if(v>0)return v;
  var m=rd("validamais-precokg-plu",{}),p=Number(m[String(parseInt(it.b,10))]);return p>0?p:0;
}
function ean13(plu,kg,f,pk){   // lista de códigos (13 dígitos, ou 12 no formato UPC-A) — divide se passar do limite de valor
  if(!isNum(String(plu)))return null;
  var pluS=String(parseInt(plu,10));if(pluS.length>f.cd)return null;pluS=pad(pluS,f.cd);
  var max=Math.pow(10,f.vd)-1,tot=f.price?Math.round(kg*pk*100):Math.round(kg*f.div),out=[];
  if(!(tot>0))return null;
  while(tot>0){var part=Math.min(tot,max);tot-=part;var body="2"+pluS+pad(part,f.vd);out.push(f.upc?body+chk("0"+body):body+chk(body))}
  return out;
}
var EL=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
var EG=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
var ER=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
var EP=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
function eanSvg(code){
  var upc=code.length===12;if(upc)code="0"+code;
  var d=code.split("").map(Number),bits="101",par=EP[d[0]],i;
  for(i=1;i<=6;i++)bits+=(par.charAt(i-1)==="L"?EL:EG)[d[i]];
  bits+="01010";
  for(i=7;i<=12;i++)bits+=ER[d[i]];
  bits+="101";
  var q=9,h=60,gh=66,W=95+2*q,H=gh+13,r="";
  i=0;
  while(i<95){
    if(bits.charAt(i)==="1"){var j=i;while(j<95&&bits.charAt(j)==="1")j++;
      var guard=i<3||(i>=45&&i<50)||i>=92;
      r+='<rect x="'+(q+i)+'" y="0" width="'+(j-i)+'" height="'+(guard?gh:h)+'"/>';i=j}
    else i++;
  }
  var t='<text x="'+(q-3)+'" y="'+(H-2)+'" text-anchor="end">'+code.charAt(upc?1:0)+'</text>';
  if(upc){for(i=0;i<5;i++)t+='<text x="'+(q+10+7*i+3.5)+'" y="'+(H-2)+'" text-anchor="middle">'+code.charAt(2+i)+'</text>';
    for(i=0;i<5;i++)t+='<text x="'+(q+50+7*i+3.5)+'" y="'+(H-2)+'" text-anchor="middle">'+code.charAt(7+i)+'</text>';
    t+='<text x="'+(q+95+3)+'" y="'+(H-2)+'" text-anchor="start">'+code.charAt(12)+'</text>';}
  else{for(i=0;i<6;i++)t+='<text x="'+(q+3+7*i+3.5)+'" y="'+(H-2)+'" text-anchor="middle">'+code.charAt(1+i)+'</text>';
  for(i=0;i<6;i++)t+='<text x="'+(q+50+7*i+3.5)+'" y="'+(H-2)+'" text-anchor="middle">'+code.charAt(7+i)+'</text>';}
  return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Código de barras '+code+'"><rect width="'+W+'" height="'+H+'" fill="#fff"/><g fill="#000" shape-rendering="crispEdges">'+r+'</g><g fill="#000" font-family="Arial,Helvetica,sans-serif" font-size="10">'+t+'</g></svg>';
}

/* ---- compartilhar / importar ---- */
function enc(o){return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function dec(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return JSON.parse(decodeURIComponent(escape(atob(s))))}
function link(o){return location.href.split("#")[0]+"#inv="+enc(o)}
function pack(a){return a.map(function(x){return[x.c,x.n,x.u,x.b||"",x.d||"",x.e||""]})}
function unpack(a){
  if(!Array.isArray(a))throw 0;
  return a.slice(0,500).map(function(r){
    if(!Array.isArray(r)||!r[0])throw 0;
    return{c:String(r[0]).slice(0,40),n:String(r[1]||r[0]).slice(0,60),u:r[2]==="un"?"un":"kg",b:String(r[3]||"").slice(0,12),d:String(r[4]||"").slice(0,12),e:String(r[5]||"").slice(0,20)};
  });
}
function cfgLink(l){return link({k:"cfg",b:l.map(function(b){return{id:b.id,n:b.nome,i:pack(b.itens),cor:corOf(b)}})})}
function resLink(b){
  var e=eff(b),l={};
  b.itens.forEach(function(it){var a=lansOf(b,it.c);if(a.length)l[it.c]=a.map(function(x){return[x[0],x[1]]})});
  return link({k:"res",id:b.id,n:b.nome,i:pack(b.itens),c:e.cont,l:l,por:e.por||me(),t:e.t||Date.now(),cor:corOf(b)});
}
function share(msg){
  if(navigator.share){navigator.share({text:msg}).catch(function(e){if(e&&e.name==="AbortError")return;window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank")});return}
  window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");
}
function copy(t){
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){toast("Copiado")},function(){prompt("Copie o texto:",t)});
  else prompt("Copie o texto:",t);
}
function imp(o){
  if(o.k==="cfg"&&Array.isArray(o.b)){
    var a=0,u=0;
    o.b.slice(0,30).forEach(function(x){
      var items=unpack(x.i),b=S.bancas.filter(function(y){return y.id===x.id})[0];
      if(b){b.nome=String(x.n).slice(0,40);b.itens=items;u++;if(okCor(x.cor))b.cor=x.cor}
      else{b={id:String(x.id).slice(0,12),nome:String(x.n).slice(0,40),itens:items,cont:{},lan:{},cor:okCor(x.cor)?x.cor:firstUnused(),ord:Date.now()+a};S.bancas.push(b);a++}
      pushBanca(b);
    });
    save();return a+" banca(s) nova(s), "+u+" atualizada(s)";
  }
  if(o.k==="res"&&o.c&&typeof o.c==="object"){
    var b2=S.bancas.filter(function(y){return y.id===o.id})[0];
    if(!b2){b2={id:String(o.id).slice(0,12),nome:String(o.n).slice(0,40),itens:unpack(o.i),cont:{},lan:{},cor:okCor(o.cor)?o.cor:firstUnused(),ord:Date.now()};S.bancas.push(b2);pushBanca(b2)}
    var cont={},lan={};
    Object.keys(o.c).forEach(function(k){if(typeof o.c[k]==="number"&&isFinite(o.c[k]))cont[k]=o.c[k]});
    if(o.l&&typeof o.l==="object")Object.keys(o.l).forEach(function(k){
      if(!Array.isArray(o.l[k]))return;
      lan[k]=o.l[k].filter(function(x){return Array.isArray(x)&&typeof x[0]==="number"&&isFinite(x[0])}).map(function(x){return[x[0],Number(x[1])||0]});
    });
    var por=String(o.por||"").slice(0,40);
    if(CL.on){   // nuvem: grava só os produtos que ainda não foram contados nesta banca
      var keys={},n=0;Object.keys(cont).forEach(function(k){keys[k]=1});Object.keys(lan).forEach(function(k){keys[k]=1});
      b2.lan=b2.lan||{};b2.cont=b2.cont||{};b2.pi=b2.pi||{};
      Object.keys(keys).forEach(function(k){
        if((b2.lan[k]&&b2.lan[k].length)||typeof b2.cont[k]==="number")return;
        var ls=lan[k]&&lan[k].length?lan[k]:(cont[k]>0?[[cont[k],Number(o.t)||Date.now()]]:[]);
        b2.lan[k]=[];
        ls.forEach(function(x,j){var l=[x[0],x[1]||Date.now(),lanId(b2.id,k)+j,por||me()];b2.lan[k].push(l);pushLan(b2,k,l)});
        if(typeof cont[k]==="number"){b2.cont[k]=sumL(b2.lan[k]);pushFin(b2,k,true)}
        b2.pi[k]=por||me();n++;
      });
      b2.t=Date.now();b2.por=por||b2.por||me();save();
      return b2.nome+": "+n+" produto(s) importado(s) de "+(por||"?");
    }
    b2.ext={por:por,t:Number(o.t)||0,cont:cont,lan:lan};save();
    return b2.nome+": resultado de "+(b2.ext.por||"?")+" importado";
  }
  throw 0;
}
function importText(txt){
  var m=txt.match(/[#&?]inv=([A-Za-z0-9_-]+)/)||txt.match(/^\s*([A-Za-z0-9_-]{20,})\s*$/);
  if(!m)throw 0;
  return imp(dec(m[1]));
}

/* ---- telas (lista) ---- */
var V={v:"home"};
function btn(cls,act,txt,id){return'<button type="button" class="'+cls+'" data-iv="'+act+'"'+(id?' data-id="'+id+'"':'')+'>'+txt+'</button>'}
function full(h){return h.replace(/class="(primary|secondary|danger)"/,'class="$1" style="width:100%"')}
function barHtml(p,col){return'<div class="prog"><div style="width:'+p+'%'+(col?';background:'+col:'')+'"></div></div>'}
function card(b,inner){return'<section class="panel" style="border-left:5px solid '+corOf(b)+'">'+inner+'</section>'}

function swipeBtn(id,txt){return'<div class="ivsw" data-id="'+id+'" style="flex:1"><div class="ivswt">'+esc(txt)+' ›››</div><div class="ivswh" role="button" tabindex="0" aria-label="'+esc(txt)+'">›</div></div>'}
function vib(n){try{if(navigator.vibrate)navigator.vibrate(n)}catch(e){}}
function initSwipe(){
  var els=document.querySelectorAll("#ivMain .ivsw");
  Array.prototype.forEach.call(els,function(el){
    var h=el.querySelector(".ivswh"),t=el.querySelector(".ivswt"),x0=0,mx=0,on=false,tick=0,go=false;
    function lim(){return el.clientWidth-h.offsetWidth-4}
    function set(x){x=Math.max(0,Math.min(lim(),x));h.style.transform="translateX("+x+"px)";t.style.opacity=String(1-x/Math.max(1,lim())*1.3);return x}
    function start(){if(go)return;go=true;vib([30,40,30]);var b=S.bancas.filter(function(y){return y.id===el.dataset.id})[0];if(!b)return;b.cont=b.cont||{};V={v:"count",id:b.id,i:nextPending(b,0)};render();window.scrollTo(0,0)}
    h.addEventListener("pointerdown",function(e){on=true;swiping=true;x0=e.clientX;try{h.setPointerCapture(e.pointerId)}catch(_){}h.style.transition="none";vib(8)});
    h.addEventListener("pointermove",function(e){if(!on)return;var x=set(e.clientX-x0);mx=x;var k=Math.floor(x/lim()*6);if(k!==tick){tick=k;vib(6)}});
    function end(){if(!on)return;on=false;swiping=false;if(CL.late){CL.late=false;setTimeout(liveRender,0)}h.style.transition="transform .2s";t.style.opacity="1";if(mx>=lim()*.85){set(lim());start()}else set(0);mx=0;tick=0}
    h.addEventListener("pointerup",end);h.addEventListener("pointercancel",end);
    h.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();start()}});
  });
}

function qFind(q){
  q=normS(q);if(!q)return[];var toks=q.split(/\s+/),out=[];
  S.bancas.forEach(function(b){b.itens.forEach(function(it,i){
    var n=normS(it.n),sc=0;
    if(codeEq(q,it.b)||codeEq(q,it.d)||codeEq(q,it.e))sc=100;
    else if((it.b&&String(it.b).toLowerCase().indexOf(q)===0)||(it.d&&String(it.d).toLowerCase().indexOf(q)===0))sc=60;
    else if(n.indexOf(q)===0)sc=40;
    else if(toks.every(function(t){return n.indexOf(t)>=0}))sc=20;
    if(sc)out.push({b:b,i:i,it:it,sc:sc})
  })});
  out.sort(function(a,b){return b.sc-a.sc||a.it.n.localeCompare(b.it.n)});
  return out.slice(0,8);
}
function qRes(){
  var q=(g("ivQ")||{}).value||"",el=g("ivQRes");if(!el)return;
  if(!q.trim()){el.innerHTML="";return}
  var r=qFind(q);
  el.innerHTML=r.length?r.map(function(x){
    var ls=lansOf(x.b,x.it.c),c=eff(x.b).cont||{},ok=typeof c[x.it.c]==="number";
    var st=ok?(c[x.it.c]===0?"sem estoque":fmt3(c[x.it.c])+" "+x.it.u):ls.length?fmt3(sumL(ls))+" "+x.it.u+"…":"";
    return'<div class="ivli" data-iv="qgo" data-id="'+x.b.id+'" data-i="'+x.i+'"><span><b style="white-space:normal;font-size:16px">'+esc(x.it.n)+'</b><small>'+tag(x.b)+' '+esc(codesTxt(x.it))+'</small></span>'+(st?'<b style="color:var(--g)">'+st+'</b>':'<b style="color:var(--mut)">›</b>')+'</div>';
  }).join(""):'<small class="note">Nenhum produto das bancas com esse nome ou código.</small>';
}
function ring(p,col){return'<div class="ivring'+(p===100?' full':'')+'" style="--p:'+p+';--c:'+col+'">'+(p===100?'<b>✓</b>':'<b>'+p+'<i>%</i></b>')+'</div>'}
function vHome(){
  var T=totals(),h='',nb=S.bancas.length;
  if(nb){
    var segs=T.rows.map(function(r){return'<i style="flex:'+Math.max(1,r.s.m)+';--c:'+corOf(r.b)+'"><u style="width:'+r.s.pct+'%"></u></i>'}).join("");
    h+='<section class="ivhero"><div class="ivh-row"><div class="ivh-big"><b>'+fmt(T.kg)+'</b><span>kg contados'+(T.un?' · '+fmt(T.un)+' un':'')+'</span></div><div class="ivh-pct">'+T.pct+'%</div></div>'
      +'<div class="ivsegs" aria-hidden="true">'+segs+'</div>'
      +'<p class="ivh-s">'+T.n+' de '+T.m+' produtos contados em '+nb+(nb>1?' bancas':' banca')+'</p></section>'
      +'<div class="ivfind"><input id="ivQ" class="ivq" type="search" placeholder="Buscar produto para lançar direto" aria-label="Buscar produto para lançar direto" autocomplete="off"><div class="ivqr" id="ivQRes"></div></div>';
  }else h+='<section class="ivempty"><div class="ive-ico">📦</div><h2>Monte sua primeira banca</h2><p>Uma banca é um grupo de produtos para contar junto, como a bancada das frutas. Busque pelo código ou importe o link que alguém enviou.</p>'+btn("primary big","new","＋ Nova banca")+'</section>';
  T.rows.forEach(function(r){
    var b=r.b,s=r.s,ok=s.pct===100,c=corOf(b);
    h+='<section class="ivb'+(ok?' done':'')+'" style="--c:'+c+'"><div class="ivb-top">'+ring(s.pct,c)+'<div class="ivb-t"><h3>'+esc(b.nome)+'</h3><p>'+s.n+' de '+s.m+' produtos'+(s.kg?' · '+fmt(s.kg)+' kg':'')+(s.un?' · '+fmt(s.un)+' un':'')+'</p>'+(s.por?'<p class="ivb-who">'+esc(s.por)+(s.e&&s.e.t?' às '+hhmm(s.e.t):'')+'</p>':'')+'</div></div>'
      +'<div class="toolbar ivb-act">'+swipeBtn(b.id,s.n===0?"Começar":ok?"Revisar":"Continuar")+btn("secondary","sendres","Enviar",b.id)+'</div></section>';
  });
  h+='<div class="ivtiles">'+btn("ivtile","cfg",'<span>⚙️</span>Bancas')+btn("ivtile","sum",'<span>📊</span>Resumo')+btn("ivtile","chk",'<span>✅</span>Conferir bancas')+btn("ivtile","imp",'<span>📥</span>Importar')+'</div>'
    +(nb?'<div class="ivsp"></div>'+full(btn("primary","rel","📄 Relatório e códigos de barras")):'');
  return h;
}

function ownerBy(m){
  var nm=normS(m.n),k=toItem(m).c;
  for(var i=0;i<S.bancas.length;i++){var b=S.bancas[i];
    for(var j=0;j<b.itens.length;j++){var x=b.itens[j];if(x.c===k||normS(x.n)===nm)return b}}
  return null;
}
function chkData(){
  var all=merged(),cats={};
  all.forEach(function(m){var c=m.cat||"Sem categoria";cats[c]=(cats[c]||0)+1});
  var names=Object.keys(cats).sort();
  if(V.cat===undefined)V.cat=cats.FLV?"FLV":"";
  var rows=all.filter(function(m){return!V.cat||(m.cat||"Sem categoria")===V.cat}).map(function(m){return{m:m,b:ownerBy(m)}});
  rows.sort(function(a,b){return normS(a.m.n)<normS(b.m.n)?-1:1});
  return{rows:rows,names:names,cats:cats,falta:rows.filter(function(r){return!r.b}),ok:rows.filter(function(r){return r.b})};
}
function codesTxt(m){var a=[];if(m.b)a.push("Balança "+m.b);if(m.d)a.push("Cód. interno "+m.d);if(m.e)a.push("EAN "+m.e);return a.join(" · ")||"sem código"}
function chkText(){
  var D=chkData();
  var t="Conferência do inventário"+(V.cat?" — "+V.cat:"")+"\n"+D.ok.length+" de "+D.rows.length+" produtos já estão em uma banca.\n";
  if(D.falta.length){t+="\nFALTAM em alguma banca ("+D.falta.length+"):\n";D.falta.forEach(function(r){t+="• "+r.m.n+" ("+codesTxt(r.m)+")\n"})}
  else t+="\nTodos os produtos estão em alguma banca.\n";
  return t;
}
function vChk(){
  var D=chkData(),tot=D.rows.length,p=tot?Math.round(D.ok.length*100/tot):0;
  var h='<section class="panel"><div class="toolbar">'+btn("secondary","home","← Voltar")+btn("secondary","cfg","⚙️ Bancas")+'</div></section>';
  if(!tot)return h+'<section class="panel"><p class="note">Nenhum produto no catálogo do app ainda. Abra a aba de produtos para carregá-lo.</p></section>';
  h+='<section class="panel"><h2 class="h2">Todos estão em uma banca?</h2><div class="ivchips" style="gap:8px">';
  D.names.forEach(function(c){h+='<button type="button" class="secondary'+((V.cat||"")===c?' primary':'')+'" data-iv="chkcat" data-c="'+esc(c)+'" style="min-height:40px;padding:0 12px">'+esc(c)+' ('+D.cats[c]+')</button>'});
  h+='<button type="button" class="secondary'+(!V.cat?' primary':'')+'" data-iv="chkcat" data-c="" style="min-height:40px;padding:0 12px">Todas</button></div>'
    +'<div class="qh" style="margin-top:12px"><b>'+D.ok.length+' de '+tot+' produtos em banca</b><span class="hbadge">'+p+'%</span></div>'+barHtml(p)+'</section>';
  if(D.falta.length){
    h+='<section class="panel"><h2 class="h2" style="color:#e0a000">⚠ Faltam ('+D.falta.length+')</h2><small class="note">Escolha a banca na caixa ao lado de cada produto para incluí-lo.</small>';
    D.falta.forEach(function(r){
      var i=D.rows.indexOf(r);
      h+='<div class="ivli" style="display:block;cursor:default"><b>'+esc(r.m.n)+'</b><small class="note" style="margin:0">'+esc(codesTxt(r.m))+'</small>'
        +'<select data-chk="'+i+'" style="width:100%;margin-top:6px;min-height:44px"><option value="">Incluir em…</option>'+S.bancas.map(function(b){return'<option value="'+b.id+'">'+esc(b.nome)+'</option>'}).join("")+'</select></div>';
    });
    h+='</section>';
  }else h+='<section class="panel ivok">✔ Todos os produtos estão em alguma banca.</section>';
  h+='<section class="panel"><h2 class="h2">Já nas bancas ('+D.ok.length+')</h2>';
  S.bancas.forEach(function(b){
    var l=D.ok.filter(function(r){return r.b===b});if(!l.length)return;
    h+='<div style="margin:10px 0 4px">'+tag(b)+' <small class="note" style="display:inline">'+l.length+'</small></div>';
    l.forEach(function(r){h+='<div class="ivli" style="cursor:default;border-left:5px solid '+corOf(b)+'"><span><b>'+esc(r.m.n)+'</b><br><small class="note" style="margin:0">'+esc(codesTxt(r.m))+'</small></span></div>'});
  });
  h+='</section><div class="toolbar"><button type="button" class="primary big" data-iv="chkshare">Enviar lista</button><button type="button" class="secondary big" data-iv="chkcopy">Copiar</button></div>';
  return h;
}
function vCfg(){
  var h='<section class="panel"><div class="toolbar">'+btn("secondary","home","← Voltar")+btn("primary","new","＋ Nova banca")+'</div></section>';
  S.bancas.forEach(function(b){
    h+=card(b,'<div class="qh" style="margin-bottom:8px">'+tag(b,true)+'<span class="hbadge">'+b.itens.length+' produtos</span></div><div class="toolbar">'+btn("secondary","edit","Editar",b.id)+btn("secondary","sendcfg","Enviar p/ contador",b.id)+'</div>');
  });
  if(S.bancas.length>1)h+=full(btn("secondary","sendall","Enviar todas as bancas"))+'<div class="ivsp"></div>';
  if(S.bancas.length)h+='<small class="note">As bancas e os produtos de cada uma ficam salvos para os próximos inventários.</small>'+full(btn("danger","reset","🔄 Novo inventário (zera as contagens)"));
  return h;
}
function vEdit(){
  var b=V.id?S.bancas.filter(function(x){return x.id===V.id})[0]:null;
  return'<section class="panel"><h2 class="h2">'+(b?"Editar banca":"Nova banca")+'</h2>'
    +'<label for="ivNome">Nome da banca</label><input id="ivNome" placeholder="Ex.: Banca das Frutas" maxlength="40" value="'+esc(V.nome||"")+'">'
    +'<label>Cor da banca</label><div class="ivchips">'+PAL.map(function(c){return'<button type="button" class="ivchip'+(c===V.cor?' sel':'')+'" style="background:'+c+'" data-iv="cor" data-c="'+c+'" aria-label="Cor"></button>'}).join("")+'</div>'
    +'<div id="ivPrevTag" style="margin:8px 0 2px"></div>'
    +'<label for="ivBusca">Buscar produto: código de barras, balança, código interno ou nome</label>'
    +'<input id="ivBusca" type="search" placeholder="Ex.: 123, B1, EAN ou banana" autocomplete="off">'
    +'<div id="ivRes" class="rows"></div></section>'
    +'<section class="panel"><div class="qh"><h2 class="h2" style="margin:0">Produtos da banca</h2><span class="hbadge" id="ivECount">0</span></div><div id="ivEList" style="margin-top:6px"></div>'
    +'<details style="margin-top:10px"><summary>Colar lista de códigos</summary>'
    +'<textarea id="ivItens" placeholder="123&#10;B1&#10;1003;Abacaxi;un"></textarea>'
    +'<small class="note">Um por linha. Códigos que existem no cadastro entram com nome e os dois códigos. Para item por unidade, termine com ;un</small>'
    +'<div class="ivsp"></div>'+full(btn("secondary","addpaste","Adicionar à banca"))+'</details></section>'
    +'<div class="toolbar">'+btn("secondary big","cfg","Cancelar")+btn("primary big","saveb","Salvar")+'</div>'
    +(b?'<div class="ivsp"></div>'+full(btn("danger","delb","Excluir banca")):'');
}
function renderPrevTag(){
  var el=g("ivPrevTag");if(!el)return;
  var c=V.cor||PAL[0];
  el.innerHTML='<span class="ivtag big" style="background:'+c+';color:'+inkOn(c)+'">'+esc((V.nome||"").trim()||"Nome da banca")+'</span>';
}
function renderEList(){
  var el=g("ivEList");if(!el)return;
  g("ivECount").textContent=V.items.length+" produtos";
  el.innerHTML=V.items.length?V.items.map(function(it,i){
    return'<div class="ivli" style="cursor:default"><span>'+esc(it.n)+'<small>'+codesTxt(it)+'</small></span><span class="ivrow" style="flex:none"><button type="button" class="secondary" style="min-height:36px;padding:0 12px" data-iv="unit" data-i="'+i+'" aria-label="Trocar unidade">'+it.u+'</button><button type="button" class="danger" style="min-height:36px;padding:0 12px" data-iv="rm" data-i="'+i+'" aria-label="Remover">✕</button></span></div>';
  }).join(""):'<small class="note">Busque um produto acima para adicioná-lo.</small>';
}
function renderRes(){
  var el=g("ivRes");if(!el)return;
  var q=g("ivBusca").value;V.hits=[];
  if(!q.trim()){el.innerHTML="";return}
  if(!merged().length){el.innerHTML='<small class="note">O cadastro de produtos ainda não carregou. Aguarde um instante ou use «Colar lista de códigos».</small>';return}
  V.hits=search(q);
  if(!V.hits.length){
    var d=q.replace(/\D/g,"");
    if(d===q.trim()&&d.length>=6&&d.length<=13){
      var sc=window.vmScale&&vmScale.is(d);
      el.innerHTML='<div class="pick" style="cursor:default"><b>Código '+esc(d)+' não está cadastrado</b><br><small class="muted">Digite o nome para cadastrar e já colocar na banca.</small><input id="ivNewNome" maxlength="60" placeholder="Nome do produto" autocomplete="off" style="margin-top:8px"><button type="button" class="primary big" data-iv="newprod" data-code="'+d+'" style="margin-top:8px;width:100%">Cadastrar e adicionar</button></div>';return}
    el.innerHTML='<small class="note">Nenhum produto encontrado para «'+esc(q)+'». Para cadastrar por código, digite só os números (6 a 13 dígitos).</small>';return}
  el.innerHTML=V.hits.map(function(h,i){
    var it=toItem(h),has=V.items.some(function(x){return x.c===it.c}),own=has?null:ownerOf(it);
    return'<div class="pick" data-iv="add" data-i="'+i+'"><b>'+esc(h.n)+'</b>'+(has?' <span class="hbadge">✓ na banca</span>':own?' <span class="hbadge" style="background:#fdf0c4;color:#7c5a00">na «'+esc(own.b.nome)+'»</span>':'')+'<br><small class="muted">'+(codesTxt(it)||"sem código")+'</small></div>';
  }).join("");
}
function addHit(i){
  var h=V.hits&&V.hits[i];if(!h)return;
  var it=toItem(h);
  if(V.items.some(function(x){return x.c===it.c})){toast("Já está na banca");return}
  var own=ownerOf(it);
  if(own){
    if(!confirm("«"+it.n+"» já pertence à «"+own.b.nome+"». Mover para esta banca?"))return;
    V.moved.push({id:own.b.id,c:own.x.c});
  }
  V.items.push(it);renderEList();
  var b=g("ivBusca");b.value="";renderRes();b.focus();toast("Adicionado: "+it.n);
}
function sumText(){
  var T=totals(),t="INVENTÁRIO FLV — "+new Date().toLocaleDateString("pt-BR")+"\n";
  T.rows.forEach(function(r){t+=r.b.nome+": "+fmt(r.s.kg)+" kg ("+pctOf(r.s.kg,T.kg)+"%) · "+r.s.pct+"% contado"+(r.s.por?" · "+r.s.por:"")+"\n"});
  return t+"TOTAL: "+fmt(T.kg)+" kg"+(T.un?" + "+fmt(T.un)+" un":"")+" · avanço "+T.pct+"%";
}
function vSum(){
  var T=totals(),h='<section class="panel"><div class="toolbar">'+btn("secondary","home","← Voltar")+btn("primary","rel","📄 Relatório")+'</div></section>';
  if(!S.bancas.length)return h+'<section class="panel"><p class="note">Nada para mostrar ainda.</p></section>';
  h+='<section class="panel"><div class="qh"><h2 class="h2" style="margin:0">Avanço geral</h2><span class="hbadge">'+T.pct+'%</span></div>'+barHtml(T.pct)+'</section>';
  h+='<section class="panel"><div class="rwrap"><table class="ivtbl"><thead><tr><th>Banca</th><th>Avanço</th><th>kg</th><th>% total</th></tr></thead><tbody>';
  T.rows.forEach(function(r){h+='<tr><td><span class="ivdot" style="background:'+corOf(r.b)+'"></span><b>'+esc(r.b.nome)+'</b>'+(r.s.por?'<small>'+esc(r.s.por)+'</small>':'')+'</td><td>'+r.s.pct+'%</td><td>'+fmt(r.s.kg)+'</td><td>'+pctOf(r.s.kg,T.kg)+'%</td></tr>'});
  h+='</tbody><tfoot><tr><td>Total</td><td>'+T.pct+'%</td><td>'+fmt(T.kg)+'</td><td>'+(T.kg?'100%':'0%')+'</td></tr></tfoot></table></div>'+(T.un?'<small class="note">Itens por unidade: '+fmt(T.un)+' un</small>':'')+'</section>';
  if(T.prod.length){
    h+='<section class="panel"><h2 class="h2">Por produto</h2><div class="rwrap"><table class="ivtbl"><tbody>';
    T.prod.forEach(function(p){h+='<tr><td>'+esc(p.n)+'<small>'+[codesTxt(p)].filter(Boolean).join(" · ")+'</small><small><span class="ivdot" style="background:'+p.bc+'"></span>'+esc(p.bn||"")+'</small></td><td>'+fmt3(p.v)+' '+p.u+'</td><td>'+(p.u==="kg"?pctOf(p.v,T.kg)+"%":"")+'</td></tr>'});
    h+='</tbody></table></div></section>';
  }
  h+='<div class="toolbar">'+btn("primary big","sharesum","Enviar resumo")+btn("secondary big","copysum","Copiar")+'</div>';
  if(S.hist&&S.hist.length){
    h+='<section class="panel" style="margin-top:12px"><h2 class="h2">Inventários anteriores</h2>';
    S.hist.forEach(function(x,i){h+='<details><summary>'+new Date(x.t).toLocaleDateString("pt-BR")+'</summary><pre style="white-space:pre-wrap;font:inherit;font-size:13px;margin:6px 0">'+esc(x.txt)+'</pre>'+btn("secondary","copyhist","Copiar").replace('data-iv="copyhist"','data-iv="copyhist" data-i="'+i+'"')+'</details>'});
    h+='</section>';
  }
  return h;
}
function vImp(){
  return'<section class="panel"><h2 class="h2">Importar</h2><p class="note">Cole o link (ou código) recebido: pode ser uma banca para contar ou o resultado de outra pessoa.</p>'
    +'<textarea id="ivImpTxt" style="min-height:120px" placeholder="Cole aqui"></textarea>'
    +'<div class="toolbar" style="margin-top:10px">'+btn("secondary big","home","Cancelar")+btn("primary big","doimp","Importar")+'</div></section>';
}

/* ---- relatório de lançamentos + códigos de barras ---- */
function relData(only){
  var T=totals(),out=[];
  S.bancas.forEach(function(b){
    if(only&&b.id!==only)return;
    var s=stats(b),e=s.e,items=[];
    b.itens.forEach(function(it){
      var ls=lansOf(b,it.c),done=typeof e.cont[it.c]==="number";
      if(!ls.length&&!done)return;
      items.push({it:it,ls:ls,total:done?e.cont[it.c]:sumL(ls),done:done});
    });
    out.push({b:b,s:s,items:items});
  });
  return{T:T,bancas:out};
}
function bcList(D){
  var f=fmtB(),out=[];
  D.bancas.forEach(function(r){
    r.items.forEach(function(x){
      if(!(x.total>0))return;
      var o={b:r.b,it:x.it,total:x.total};
      if(!x.done)o.err="Contagem deste produto ainda em andamento (toque em Concluir).";
      else if(x.it.u==="un")o.err="Item por unidade: informe "+fmt3(x.total)+" un manualmente (não tem código de peso).";
      else if(!x.it.b||!isNum(String(x.it.b)))o.err="Sem código de balança no cadastro do produto.";
      else if(f.price&&!(pkFor(x.it)>0)){o.err="Sem o preço do kg deste produto (a etiqueta traz o preço total). Informe abaixo.";o.needPk=true}
      else{o.pk=f.price?pkFor(x.it):0;var cs=ean13(x.it.b,x.total,f,o.pk);if(!cs)o.err="Código de balança não cabe no formato configurado.";else o.codes=cs}
      out.push(o);
    });
  });
  return out;
}
function relText(only){
  var D=relData(only),f=fmtB(),t="RELATÓRIO DO INVENTÁRIO FLV — "+new Date().toLocaleDateString("pt-BR")+"\n";
  D.bancas.forEach(function(r){
    t+="\n■ "+r.b.nome+" — "+fmt(r.s.kg)+" kg ("+pctOf(r.s.kg,D.T.kg)+"%)"+(r.s.por?" · "+r.s.por:"")+"\n";
    r.items.forEach(function(x){
      var ls=x.ls.map(function(l){return fmt3(l[0])}).join(" + ");
      t+="• "+x.it.n+": "+(x.ls.length>1?ls+" = ":"")+fmt3(x.total)+" "+x.it.u+(x.done?"":" (em andamento)")+"\n";
    });
  });
  t+="\nTOTAL: "+fmt(D.T.kg)+" kg"+(D.T.un?" + "+fmt(D.T.un)+" un":"");
  var bc=bcList(D).filter(function(o){return o.codes});
  if(bc.length){
    t+="\n\nCÓDIGOS DE BARRAS PARA COLETA"+(f.ok?"":" (formato ainda não conferido com etiqueta real)")+"\n";
    bc.forEach(function(o){o.codes.forEach(function(c){t+=o.it.n+": "+c+"\n"})});
  }
  return t.replace(/\s+$/,"");
}
function vRel(){
  var D=relData(V.rb),f=fmtB(),h='';
  h+='<section class="panel noprint"><div class="toolbar">'+btn("secondary","home","← Voltar")+btn("primary","print","🖨️ Imprimir / PDF")+'</div>'
    +'<div class="toolbar" style="margin-top:8px">'+btn("secondary","sharerel","💬 Enviar texto")+btn("secondary","copyrel","Copiar texto")+'</div></section>';
  h+='<div class="ivrel"><h2>Relatório do inventário FLV</h2><p class="sub">'+new Date().toLocaleDateString("pt-BR")+' '+hhmm(Date.now())+' · gerado por '+esc(me())+'</p>';
  if(!D.bancas.some(function(r){return r.items.length}))h+='<p>Nenhum lançamento ainda.</p>';
  D.bancas.forEach(function(r){
    if(!r.items.length)return;
    var c=corOf(r.b);
    h+='<div class="ivrb" style="border-left-color:'+c+'"><div class="ivrbh">'+tag(r.b,true)+'<span>'+fmt(r.s.kg)+' kg · '+pctOf(r.s.kg,D.T.kg)+'% do total'+(r.s.por?' · contado por '+esc(r.s.por):'')+'</span></div>'
      +'<table><thead><tr><th>Produto</th><th>Lançamentos</th><th>Total</th></tr></thead><tbody>';
    r.items.forEach(function(x){
      h+='<tr><td>'+esc(x.it.n)+'<small>'+codesTxt(x.it)+'</small></td><td>'
        +x.ls.map(function(l,i){return'<div>'+(i+1)+') '+fmt3(l[0])+' '+x.it.u+(l[1]?' <small style="display:inline">· '+hhmm(l[1])+'</small>':'')+'</div>'}).join("")
        +(x.ls.length?'':'<small>sem estoque</small>')+'</td><td class="tot">'+fmt3(x.total)+' '+x.it.u+(x.done?'':'<small>em andamento</small>')+'</td></tr>';
    });
    h+='</tbody></table></div>';
  });
  h+='<h3>Resumo por banca</h3><table><thead><tr><th>Banca</th><th>Avanço</th><th>kg</th><th>% do total</th></tr></thead><tbody>';
  D.bancas.forEach(function(r){h+='<tr><td><span class="ivdot" style="background:'+corOf(r.b)+'"></span>'+esc(r.b.nome)+'</td><td>'+r.s.pct+'%</td><td>'+fmt(r.s.kg)+'</td><td>'+pctOf(r.s.kg,D.T.kg)+'%</td></tr>'});
  h+='<tr><td class="tot">Total</td><td class="tot">'+D.T.pct+'%</td><td class="tot">'+fmt(D.T.kg)+'</td><td class="tot">'+(D.T.kg?'100%':'0%')+'</td></tr></tbody></table>';
  h+='<h3>Códigos de barras para coleta (um por produto)</h3>';
  h+='<div class="ivok noprint">Formato da etiqueta PRIX (UPC-A, 12 dígitos, preço total). Informe o preço do kg de cada produto uma única vez.</div>';
  var bc=bcList(D);
  if(!bc.length)h+='<p>Conclua ao menos um produto para gerar o código.</p>';
  h+='<div class="ivbcs">';
  bc.forEach(function(o){
    var head='<div class="ivbch">'+tag(o.b)+'</div><div class="ivbch">'+esc(o.it.n)+'</div><small>'+codesTxt(o.it)+'</small>';
    if(o.err){h+='<div class="ivbc warn">'+head+'<small style="color:#6b4a00;margin-top:6px">'+esc(o.err)+'</small>'+(o.needPk?'<div class="noprint" style="display:flex;gap:6px;margin-top:8px"><input inputmode="decimal" placeholder="R$/kg" style="flex:1;min-width:0"><button type="button" class="secondary" data-iv="setpk" data-n="'+esc(o.it.n)+'">Salvar</button></div>':'')+'</div>';return}
    o.codes.forEach(function(c,i){
      var vv=parseInt(c.substr(1+f.cd,f.vd),10),kgp=f.price?vv/100/o.pk:vv/f.div;
      h+='<div class="ivbc">'+head+eanSvg(c)+'<div class="ivbct">'+fmt3(kgp)+' kg'+(f.price?' <small style="display:inline">· R$ '+(vv/100).toFixed(2).replace('.',',')+'</small>':'')+(o.codes.length>1?' <small style="display:inline">· parte '+(i+1)+'/'+o.codes.length+'</small>':'')+'</div></div>';
    });
  });
  h+='</div></div>';
  return h;
}

/* ---- contagem ---- */
function bcur(){return S.bancas.filter(function(b){return b.id===V.id})[0]}
function nextPending(b,from){
  var c=eff(b).cont||{},n=b.itens.length;
  for(var k=0;k<n;k++){var i=(from+k)%n;if(typeof c[b.itens[i].c]!=="number")return i}
  return -1;
}
function renderCount(keep){
  var b=bcur();if(!b){V={v:"home"};render();return}
  if(V.i>=b.itens.length)V.i=nextPending(b,0);
  var s=stats(b),done=V.i<0,c=eff(b).cont||{},col=corOf(b);
  var bn=g("ivCBanner");bn.style.background=col;bn.style.color=inkOn(col);
  g("ivCName").textContent=b.nome;g("ivCPct").textContent=s.pct+"%";
  var bar=g("ivCBar");bar.style.width=s.pct+"%";bar.style.background=col;
  g("ivCSeg").innerHTML=b.itens.map(function(it,i){var v=c[it.c],st=typeof v==="number"?"ok":lansOf(b,it.c).length?"wip":"";return'<i class="'+st+(i===V.i?" cur":"")+'" style="--c:'+col+'"></i>'}).join("");
  g("ivCInfo").textContent=s.n+" de "+s.m+" produtos"+(s.kg?" · "+fmt(s.kg)+" kg":"")+(s.un?" · "+fmt(s.un)+" un":"");
  g("ivCur").classList.toggle("hidden",done);g("ivDone").classList.toggle("hidden",!done);
  if(done){g("ivDoneTxt").textContent="Banca concluída"+(s.kg?": "+fmt(s.kg)+" kg":"")+(s.un?" · "+fmt(s.un)+" un":"")}
  else{
    var it=b.itens[V.i],ls=lansOf(b,it.c),p=g("ivPeso");
    g("ivCNum").textContent="Produto "+(V.i+1)+" de "+s.m;
    g("ivCCode").innerHTML=codesBig(it);g("ivCItem").textContent=it.n;
    g("ivLans").innerHTML=ls.length?ls.map(function(l,i){
      return'<div class="ivlan"><span>'+(i+1)+') <b>'+fmt3(l[0])+' '+it.u+'</b> <small class="muted">'+hhmm(l[1])+(l[3]&&l[3]!==me()?' · '+esc(l[3]):'')+'</small></span><button type="button" class="danger" style="min-height:34px;padding:0 12px" data-lan="'+i+'" aria-label="Remover lançamento">✕</button></div>';
    }).join(""):'<small class="note" style="margin:6px 0;text-align:center">Pese e toque em «Lançar». Pode lançar várias pesagens do mesmo produto; o total é a soma.</small>';
    g("ivSub").innerHTML=ls.length?'<span>Total do produto</span><span>'+fmt3(sumL(ls))+' '+it.u+'</span>':'';
    g("ivPesoL").textContent=it.n+" ("+it.u+")";
    if(!keep)p.value="";
    p.placeholder=it.u==="un"?"unidades (ex.: 3)":"kg (ex.: 2,5)";
    p.toggleAttribute("data-np-int",it.u==="un");
  }
  var pend=[],fin=[];
  b.itens.forEach(function(it,i){(typeof c[it.c]==="number"?fin:pend).push(i)});
  function row(i){
    var it=b.itens[i],ls=lansOf(b,it.c),v=c[it.c],ok=typeof v==="number",right;
    if(ok)right='<b>'+(v===0?'sem estoque':fmt3(v)+' '+it.u)+(ls.length>1?'<small>'+ls.length+' lançamentos</small>':'')+'</b>';
    else if(ls.length)right='<b style="color:var(--amb)">'+fmt3(sumL(ls))+' '+it.u+'…<small>em andamento</small></b>';
    else right='<b>—</b>';
    var who=b.pi&&b.pi[it.c];
    return'<div class="ivli'+(ok?' ok':'')+(i===V.i?' cur':'')+'" data-i="'+i+'"><span>'+esc(it.n)+'<small>'+codesTxt(it)+(who&&who!==me()?' · '+esc(who):'')+'</small></span>'+right+'</div>';
  }
  g("ivList").innerHTML=pend.map(row).join("")
    +(fin.length?'<div class="ivfinh">Concluídos ('+fin.length+') · toque para acrescentar ou remover</div>'+fin.map(row).join(""):"");
}
function touch(b,key){b.t=Date.now();b.por=me();b.pi=b.pi||{};b.pi[key]=me()}
function addLan(v){
  var b=bcur(),it=b.itens[V.i],a=lanArr(b,it.c),l=[Math.round(v*1000)/1000,Date.now(),lanId(b.id,it.c),me()];
  a.push(l);
  if(typeof b.cont[it.c]==="number")b.cont[it.c]=sumL(a);
  touch(b,it.c);save();pushLan(b,it.c,l);
}
function concluir(){
  var b=bcur(),it=b.itens[V.i],raw=g("ivPeso").value;
  if(raw){var v=num(raw);if(v===null||v<0){toast("Quantidade inválida");return}addLan(v)}
  var a=lanArr(b,it.c);
  if(!a.length){toast("Lance o peso ou toque em «Não tem»");return}
  b.cont[it.c]=sumL(a);touch(b,it.c);save();pushFin(b,it.c,true);
  V.i=nextPending(b,V.i+1);renderCount();
  if(V.i<0&&typeof window.npClose==="function")window.npClose();
}
function semEstoque(){
  var b=bcur(),it=b.itens[V.i];
  b.lan=b.lan||{};b.cont=b.cont||{};
  var old=(b.lan[it.c]||[]).slice();
  b.lan[it.c]=[];b.cont[it.c]=0;touch(b,it.c);save();
  old.forEach(function(l){if(l[2])cdel("inv_lan",l[2])});pushFin(b,it.c,true);
  V.i=nextPending(b,V.i+1);renderCount();
  if(V.i<0&&typeof window.npClose==="function")window.npClose();
}
function rmLan(i){
  var b=bcur(),it=b.itens[V.i],a=lanArr(b,it.c),r=a.splice(i,1)[0];
  if(typeof b.cont[it.c]==="number"){if(a.length)b.cont[it.c]=sumL(a);else{delete b.cont[it.c];pushFin(b,it.c,false)}}
  touch(b,it.c);save();
  if(r&&r[2])cdel("inv_lan",r[2]);
  renderCount();
}

/* ---- render ---- */
function render(){
  var c=V.v==="count";
  g("ivMain").classList.toggle("hidden",c);g("ivCount").classList.toggle("hidden",!c);
  if(c){renderCount();return}
  var f={home:vHome,cfg:vCfg,edit:vEdit,sum:vSum,imp:vImp,rel:vRel,chk:vChk}[V.v]||vHome;
  g("ivMain").innerHTML=f();
  if(V.v==="edit"){renderEList();renderPrevTag()}
  if(V.v==="home")initSwipe();
}

g("tabInventario").addEventListener("click",function(e){
  if(V.v==="count"){
    var rl=e.target.closest("[data-lan]");if(rl){rmLan(+rl.dataset.lan);return}
    var li=e.target.closest(".ivli");if(li){V.i=+li.dataset.i;renderCount();return}
  }
  var el=e.target.closest("[data-iv]");if(!el)return;
  var a=el.dataset.iv,id=el.dataset.id,b=S.bancas.filter(function(x){return x.id===id})[0];
  switch(a){
    case"home":V={v:"home"};break;
    case"qgo":{var qb=S.bancas.filter(function(x){return x.id===el.dataset.id})[0];if(!qb)return;qb.cont=qb.cont||{};V={v:"count",id:qb.id,i:+el.dataset.i};break}
    case"chk":V={v:"chk"};break;
    case"chkcat":V.cat=el.dataset.c;break;
    case"chkshare":share(chkText());return;
    case"chkcopy":copy(chkText());return;
    case"cfg":V={v:"cfg"};break;
    case"sum":V={v:"sum"};break;
    case"imp":V={v:"imp"};break;
    case"rel":V={v:"rel",rb:null};break;
    case"print":window.print();return;
    case"sharerel":share(relText(V.rb));return;
    case"copyrel":copy(relText(V.rb));return;
    case"setpk":{var inp=el.previousElementSibling,pv=num(inp&&inp.value);if(!(pv>0)){toast("Digite o preço do kg, ex.: 16,98");return}if(window.vmPk)window.vmPk.set(el.dataset.n,pv);toast("Preço do kg guardado");V={v:"rel",rb:V.rb};break}
    case"new":V={v:"edit",id:null,nome:"",cor:firstUnused(),items:[],hits:[],moved:[]};break;
    case"edit":V={v:"edit",id:id,nome:b.nome,cor:corOf(b),items:b.itens.map(function(x){var y={};for(var k in x)y[k]=x[k];return y}),hits:[],moved:[]};break;
    case"cor":{V.cor=el.dataset.c;var chips=document.querySelectorAll(".ivchip");for(var ci=0;ci<chips.length;ci++)chips[ci].classList.toggle("sel",chips[ci].dataset.c===V.cor);renderPrevTag();return}
    case"add":addHit(+el.dataset.i);return;
    case"newprod":{var nm=(g("ivNewNome").value||"").trim().replace(/\s+/g," "),cd=el.dataset.code;
      if(!nm){toast("Digite o nome do produto");g("ivNewNome").focus();return}
      var isS=window.vmScale&&vmScale.is(cd),plu=isS?String(Number(vmScale.parse(cd).item)):"";
      if(typeof window.vmRegister==="function")window.vmRegister({name:nm,category:"FLV",barcode:isS?"":cd,codigo_balanca:plu,codigo_doacao:""});
      var it=toItem({n:nm,b:plu,d:"",e:isS?"":cd});
      if(V.items.some(function(x){return x.c===it.c})){toast("Já está na banca");return}
      V.items.push(it);renderEList();var bb=g("ivBusca");bb.value="";renderRes();bb.focus();toast("Cadastrado e adicionado: "+nm);return}
    case"rm":V.items.splice(+el.dataset.i,1);renderEList();renderRes();return;
    case"unit":{var it=V.items[+el.dataset.i];it.u=it.u==="un"?"kg":"un";renderEList();return}
    case"addpaste":{
      var novos=parseItens(g("ivItens").value),n=0,fora=0;
      novos.forEach(function(x){if(V.items.some(function(y){return y.c===x.c}))return;if(ownerOf(x)){fora++;return}V.items.push(x);n++});
      g("ivItens").value="";renderEList();toast((n?n+" produto(s) adicionado(s)":"Nada novo para adicionar")+(fora?" · "+fora+" já pertence(m) a outra banca (use a busca para mover)":""));return;
    }
    case"count":if(!b.itens.length){toast("Esta banca ainda não tem produtos");return}b.cont=b.cont||{};V={v:"count",id:id,i:nextPending(b,0)};break;
    case"saveb":{
      var nome=g("ivNome").value.trim();
      if(!nome){toast("Dê um nome à banca");g("ivNome").focus();return}
      if(!V.items.length){toast("Adicione ao menos um produto");return}
      (V.moved||[]).forEach(function(m){var ob=S.bancas.filter(function(y){return y.id===m.id})[0];if(ob)ob.itens=ob.itens.filter(function(x){return x.c!==m.c})});
      (V.moved||[]).forEach(function(m){var ob=S.bancas.filter(function(y){return y.id===m.id})[0];if(ob)pushBanca(ob)});
      if(V.id){var x=S.bancas.filter(function(y){return y.id===V.id})[0];x.nome=nome;x.itens=V.items;x.cor=V.cor;pushBanca(x)}
      else{var nid=uid();while(S.bancas.some(function(y){return y.id===nid}))nid=uid();var nb={id:nid,nome:nome,itens:V.items,cont:{},lan:{},cor:V.cor,ord:Date.now()};S.bancas.push(nb);pushBanca(nb)}
      save();V={v:"cfg"};toast("Banca salva");break;
    }
    case"delb":if(!confirm("Excluir esta banca?"))return;var gone=S.bancas.filter(function(y){return y.id===V.id})[0];if(gone){purgeCounts(gone);cdel("inv_bancas",safeId(gone.id))}S.bancas=S.bancas.filter(function(y){return y.id!==V.id});save();V={v:"cfg"};break;
    case"reset":if(!confirm("Começar um novo inventário? As contagens serão zeradas, mas as bancas e os produtos de cada uma continuam salvos. O resultado atual fica guardado em «Inventários anteriores», no Resumo."))return;
      if(totals().n>0){S.hist=S.hist||[];var hh={t:Date.now(),txt:relText(null)};S.hist.unshift(hh);S.hist=S.hist.slice(0,10);cset("inv_hist",String(hh.t),{t:hh.t,txt:hh.txt,por:me()})}
      S.bancas.forEach(function(y){purgeCounts(y);y.cont={};y.lan={};y.pi={};y.ext=null;y.t=0;y.por=""});save();toast("Novo inventário iniciado");break;
    case"copyhist":copy(S.hist[+el.dataset.i].txt);return;
    case"sendcfg":share("Inventário FLV — "+b.nome+"\nAbra o link e comece a contar:\n"+cfgLink([b]));return;
    case"sendall":share("Inventário FLV — todas as bancas\nAbra o link para carregar as bancas:\n"+cfgLink(S.bancas));return;
    case"sendres":if(!stats(b).n&&!Object.keys(eff(b).lan||{}).length){toast("Conte ao menos um produto");return}share("Inventário FLV — "+b.nome+" ("+stats(b).pct+"%)\nAbra o link no app para importar o resultado:\n"+resLink(b));return;
    case"sharesum":share(sumText());return;
    case"copysum":copy(sumText());return;
    case"doimp":try{toast(importText(g("ivImpTxt").value));V={v:"home"}}catch(err){toast("Código ou link inválido");return}break;
    default:return;
  }
  render();window.scrollTo(0,0);
});
g("tabInventario").addEventListener("change",function(e){
  var sel=e.target.closest("[data-chk]");if(!sel||!sel.value)return;
  var D=chkData(),r=D.rows[+sel.dataset.chk],b=S.bancas.filter(function(x){return x.id===sel.value})[0];
  if(!r||!b||r.b)return;
  b.itens.push(toItem(r.m));save();pushBanca(b);toast(r.m.n+" → "+b.nome);render();
});
g("tabInventario").addEventListener("input",function(e){
  if(e.target.id==="ivBusca")renderRes();
  if(e.target.id==="ivQ")qRes();
  if(e.target.id==="ivNome"){V.nome=e.target.value;renderPrevTag()}
});
g("tabInventario").addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.id==="ivBusca"){e.preventDefault();if(V.hits&&V.hits.length)addHit(0)}});
g("ivAdd").onclick=function(){
  var v=num(g("ivPeso").value);if(v===null||v<0){toast("Digite a quantidade");return}
  addLan(v);renderCount();
};
g("ivNext").onclick=concluir;
g("ivZero").onclick=semEstoque;
g("ivPrev").onclick=function(){var b=bcur();if(!b)return;V.i=Math.max(0,(V.i<0?b.itens.length:V.i)-1);renderCount()};
function backHome(){if(typeof window.npClose==="function")window.npClose();V={v:"home"};render();window.scrollTo(0,0)}
g("ivBack").onclick=backHome;g("ivDoneBack").onclick=backHome;
g("ivDoneRel").onclick=function(){var id=V.id;if(typeof window.npClose==="function")window.npClose();V={v:"rel",rb:id};render();window.scrollTo(0,0)};
g("ivDoneSend").onclick=function(){var b=bcur();share("Inventário FLV — "+b.nome+" ("+stats(b).pct+"%)\nAbra o link no app para importar o resultado:\n"+resLink(b))};
g("ivDoneCopy").onclick=function(){copy(resLink(bcur()))};

function doHash(h){
  try{var msg=imp(dec(h.slice(5)));V={v:"home"};render();var n=g("navInventario");if(n)n.click();toast(msg)}
  catch(e){toast("Link inválido")}
}
function checkHash(){
  if(location.hash.indexOf("#inv=")!==0)return;
  var h=location.hash;
  try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}
  if(cloudAvail()&&!CL.adopted&&!hashQ){   // espera os dados da nuvem (até 6 s) para não perder a importação
    hashQ=h;startCloud();
    setTimeout(function(){if(hashQ){var q=hashQ;hashQ=null;doHash(q)}},6000);
    var n=g("navInventario");if(n)n.click();return;
  }
  doHash(h);
}
window.addEventListener("hashchange",checkHash);

/* ================= sincronização em tempo real (Firestore) =================
   inv_bancas/{id}  → nome, cor, produtos de cada banca
   inv_lan/{id}     → um documento por lançamento (peso/quantidade) — ninguém sobrescreve o outro
   inv_fin/{id}     → produto marcado como concluído
   inv_hist/{t}     → inventários anteriores                                              */
var KFLAG="validamais-inv-cloud";
function fdb(){try{return typeof window.vmDb==="function"?window.vmDb():null}catch(e){return null}}
var FB=window.V||{};
function cloudAvail(){return!!(fdb()&&FB.onSnapshot&&FB.setDoc&&FB.doc&&FB.collection&&FB.deleteDoc&&FB.query&&FB.orderBy&&FB.limit)}
function safeId(x){return String(x).replace(/[^A-Za-z0-9]/g,function(ch){return"_"+ch.charCodeAt(0).toString(16)+"_"})}
function finId(bid,c){return safeId(bid)+"~"+safeId(c)}
function lanId(bid,c){return finId(bid,c)+"~"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function cset(col,id,data){if(!CL.on)return;try{FB.setDoc(FB.doc(fdb(),col,id),data).catch(cfail)}catch(e){cfail(e)}}
function cdel(col,id){if(!CL.on||!id)return;try{FB.deleteDoc(FB.doc(fdb(),col,id)).catch(cfail)}catch(e){cfail(e)}}
function bancaDoc(b){return{id:b.id,nome:b.nome,cor:corOf(b),ord:b.ord||0,por:me(),upd:Date.now(),
  itens:b.itens.map(function(x){return{c:String(x.c),n:String(x.n),u:x.u==="un"?"un":"kg",b:String(x.b||""),d:String(x.d||""),e:String(x.e||"")}})}}
function pushBanca(b){if(!b.ord)b.ord=Date.now();cset("inv_bancas",safeId(b.id),bancaDoc(b))}
function pushLan(b,key,l){if(l&&l[2])cset("inv_lan",l[2],{b:b.id,c:String(key),p:l[0],t:l[1]||Date.now(),por:l[3]||me()})}
function pushFin(b,key,on){if(on)cset("inv_fin",finId(b.id,key),{b:b.id,c:String(key),t:Date.now(),por:me()});else cdel("inv_fin",finId(b.id,key))}
function purgeCounts(b){   // apaga na nuvem todos os lançamentos e conclusões da banca
  Object.keys(b.lan||{}).forEach(function(k){(b.lan[k]||[]).forEach(function(l){if(l[2])cdel("inv_lan",l[2])})});
  Object.keys(b.cont||{}).forEach(function(k){cdel("inv_fin",finId(b.id,k))});
}
function cfail(e){
  console.error(e);
  var denied=!!e&&(e.code==="permission-denied"||/permission|insufficient/i.test(e.message||""));
  CL.err=denied?"o Firestore recusou o acesso: atualize as regras (inv_bancas, inv_lan, inv_fin, inv_hist)":"falha ao sincronizar";
  if(denied){CL.on=false;CL.adopted=false;clearTimeout(CL.tm)}   // volta ao modo local, sem perder o que está na tela
  ivStatus();
  if(!CL.warned){CL.warned=true;toast(denied?"O Firestore não permitiu sincronizar o inventário. Ele segue só neste aparelho.":"Falha ao sincronizar o inventário.")}
}
function sigNow(){
  var o=[];
  S.bancas.forEach(function(b){
    var x=[b.id,b.nome,corOf(b),b.por||"",b.itens.map(function(i){return i.c+"/"+i.u+"/"+i.n}).join(",")];
    Object.keys(b.lan||{}).sort().forEach(function(k){x.push(k+":"+b.lan[k].map(function(l){return l[0]+"@"+l[1]}).join("+")+(typeof(b.cont||{})[k]==="number"?"#":""))});
    o.push(x.join("|"));
  });
  return o.join("\n")+"\nH"+((S.hist||[]).length);
}
function rebuild(){
  var arr=Object.keys(CL.bancas).map(function(k){return CL.bancas[k]}).filter(function(d){return d&&d.id});
  arr.sort(function(a,b){return((a.ord||0)-(b.ord||0))||(String(a.id)<String(b.id)?-1:1)});
  var by={},ptm={};
  var out=arr.map(function(d){
    var b={id:String(d.id),nome:String(d.nome||"").slice(0,40),cor:okCor(d.cor)?d.cor:"",ord:d.ord||0,cont:{},lan:{},pi:{},t:0,por:"",ext:null,
      itens:(Array.isArray(d.itens)?d.itens:[]).filter(function(x){return x&&x.c}).map(function(x){return{c:String(x.c),n:String(x.n||x.c),u:x.u==="un"?"un":"kg",b:String(x.b||""),d:String(x.d||""),e:String(x.e||"")}})};
    by[b.id]=b;return b;
  });
  function mark(b,c,t,por){t=t||0;var k=b.id+"|"+c;if(t>=(ptm[k]||0)){ptm[k]=t;b.pi[c]=por||""}if(t>=b.t){b.t=t;if(por)b.por=por}}
  Object.keys(CL.lan).forEach(function(k){
    var d=CL.lan[k],b=d&&by[d.b];if(!b||typeof d.p!=="number"||!isFinite(d.p))return;
    (b.lan[d.c]=b.lan[d.c]||[]).push([d.p,d.t||0,k,d.por||""]);mark(b,d.c,d.t,d.por);
  });
  Object.keys(CL.fin).forEach(function(k){
    var d=CL.fin[k],b=d&&by[d.b];if(!b)return;
    b.cont[d.c]=0;mark(b,d.c,d.t,d.por);
  });
  out.forEach(function(b){
    Object.keys(b.lan).forEach(function(c){b.lan[c].sort(function(x,y){return(x[1]-y[1])||(x[2]<y[2]?-1:1)})});
    Object.keys(b.cont).forEach(function(c){b.lan[c]=b.lan[c]||[];b.cont[c]=sumL(b.lan[c])});
  });
  S.bancas=out;
  if(CL.hist)S.hist=CL.hist.map(function(x){return{t:x.t,txt:String(x.txt||"")}});
}
function cloudChanged(){clearTimeout(CL.tm);CL.tm=setTimeout(applyCloud,60)}
function applyCloud(){
  ivStatus();
  if(!CL.adopted)return;
  var before=CL.sig;
  rebuild();save();
  if(CL.sig!==before||CL.force){CL.force=false;liveRender()}
  if(hashQ){var q=hashQ;hashQ=null;doHash(q)}
}
function liveRender(){   // atualiza a tela na hora sem apagar o que a pessoa está digitando
  if(swiping){CL.late=true;return}
  if(V.v==="count"){renderCount(true);return}
  var ae=document.activeElement,tab=g("tabInventario");
  if(V.v==="home"){
    var q=g("ivQ"),val=q?q.value:"",foc=!!q&&ae===q,pos=foc?q.selectionStart:0;
    render();
    if(val){q=g("ivQ");if(q){q.value=val;qRes();if(foc){q.focus();try{q.setSelectionRange(pos,pos)}catch(e){}}}}
    return;
  }
  if(V.v==="edit"||V.v==="imp")return;   // formulário aberto: não mexe
  if(ae&&tab&&tab.contains(ae)&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName))return;
  render();
}
function ivStatus(){
  var el=g("ivSync");if(!el)return;
  var t,c="";
  if(!cloudAvail()){t="Modo local neste aparelho (sem sincronização)"}
  else if(CL.err){t="Sem sincronização: "+CL.err;c="err"}
  else if(!CL.on){t="Conectando…";c="wait"}
  else if(CL.hps.bancas||CL.hps.lan||CL.hps.fin){t="Enviando alterações…";c="wait"}
  else if(CL.fc){t=navigator.onLine===false?"Offline: salvo no aparelho, envia ao voltar a conexão":"Conectando…";c="wait"}
  else{t="Sincronizado ao vivo";c="ok"}
  el.innerHTML='<i class="sdot '+c+'"></i>'+esc(t);
}
function onBancas(s){
  CL.hps.bancas=s.metadata.hasPendingWrites;CL.fc=s.metadata.fromCache;
  var docs=s.docs;
  if(s.metadata.fromCache&&!docs.length){ivStatus();return}      // ainda sem resposta do servidor
  if(!rd(KFLAG,0)){
    if(!docs.length){cloudMigrate();return}                       // nuvem vazia: sobe o que já existe neste aparelho
    wr(KEY+"-bkp",S);wr(KFLAG,1);                                  // nuvem já tem inventário: usa o dela (cópia local guardada)
  }
  if(!docs.length&&CL.migT&&Date.now()-CL.migT<8000){ivStatus();return}
  var m={};docs.forEach(function(x){m[x.id]=x.data()});CL.bancas=m;
  CL.err="";CL.on=true;
  if(!CL.adopted){CL.adopted=true;CL.force=true}
  cloudChanged();
}
function onMap(key){return function(s){
  CL.hps[key]=s.metadata.hasPendingWrites;
  var m={};s.docs.forEach(function(x){m[x.id]=x.data()});CL[key]=m;cloudChanged();
}}
function cloudMigrate(){
  wr(KFLAG,1);CL.migT=Date.now();CL.on=true;
  if(!S.bancas.length&&!(S.hist&&S.hist.length)){CL.adopted=true;CL.force=true;cloudChanged();return}
  wr(KEY+"-bkp",S);
  S.bancas.forEach(function(b,i){
    b.ord=Date.now()+i;pushBanca(b);
    var e=eff(b);
    b.itens.forEach(function(it){
      lansOf(b,it.c).forEach(function(l,j){pushLan(b,it.c,[l[0],l[1]||Date.now(),l[2]||(lanId(b.id,it.c)+j),l[3]||e.por||me()])});
      if(typeof e.cont[it.c]==="number")pushFin(b,it.c,true);
    });
  });
  (S.hist||[]).forEach(function(h){cset("inv_hist",String(h.t),{t:h.t,txt:String(h.txt||""),por:me()})});
  toast("Inventário agora sincroniza em tempo real");
}
function startCloud(){
  if(CL.started||!cloudAvail())return;
  CL.started=true;
  var d=fdb(),o={includeMetadataChanges:true};
  try{
    FB.onSnapshot(FB.collection(d,"inv_bancas"),o,onBancas,cfail);
    FB.onSnapshot(FB.collection(d,"inv_lan"),o,onMap("lan"),cfail);
    FB.onSnapshot(FB.collection(d,"inv_fin"),o,onMap("fin"),cfail);
    FB.onSnapshot(FB.query(FB.collection(d,"inv_hist"),FB.orderBy("t","desc"),FB.limit(10)),function(s){CL.hist=s.docs.map(function(x){return x.data()});cloudChanged()},cfail);
  }catch(e){cfail(e)}
  ivStatus();
}
function maybeStart(){var t=g("tabInventario");if(t&&!t.classList.contains("hidden"))startCloud()}
try{new MutationObserver(maybeStart).observe(g("tabInventario"),{attributes:true,attributeFilter:["class"]})}catch(e){}
window.addEventListener("online",ivStatus);window.addEventListener("offline",ivStatus);
ivStatus();maybeStart();
render();checkHash();
})();
