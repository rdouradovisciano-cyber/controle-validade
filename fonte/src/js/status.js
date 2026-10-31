/* ponto de status da sincronização */(function(){var s=document.getElementById("syncState"),d=document.getElementById("syncDot");if(!s||!d)return;
function u(){var t=s.textContent||"";d.title=t;d.className="sdot "+(/^sincronizado/.test(t)?"ok":/erro|falha/.test(t)?"err":/conectando|aguardando|offline|iniciando/.test(t)?"wait":"")}
new MutationObserver(u).observe(s,{childList:true,characterData:true,subtree:true});u()})();
