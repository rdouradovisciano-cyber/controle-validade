/* v531: tour do cartão do produto (Perecíveis). A equipe vê uma vez por aparelho, quando o Admin liga; o Admin pode rever quando quiser. */
(function () {
  var g = function (i) { return document.getElementById(i); };
  var S = [
    { t: "Conheça o cartão do produto", d: "Cada produto lançado aparece num cartão. Vamos ver onde ele fica e o que cada parte mostra. Dura menos de um minuto." },
    { sel: "#tbLoja", t: "Onde ele fica", d: "Na aba Validades. É aqui que ficam todos os produtos que você lançou, com a validade de cada um." },
    { sel: "#list .pgh[data-g]", t: "Grupos por urgência", d: "Os cartões ficam em grupos: Vencidos, Vence hoje, 1 a 3 dias, 4 a 7 dias e Dentro do prazo. Toque na barra do grupo para abrir ou fechar." },
    { sel: "#list .pitem .pi-lead", t: "Foto do produto", d: "A foto ajuda a achar o item na gôndola sem precisar ler o nome." },
    { sel: "#list .pitem .pi-badge", t: "Quanto tempo falta", d: "AMANHÃ, 2 DIAS, 3 DIAS… A cor muda conforme a urgência: quanto mais vermelho, mais rápido você precisa agir." },
    { sel: "#list .pitem .pi-txt", t: "Nome, quantidade e validade", d: "O nome do produto, a quantidade que você lançou (Qtd) e o dia em que vence." },
    { sel: "#list .pitem .pi-lotes", t: "Lotes do mesmo produto", d: "Quando o mesmo produto tem mais de uma validade, aparece 1/2, 2/2… Toque no 1/2 para ver todos os lotes dele." },
    { sel: "#list .pitem .pi-op", t: "Quem lançou", d: "O nome de quem lançou o produto." },
    { sel: "#list .pitem", t: "Toque no cartão para abrir", d: "Ao tocar, o cartão abre: aparecem as opções para trocar a foto, editar a validade ou Retirar o item da loja." },
    { sel: "#fab", t: "Lançar um produto novo", d: "Para lançar mais um item, toque neste botão e bipe o código de barras." },
    { t: "Pronto", d: "É isso. Lance sempre o nome completo, com gramagem, para não misturar versões do mesmo produto." }
  ];
  var ov, hl, card, i = 0, list = [], aberto = false;
  function perfil() { try { return localStorage.getItem("validamais-perfil") || ""; } catch (e) { return ""; } }
  function vis(s) { if (!s.sel) return true; var e = document.querySelector(s.sel); return !!(e && e.getClientRects().length); }
  function fim() { if (!aberto) return; aberto = false; ov.remove(); document.removeEventListener("keydown", tecla); window.removeEventListener("resize", pos); }
  function tecla(e) { if (e.key === "Escape") fim(); else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); ir(1); } else if (e.key === "ArrowLeft") ir(-1); }
  function ir(d) { var n = i + d; if (n < 0) return; if (n >= list.length) return fim(); i = n; mostra(); }
  function pos() {
    if (!aberto) return; var s = list[i], e = s.sel && document.querySelector(s.sel), vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (e) { var r = e.getBoundingClientRect(), p = 6; hl.style.cssText = "display:block;left:" + (r.left - p) + "px;top:" + (r.top - p) + "px;width:" + (r.width + 2 * p) + "px;height:" + (r.height + 2 * p) + "px";
      var abaixo = r.top + r.height / 2 < vh / 2, top = abaixo ? r.bottom + p + 14 : r.top - p - 14 - ch; top = Math.max(12, Math.min(vh - ch - 12, top));
      card.style.left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2)) + "px"; card.style.top = top + "px"; }
    else { hl.style.display = "none"; card.style.left = Math.max(12, (vw - cw) / 2) + "px"; card.style.top = Math.max(12, (vh - ch) / 2) + "px"; }
  }
  function mostra() {
    var s = list[i], ult = i === list.length - 1, e = s.sel && document.querySelector(s.sel);
    card.innerHTML = '<div class="tr-n">' + (i + 1) + ' de ' + list.length + '</div><h3>' + s.t + '</h3><p>' + s.d + '</p><div class="tr-dots" aria-hidden="true">' + list.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join("") + '</div><div class="tr-bt">' + (i > 0 ? '<button type="button" class="tr-back" data-a="b">Voltar</button>' : '<button type="button" class="tr-skip" data-a="x">Pular</button>') + '<button type="button" class="tr-next" data-a="n">' + (ult ? "Entendi" : "Próximo") + '</button></div>';
    if (e && e.scrollIntoView && s.sel !== "#fab" && s.sel !== "#tbLoja") e.scrollIntoView({ block: "center" });
    setTimeout(function () { pos(); var b = card.querySelector(".tr-next"); if (b) b.focus({ preventScroll: true }); }, e ? 260 : 0);
    pos();
  }
  function inicia() {
    if (aberto) return;
    var pv = Array.prototype.some.call(document.querySelectorAll("#list .pitem"), function (e) { return e.getClientRects().length; });
    if (!pv) { var gs = document.querySelectorAll("#list .pgh[data-g]"); for (var k = 0; k < gs.length; k++) { gs[k].click(); if (Array.prototype.some.call(document.querySelectorAll("#list .pitem"), function (e) { return e.getClientRects().length; })) break; gs[k].click(); } }   // abre o primeiro grupo para mostrar um cartão de verdade
    setTimeout(function () {
      list = S.filter(vis); i = 0; if (!list.length) return; aberto = true;
      ov = document.createElement("div"); ov.className = "tr-ov"; ov.innerHTML = '<div class="tr-hl"></div><div class="tr-card" role="dialog" aria-modal="true" aria-label="Tour do cartão"></div>';
      hl = ov.firstChild; card = ov.lastChild;
      card.onclick = function (e) { var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a; if (a === "x") fim(); else ir(a === "n" ? 1 : -1); };
      ov.onclick = function (e) { if (e.target === ov) ir(1); };
      document.body.appendChild(ov); document.addEventListener("keydown", tecla); window.addEventListener("resize", pos); mostra();
    }, 350);
  }
  window.vmTour = function () { window.scrollTo(0, 0); inicia(); };
  /* equipe: o Admin liga em sh_cfg/tour ({on, id}); cada aparelho dos Perecíveis vê uma vez por id */
  var KS = "validamais-tour-visto";
  window.vmTourCfg = function (cfg) {
    try { if (!cfg || !cfg.on || !cfg.id) return; var pf = perfil(); if (pf.indexOf("Perec") !== 0) return; if (localStorage.getItem(KS) === String(cfg.id)) return;
      var n = 0, t = setInterval(function () { n++; if (n > 60) { clearInterval(t); return; }
        if (document.querySelector(".askbg,#vmLogin,.modal:not(.hidden),#splash:not(.hidden),.tr-ov") || !document.querySelector("#list .pgh[data-g], #list .pitem")) return;
        clearInterval(t); try { localStorage.setItem(KS, String(cfg.id)); } catch (e) {} setTimeout(inicia, 600); }, 500); } catch (e) {}
  };
})();
