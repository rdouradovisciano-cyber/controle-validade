// Uso: node tools/build.mjs [--bump]
//   --bump  incrementa o número da versão (src/version.json) antes de gerar
// Gera dist/: copia src/, escreve js/version.js e version.json, e põe ?v=<seq> nos css/js do index.html.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src"), dist = path.join(root, "dist");
const verFile = path.join(src, "version.json");

const ver = JSON.parse(fs.readFileSync(verFile, "utf8"));
if (process.argv.includes("--bump")) { ver.seq += 1; fs.writeFileSync(verFile, JSON.stringify(ver) + "\n"); }

// data no fuso da loja (BUILD_DATE=AAAA.MM.DD permite fixar, p.ex. em testes)
const hoje = process.env.BUILD_DATE || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()).replaceAll("-", ".");
const versao = `${hoje}-${ver.seq}`;

const updates = JSON.parse(fs.readFileSync(path.join(src, "data/updates.json"), "utf8"));
const nota = (updates[0] && updates[0].itens && updates[0].itens[0]) || "";

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true });
fs.rmSync(path.join(dist, "version.json")); // contador interno; o público é o version.json gerado abaixo
fs.rmSync(path.join(dist, "data"), { recursive: true, force: true });

fs.writeFileSync(path.join(dist, "js/version.js"),
  `/* gerado por tools/build.mjs — não editar */\nwindow.APP_VERSION=${JSON.stringify(versao)};\nwindow.UPDATES=${JSON.stringify(updates)};\n`);
fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify({ versao, nota }) + "\n");

const htmlF = path.join(dist, "index.html");
let html = fs.readFileSync(htmlF, "utf8");
html = html.replace(/(href|src)="((?:css|js)\/[^"?]+)"/g, (_, a, f) => `${a}="${f}?v=${ver.seq}"`);
// compatibilidade: aparelhos com a versão antiga (até 2026.10.13-147) procuram esta linha no index.html para avisar da atualização
html = html.replace("</head>", `<!-- const APP_VERSION = "${versao}" -->\n</head>`);
fs.writeFileSync(htmlF, html);

console.log("build ok:", versao, "→", path.relative(root, dist));
