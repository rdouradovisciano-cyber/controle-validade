import fs from "node:fs"; import vm from "node:vm";
const src = fs.readFileSync("/home/claude/valida/src/js/app.js", "utf8");
const a = src.indexOf("const FOTO_LIMPA"), b = src.indexOf("function resetForm()");
const code = src.slice(a, b);
const cenario = async (nome, { legados = [], snaps = [], deleteFalha = false, readErro = false }) => {
  const log = { updates: [], deletes: [], toasts: [], flag: false, unsub: 0, ls: { "validamais-fotos": "x" } };
  const ctx = { console: { warn() {} }, setTimeout: (f, ms) => (ms >= 15000 ? 0 : setTimeout(f, ms)), localStorage: { removeItem: k => delete log.ls[k] }, Promise,
    store: { get: (k, d) => log.flag ? true : d, set: (k, v) => { log.flag = v; } },
    db: {}, products: legados.map((f, i) => ({ id: "p" + i, name: "p" + i, foto: f })),
    toast: m => log.toasts.push(m),
    V: { deleteField: () => "<<del>>", doc: (db, c, id) => ({ c, id }), collection: (db, c) => ({ c }),
      updateDoc: (r, d) => { log.updates.push([r.id, d.foto]); return Promise.resolve(); },
      deleteDoc: r => deleteFalha ? Promise.reject(new Error("negado")) : (log.deletes.push(r.id), Promise.resolve()),
      onSnapshot: (c, ok, err) => { setTimeout(() => { if (readErro) return err(new Error("sem permissão")); snaps.forEach(s => ok({ metadata: { fromCache: s.cache }, empty: !s.ids.length, docs: s.ids.map(id => ({ id })) })); }, 5); return () => { log.unsub++; }; } } };
  vm.createContext(ctx); vm.runInContext(code + "\nthis.limparFotosNuvem = limparFotosNuvem; this.limparFotosLocal = limparFotosLocal;", ctx);
  ctx.limparFotosNuvem(); await new Promise(r => setTimeout(r, 300));
  console.log(nome.padEnd(46), JSON.stringify({ cadastrosLimpos: log.updates.length, fotosApagadas: log.deletes, concluido: log.flag, aviso: log.toasts.length, localApagado: !("validamais-fotos" in log.ls) }));
  return log;
};
await cenario("1) cache vazio e depois servidor com 2 fotos", { legados: ["data:a", ""], snaps: [{ cache: true, ids: [] }, { cache: false, ids: ["f1", "f2"] }] });
await cenario("2) servidor sem nenhuma foto", { snaps: [{ cache: false, ids: [] }] });
await cenario("3) apagar negado pelas regras", { snaps: [{ cache: false, ids: ["f1"] }], deleteFalha: true });
await cenario("4) sem internet (só cache)", { snaps: [{ cache: true, ids: [] }] });
await cenario("5) leitura negada (nunca viu as fotos)", { readErro: true });
