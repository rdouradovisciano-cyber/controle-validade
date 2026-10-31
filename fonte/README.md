# Valida+ — projeto separado

    src/index.html       só a estrutura (HTML)
    src/css/app.css      todo o CSS (já sem regras mortas)
    src/js/*.js          um arquivo por módulo (app, inventario, operador, menu, teclado…)
    src/data/updates.json  histórico de novidades (edite aqui; o mais novo vai no topo)
    src/version.json     contador da versão ({"seq":147})
    tools/build.mjs      gera dist/ com versao, version.json e ?v= nos arquivos
    dist/                o que vai para a hospedagem

Publicar uma versão nova:  `node tools/build.mjs --bump`   (precisa de Node)

Coloque em src/ os arquivos que não vieram no upload: vendor.js, sw.js, manifest.webmanifest, ícones.
O sw.js precisa listar os novos arquivos (css/app.css e js/*.js) no cache, se ele usa uma lista fixa.
