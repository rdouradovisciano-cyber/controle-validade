// Uso: node css-audit.mjs <app.css> <html+js...>  → relatório de CSS morto
import fs from "node:fs";
import postcss from "postcss";
const [cssFile, ...rest] = process.argv.slice(2);
const css = fs.readFileSync(cssFile, "utf8");
const src = rest.map(f => fs.readFileSync(f, "utf8")).join("\n");

// tokens (classes/ids) que existem em algum lugar do HTML/JS
const tokens = new Set();
for (const m of src.matchAll(/[A-Za-z_][\w-]*/g)) tokens.add(m[0]);

const root = postcss.parse(css);
const dead = [], overridden = [];
const seen = new Map(); // chave: contexto|seletor|prop → decl
function ctx(n) { let c = []; for (let p = n.parent; p && p.type !== "root"; p = p.parent) if (p.type === "atrule") c.unshift("@" + p.name + " " + p.params); return c.join(" > "); }

root.walkRules(rule => {
  if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
  const sels = rule.selectors || [];
  const live = sels.filter(sel => {
    const ids = [...sel.matchAll(/[#.]([A-Za-z_][\w-]*)/g)].map(m => m[1]);
    return ids.every(t => tokens.has(t));
  });
  if (live.length === 0) dead.push({ sel: rule.selector.slice(0, 80), line: rule.source.start.line });
  const c = ctx(rule);
  rule.walkDecls(d => {
    const k = c + "|" + rule.selector + "|" + d.prop;
    const prev = seen.get(k);
    if (prev && !(prev.important && !d.important)) overridden.push({ sel: rule.selector.slice(0, 60), prop: d.prop, linha_antiga: prev.line, linha_nova: d.source.start.line });
    seen.set(k, { line: d.source.start.line, important: d.important });
  });
});
console.log("regras mortas (seletor sem elemento):", dead.length);
console.log("declarações sobrescritas pelo mesmo seletor:", overridden.length);
if (process.argv.includes("--v")) { console.log(JSON.stringify({ dead, overridden }, null, 1)); }
fs.writeFileSync(process.env.AUDIT_OUT || "/tmp/audit.json", JSON.stringify({ dead, overridden }, null, 1));
