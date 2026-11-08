# NOTAS DO PROJETO — Valida+

> Leia este arquivo no começo de toda conversa nova. Sem dados pessoais de propósito (o repositório é público).
> Última atualização: 08/11/2026 · versão 401.

## O que é
App PWA de controle de validade de loja. JavaScript puro + Firebase Firestore, publicado no GitHub Pages
(`rdouradovisciano-cyber/controle-validade`). Setores: FLV, Perecíveis, KÓRIN, Fiscal de loja. Perfis do aparelho: FLV, Perecíveis, Fiscal, Admin.

## Onde fica o quê
- Código-fonte: `src/` (principal: `src/js/app.js`, uma IIFE grande; `src/index.html`; `src/css/app.css`; `src/js/menu.js`).
- Avisos de versão: `src/data/updates.json` — **toda versão ganha um item novo no começo** (`{"t": ISO, "itens": [...]}`).
- Site publicado = raiz do repositório (`index.html`, `js/`, `css/`, `version.json`, `ocr/`); cópia do fonte em `fonte/src` e testes em `fonte/tools`.
- Leitor de texto das fotos (OCR): Tesseract.js 5.1.1 hospedado junto em `ocr/`.

## Como compilar e publicar (a ordem importa)
1. `BUILD_DATE=2026.11.06 node tools/build.mjs --bump` → gera `dist/` e sobe o número da versão.
2. Copiar `dist/index.html`, `dist/version.json`, `dist/js/*.js`, `dist/css/*.css` (e `dist/ocr` se mudou) para o repositório publicado.
3. `rm -rf fonte/src && cp -r src fonte/src`; copiar testes novos para `fonte/tools/`.
4. `git add -A`, commit (com as linhas Co-Authored-By e Claude-Session), `git push` (tentar de novo se falhar).
5. Conferir: `git fetch` e `git rev-parse HEAD origin/main` deve mostrar **uma linha só**.
6. **Antes de começar, rode `git fetch` e veja se há commits novos no GitHub** (já aconteceu de outra sessão ter publicado versões; nesse caso, partir do `fonte/src` do GitHub).
7. Avisar o usuário: fechar e abrir o app duas vezes para atualizar (o GitHub Pages demora um pouco).

## Testes
Playwright com o Chromium em `/opt/pw-browsers/chromium`, scripts em `tools/*.mjs` (ex.: `esc8-test`, `saude3-test`, `fl-test`, `acs-test`, `ben2-test`). O servidor de teste remove a chave da API. Dados de teste entram pelo `localStorage`
(`validamais-perfil`, `validamais-operador`, `validamais-tema` = `light`/`dark`, `validamais-escala-vista` como JSON). Capturas de tela vão para a pasta de rascunho da sessão.

## Dados (Firestore)
Coleções: `products`, `doacoes`, `acessos` (Atividade dos usuários), `devices`, `scans`, `fotos`, `sh_etiquetas`, `sh_cfg` (configurações: `escala`, `flores`, …). As regras estão **abertas** (sem login) — por isso nada sensível nem pessoal deve ir para o banco sem antes fechar as regras. `firestore.rules` no repositório precisa ser publicado pelo usuário no console do Firebase quando mudar.
O app guarda tudo também no aparelho (`store.get/set`, chaves `validamais-*`) e sincroniza com a nuvem.

## Regras combinadas com o usuário
- **Preferência:** quantidades simples e arredondadas, principalmente em receitas.
- **Perecíveis não têm «código de doação»:** o mesmo campo aparece como **«Código interno»**; em FLV continua «Doação».
- **Cadastro:** o usuário deve bipar; «Cadastro manual» fica nos três pontinhos (só a bolinha de escanear fica no canto). EAN digitado é conferido pelo dígito verificador; nome parecido já existente gera aviso.
- **Foto no cadastro:** a mesma foto vira foto do produto e lê o nome do rótulo (OCR).
- **Atividade dos usuários:** registra entradas e também **acessos às telas** (Validades, Doação, Pesáveis, Etiquetas, Inventário, Cadastros, Contagem, Escala 5x2, Flores), no máximo 1× a cada 5 min por tela; filtro «👁️ Acessos».
- **Modo claro:** sempre conferir contraste das letras (usar `var(--ink)` e cores escuras; sobrescrever com `html[data-tema="light"]`).

## Escala 5x2 (menu ⋮ → «Escala 5x2»)
- Quem vê: perfil **Admin** e qualquer usuário cujo nome contenha «Benassi» (em qualquer perfil). **Não existe perfil BENASSI.** Os dois podem configurar.
- Duas pessoas (1 e 2), com fotos e nomes configuráveis no app (⚙️). Início da escala nova: segunda 09/11/2026. 42 h semanais, 8h24 por dia, 60 min de intervalo.
- Ciclo (D S T Q Q S S), duas semanas que se repetem: pessoa 1 folga sempre na quarta, pessoa 2 sempre na quinta; domingo alterna; quem folga no domingo já fecha as duas folgas; quem trabalha no domingo folga também na terça. Nunca os dois folgam no mesmo dia. **Máximo de 5 dias seguidos trabalhando**, mesmo entre semanas (o app avisa).
- Ciclos antigos salvos no aparelho migram sozinhos (lista `ESC_CICLOS_ANTIGOS` em `app.js`); ao mudar o padrão, acrescentar o anterior a essa lista.
- Calendário com total de horas da semana (✓42h) no fim de cada linha; modo lista, tela cheia (painel do app), imagem horizontal para WhatsApp (1600×900), troca de dia com mais de um toque.
- Fotos e nomes completos ficam só no Firestore (`sh_cfg/escala`) e no aparelho, nunca no repositório.

## Flores (menu ⋮ → «Flores», só Admin)
Setor da loja. Cadastra planta com foto, espécie (catálogo `FL_CAT` em `app.js`, ~41 espécies com intervalo de rega e cuidados), apelido, local, intervalo e última rega. Lista «Atrasadas / Regar hoje / Próximas», botão 💧 Reguei (com Desfazer). Intervalo ajustado pela estação (dez–mar ×0,85; jun–ago ×1,3). Dados em `sh_cfg/flores`.
**Não reconhece planta pela foto** (opção escolhida: só catálogo). Os cuidados do catálogo vieram de conhecimento geral, não de busca na internet.

## Pendências e ideias ainda não escolhidas
- Usuário precisa: publicar o `firestore.rules` atualizado; criar a senha do Admin; testar com Firebase real, câmera real, compartilhar imagem e tela sempre acesa no celular.
- Ideias abertas: tela «Usuários» (último acesso e perfil), Flores (plantas à venda com data de chegada, registro de perdas, agrupar por bancada), reconhecimento de planta com Pl@ntNet (chave gratuita), Escala (card «Hoje» com fotos, próxima folga de cada um, cor de cobertura, barras de horas, lembretes, histórico de trocas), «Produtos novos» agrupados por dia, perfil Gestor, restaurar produtos apagados, «Ver na loja» em Cadastros parecidos, KÓRIN na nuvem, aviso diário de validade.
- Revisar contraste do modo claro nas telas Atividade e Cadastros parecidos.
- Saúde do app › Códigos repetidos tem 3 botões: «Unir neste» (uniformiza nome, não apaga), «Tirar daqui» (tira só o código) e «Excluir cadastro» (lixeira, 3 dias; v395). Desde a v396 «Unir neste» funciona também em produto de outro setor (passa o setor para `dupUnirCore`): o nome escolhido fica e os lotes dos dois passam para ele.
- v397: lista de Validades mostra o nome inteiro (até 2 linhas, `nomeBonito()` só na exibição; o dado salvo não muda) e a linha de baixo ficou «Qtd 28 · vence 17/11». Operador (👤) só para Admin. Ideias ainda não feitas: agrupar por data, busca/filtros por tipo, cores por urgência, modo compacto.
- v398: Perecíveis com foto mostram a miniatura no lugar do emoji (Validades: coluna à esquerda; Pesáveis: inline). Uma consulta só em `sh_cfg` (campo `d` ≥ "data:") traz todas as fotos e fica ouvindo mudanças (`fotosTodas`). Se a consulta falhar, o emoji continua e a foto só carrega ao abrir o item, como antes. Não testado com o Firebase real.
- v399: efeitos na lista de Validades: pulso de borda em `.pitem.pra/.prh` (fechados), anel da foto na cor `--tc`, entrada escalonada (`entradaLista`, classe `.ent`, só quando muda setor/visão e depois do #splash). Tudo desligado com prefers-reduced-motion. Ideias que sobraram: deslizar ao retirar, contador rolando, esqueleto da foto, brilho quando zera o grupo urgente.
- v400: o efeito de saída ao retirar (`efeitoSai`, classe `.saindo`) já existia; adicionei vibração curta (se «efeitos» ligado), sem pulso na saída e foto em cinza. Sobram: contador rolando, esqueleto da foto, brilho quando zera o grupo urgente.
- v401: área de bip (modal do scanner) ganhou busca por nome discreta (`#nmBusca`/`nmBusca()`): só produtos com EAN, sem retirados, até 6 resultados; tocar chama `onCode(ean)` (mesmo caminho do bip, vale para todos os modos). Produtos só com código de balança (sem EAN) não aparecem ali.
