// Uso: node css-clean.mjs <entrada.css> <saida.css> <html+js...>
// 1) remove regras cujo seletor (todos) referencia classe/id que não existe mais em HTML/JS
// 2) remove declarações que o MESMO seletor, no mesmo contexto, redeclara depois (sem mudar a cascata)
import fs from "node:fs";
import postcss from "postcss";
const [inF, outF, ...rest] = process.argv.slice(2);
const src = rest.map(f => fs.readFileSync(f, "utf8")).join("\n");
const tokens = new Set([...src.matchAll(/[A-Za-z_][\w-]*/g)].map(m => m[0]));
const root = postcss.parse(fs.readFileSync(inF, "utf8"));
let nRules = 0, nDecls = 0;

root.walkRules(rule => {
  if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
  const keep = rule.selectors.filter(sel => [...sel.matchAll(/[#.]([A-Za-z_][\w-]*)/g)].every(m => tokens.has(m[1])));
  if (keep.length === 0) { rule.remove(); nRules++; }
  else if (keep.length !== rule.selectors.length) rule.selector = keep.join(",");
});

const ctx = n => { const c = []; for (let p = n.parent; p && p.type !== "root"; p = p.parent) if (p.type === "atrule") c.unshift("@" + p.name + " " + p.params); return c.join(">"); };
const last = new Map();
root.walkDecls(d => { // última declaração de cada propriedade por seletor+contexto
  const r = d.parent; if (r.type !== "rule") return;
  const k = ctx(r) + "|" + r.selector + "|" + d.prop;
  const prev = last.get(k);
  if (prev && !(prev.important && !d.important)) { prev.node.remove(); nDecls++; }
  last.set(k, { node: d, important: d.important });
});
root.walkRules(r => { if (!r.nodes || r.nodes.length === 0) r.remove(); });
root.walkAtRules(a => { if (a.nodes && a.nodes.length === 0) a.remove(); });
fs.writeFileSync(outF, root.toString());
console.log("regras removidas:", nRules, "| declarações removidas:", nDecls, "| bytes:", fs.statSync(inF).size, "→", fs.statSync(outF).size);
