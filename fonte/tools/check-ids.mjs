// Uso: node check-ids.mjs <arquivo1> [arquivo2 ...]  → ids referenciados no JS que não são definidos em lugar nenhum
import fs from "node:fs";
const txt = process.argv.slice(2).map(f => fs.readFileSync(f, "utf8")).join("\n");

const defined = new Set();
for (const m of txt.matchAll(/\bid=\\?["']([A-Za-z][\w-]*)\\?["']/g)) defined.add(m[1]);
for (const m of txt.matchAll(/\.id\s*=\s*["']([A-Za-z][\w-]*)["']/g)) defined.add(m[1]);

const refs = new Map();
const add = (id, how) => { if (!refs.has(id)) refs.set(id, how); };
for (const m of txt.matchAll(/(?<![\w.])(?:\$|g)\(\s*["']([A-Za-z][\w-]*)["']\s*\)/g)) add(m[1], "$()");
for (const m of txt.matchAll(/getElementById\(\s*["']([A-Za-z][\w-]*)["']\s*\)/g)) add(m[1], "getElementById");
for (const m of txt.matchAll(/querySelector(?:All)?\(\s*["']#([A-Za-z][\w-]*)/g)) add(m[1], "querySelector");
for (const m of txt.matchAll(/data-np-submit=\\?["']#([A-Za-z][\w-]*)/g)) add(m[1], "data-np-submit");

const missing = [...refs].filter(([id]) => !defined.has(id)).map(([id, how]) => id + " (" + how + ")").sort();
console.log("definidos:", defined.size, "| referenciados:", refs.size, "| sem definição:", missing.length);
console.log(missing.join("\n"));
