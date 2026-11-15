/* Teclado numerico integrado: campos [data-np] ficam readonly e usam o painel inferior */
(function () {
  ["uKg", "uUn"].forEach(function (i) { document.getElementById(i).addEventListener("click", function () { setTimeout(function () { if (window.npPaint) window.npPaint(); }, 0); }); });
  var pad = document.getElementById("np"), val = document.getElementById("npVal"), ttl = document.getElementById("npTitle"), okb = document.getElementById("npOk"), comma = pad.querySelector('[data-k=","]');
  var act = null, fresh = false, root = document.documentElement;
  var isInt = function (el) { return el.hasAttribute("data-np-int"); };
  function title(el) {
    if (el.id === "dPeso") { var n = document.getElementById("dNome"), u = document.getElementById("uUn").classList.contains("sel") ? "un" : "kg"; return ((n && n.textContent) || "Peso") + " (" + u + ")"; }
    var l = el.id && document.querySelector('label[for="' + el.id + '"]'); return l ? l.textContent.replace("*", "").trim() : "Quantidade";
  }
  function paint() { val.textContent = act ? (act.value || "0") : ""; if (window.taraRefresh) window.taraRefresh();
    var bg = document.getElementById("dBig"); if (bg && act && act.id === "dPeso") bg.innerHTML = (act.value || "0") + "<small>" + (document.getElementById("uUn").classList.contains("sel") ? "un" : "kg") + "</small>"; }
  window.npPaint = paint;
  function measure() { root.style.setProperty("--np-h", pad.offsetHeight + "px"); }
  function open(el) {
    var first = !pad.classList.contains("show") || act !== el;
    if (act !== el) { if (act) act.classList.remove("np-on"); act = el; fresh = true; }
    el.classList.add("np-on"); ttl.textContent = title(el); okb.textContent = el.dataset.npLabel || "OK"; comma.disabled = isInt(el); paint();
    pad.classList.add("show"); document.body.classList.add("np-open"); document.body.classList.toggle("np-doa", el.id === "dPeso"); measure();
    if (el.id !== "dPeso") { try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }
  function close() {
    if (act) act.classList.remove("np-on"); act = null; pad.classList.remove("show"); document.body.classList.remove("np-open", "np-doa"); root.style.removeProperty("--np-h");
  }
  window.npClose = close;
  function put(v) { act.value = v; act.dispatchEvent(new Event("input", { bubbles: true })); act.dispatchEvent(new Event("change", { bubbles: true })); paint(); }
  function press(k) {
    if (!act) return; var v = act.value || "";
    if (navigator.vibrate) navigator.vibrate(8);
    if (k === "del") { put(fresh ? "" : v.slice(0, -1)); fresh = false; return; }
    if (k === "ok") {
      var sel = act.dataset.npSubmit, b = sel && document.querySelector(sel);
      if (b) { b.click(); fresh = true; if (!act) return; setTimeout(function () { if (act) { if (!act.getClientRects().length) close(); else { paint(); title(act); ttl.textContent = title(act); } } }, 0); }
      else close();
      return;
    }
    if (fresh) { v = ""; fresh = false; }
    if (k === ",") { if (isInt(act) || v.indexOf(",") >= 0) return; v = v === "" ? "0," : v + ","; }
    else { if (v === "0") v = ""; if (v.length >= 7) return; v += k; }
    put(v);
  }
  pad.addEventListener("pointerdown", function (e) { e.preventDefault(); });
  pad.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (b.id === "npClose") return close(); if (!b.disabled) press(b.dataset.k); });
  document.addEventListener("focusin", function (e) {
    var t = e.target; if (t.matches && t.matches("[data-np]")) { t.setAttribute("readonly", ""); open(t); }
    else if (t.matches && t.matches("input,textarea,select")) close();
  });
  document.addEventListener("pointerdown", function (e) {
    var t = e.target; if (t.closest && t.closest("[data-np]")) { if (document.activeElement === t) open(t); return; }
    if (!act || t.closest("#np")) return;
    if (!t.closest("button,input,select,textarea,a,summary,label,[data-q],[data-pick],[data-sel]")) close();
  });
  /* fecha se o campo sumiu (modal fechado, outra aba, etc.) */
  document.addEventListener("click", function () { setTimeout(function () { if (act && !act.getClientRects().length) close(); else if (act) { paint(); ttl.textContent = title(act); } }, 30); });
  window.addEventListener("resize", function () { if (act) measure(); });
})();
