# Como continuar o Valida+ (outro celular / outra sessão do Claude)

**Repositório:** github.com/rdouradovisciano-cyber/controle-validade (o site é publicado daqui pelo GitHub Pages).

- Raiz do repositório = o app publicado (index.html, js/, css/, sw.js, config.js, firestore.rules).
- `fonte/` = código-fonte e ferramentas: `fonte/src` (editar aqui), `fonte/tools/build.mjs` (gera `fonte/dist`).

## Rotina para mudar algo
1. Editar em `fonte/src`.
2. `cd fonte && BUILD_DATE=AAAA.MM.DD node tools/build.mjs --bump` (precisa de Node). Adicione a novidade no topo de `src/data/updates.json`.
3. Copiar de `fonte/dist` para a raiz: `index.html`, `version.json`, `js/*.js`, `css/*.css`.
4. `git add -A && git commit && git push` (antes: `git fetch` e conferir se alguém mexeu na raiz; se sim, trazer a mudança para `fonte/src`).
- `sw.js`, `config.js` e `firestore.rules` ficam só na raiz (editar direto).
- As regras do Firebase só valem depois de coladas e publicadas no painel do Firebase.

## Frase para colar no Claude
"Continue o projeto Valida+ (PWA de validade, JS puro + Firebase) do repositório rdouradovisciano-cyber/controle-validade. Leia `fonte/CONTINUAR.md` e `fonte/README.md`. Edite em `fonte/src`, gere com `node tools/build.mjs --bump`, copie o resultado para a raiz e publique. Responda em português."

## Token do GitHub
Crie em GitHub → Settings → Developer settings → Fine-grained tokens, só para este repositório, permissão **Contents: Read and write**. Entregue ao Claude só na conversa e **apague o token depois**. Nunca grave o token em arquivo do repositório.
