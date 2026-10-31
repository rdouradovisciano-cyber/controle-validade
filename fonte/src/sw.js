/* Valida+ service worker: rede primeiro (sempre pega a versao nova), cache so como reserva offline */
const CACHE = "valida-v5-numpad";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "vm-cfg").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return; // Firebase etc. passam direto
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});

/* ---- Avisos de vencimento com o app fechado (Chrome/Android, app instalado: periodic background sync) ---- */
const DIA = 864e5;
const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diaKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fv = f => !f ? undefined : f.stringValue !== undefined ? f.stringValue : f.integerValue !== undefined ? Number(f.integerValue) : f.booleanValue !== undefined ? f.booleanValue : f.doubleValue;
const quando = d => d < 0 ? "vencido há " + (-d) + " dia" + (d < -1 ? "s" : "") : d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : "vence em " + d + " dias";
// docs: documentos do Firestore (REST). Devolve {title, body} ou null quando não há nada no prazo.
function montaAviso(docs, cfg, ref) {
  const out = [], vistos = new Set(), base = ref || hoje0();
  (docs || []).forEach(d => { const f = d.fields || {}, name = fv(f.name), cat = fv(f.category), exp = fv(f.expiry);
    if (!name || fv(f.retirado) === true || f.lixo || !/^\d{4}-\d\d-\d\d$/.test(exp || "")) return;
    if (!cfg.setores.includes(cat === "Perecíveis" ? "Perecíveis" : "FLV")) return;
    const dl = Math.round((new Date(exp + "T00:00:00") - base) / DIA); if (dl > cfg.dias) return;
    const k = name.toLowerCase() + "|" + exp; if (vistos.has(k)) return; vistos.add(k); out.push({ name, dl }); });
  if (!out.length) return null;
  out.sort((a, b) => a.dl - b.dl || a.name.localeCompare(b.name, "pt-BR"));
  const n = f => out.filter(f).length, ven = n(x => x.dl < 0), hj = n(x => x.dl === 0), px = n(x => x.dl > 0), partes = [];
  if (ven) partes.push("🔴 " + ven + " vencido" + (ven > 1 ? "s" : "")); if (hj) partes.push("🟠 " + hj + " vence" + (hj > 1 ? "m" : "") + " hoje"); if (px) partes.push("🟡 " + px + " em até " + cfg.dias + " dia" + (cfg.dias > 1 ? "s" : ""));
  return { title: "Valida+ · produtos para vencer", body: partes.join(" · ") + "\n" + out.slice(0, 4).map(x => x.name + " (" + quando(x.dl) + ")").join("\n") + (out.length > 4 ? "\n+ " + (out.length - 4) + " outros" : "") };
}
async function cfgGet() { try { const c = await caches.open("vm-cfg"), r = await c.match("vm-cfg.json"); return r ? await r.json() : null; } catch (e) { return null; } }
async function cfgSet(o) { try { const c = await caches.open("vm-cfg"); await c.put("vm-cfg.json", new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } })); } catch (e) {} }
async function verificaVenc() {
  const cfg = await cfgGet(); if (!cfg || !cfg.on || !cfg.pid || cfg.ultimo === diaKey()) return;
  let docs = [], tok = "";
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://firestore.googleapis.com/v1/projects/" + cfg.pid + "/databases/(default)/documents/products?pageSize=300&key=" + encodeURIComponent(cfg.key) + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""));
    if (!r.ok) return; const j = await r.json(); docs = docs.concat(j.documents || []); tok = j.nextPageToken || ""; if (!tok) break;
  }
  const a = montaAviso(docs, cfg); if (!a) return;
  await self.registration.showNotification(a.title, { body: a.body, tag: "vm-venc", icon: "icon-192.png", badge: "icon-192.png", data: { url: "./" } });
  await cfgSet({ ...cfg, ultimo: diaKey() });
}
self.addEventListener("periodicsync", e => { if (e.tag === "vm-venc") e.waitUntil(verificaVenc().catch(() => {})); });
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { const c = cs.find(x => "focus" in x); return c ? c.focus() : self.clients.openWindow(self.registration.scope); }));
});
