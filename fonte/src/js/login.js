/* login da loja (opcional): só liga se config.login.email existir */
(function(){
  var C=window.VALIDA_CONFIG||{}, L=C.login, V=window.V||{}; window.__LOGIN_WAIT=false;
  if(!L||!L.email||!V.getAuth||!(C.firebase&&C.firebase.projectId)) return;
  var FK="validamais-logado", ok=false; try{ ok=localStorage.getItem(FK)===L.email; }catch(e){}
  var app=V.initializeApp(C.firebase), auth=V.getAuth(app);
  window.vmSair=function(){ try{ localStorage.removeItem(FK); }catch(e){} V.signOut(auth).catch(function(){}).then(function(){ location.reload(); }); };
  if(ok){ var first=true; V.onAuthStateChanged(auth,function(u){ if(first){ first=false; if(!u){ try{ localStorage.removeItem(FK); }catch(e){} location.reload(); } } }); return; }
  window.__LOGIN_WAIT=true;
  var css=document.createElement("style"); css.textContent="#vmLogin{position:fixed;inset:0;z-index:99999;background:#08090c;color:#ece8dc;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif}#vmLogin .bx{width:100%;max-width:380px;text-align:center}#vmLogin h1{font-size:30px;margin:0 0 4px;color:#f3d87a}#vmLogin p{margin:0 0 22px;color:#a39e8f;font-size:15px}#vmLogin input{width:100%;box-sizing:border-box;min-height:58px;font-size:20px;padding:0 16px;border-radius:14px;border:2px solid #3a4157;background:#14151b;color:#fff;text-align:center}#vmLogin button{width:100%;min-height:60px;margin-top:14px;border-radius:14px;border:0;font-size:19px;font-weight:900;background:linear-gradient(#f0d56f,#c9a227);color:#10131a}#vmLogin .er{min-height:22px;margin-top:12px;color:#ff7b72;font-size:14px;font-weight:700}";
  document.head.appendChild(css);
  var d=document.createElement("div"); d.id="vmLogin"; d.innerHTML='<form class="bx" id="vmForm"><h1>Valida+</h1><p>'+String(C.loja||"").replace(/[<>&]/g,"")+'<br>Digite a senha da loja</p><input id="vmPw" type="password" autocomplete="current-password" placeholder="Senha" aria-label="Senha"><button type="submit" id="vmGo">Entrar</button><div class="er" id="vmEr"></div></form>';
  document.body.appendChild(d);
  document.getElementById("vmForm").onsubmit=function(e){ e.preventDefault(); var pw=document.getElementById("vmPw").value, er=document.getElementById("vmEr"), go=document.getElementById("vmGo"); if(!pw) return;
    go.disabled=true; er.textContent=""; go.textContent="Entrando…";
    V.signInWithEmailAndPassword(auth,L.email,pw).then(function(){ try{ localStorage.setItem(FK,L.email); }catch(x){} location.reload(); })
    .catch(function(x){ go.disabled=false; go.textContent="Entrar"; var c=(x&&x.code)||""; er.textContent=/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)?"Senha incorreta.":/network/.test(c)?"Sem internet. Tente de novo.":/too-many/.test(c)?"Muitas tentativas. Aguarde alguns minutos.":"Não foi possível entrar ("+c+")."; });
  };
  setTimeout(function(){ var i=document.getElementById("vmPw"); i&&i.focus(); },200);
})();
