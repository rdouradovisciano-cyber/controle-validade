# Saúde do app — tema que o usuário vai retomar (anotado em 2026-10-30)

Incômodo do usuário: cadastro, unificação, código interno, código de doação e EAN soltos; sem certeza de que está 100%.

Plano combinado (nesta ordem):
1. Tela «Saúde do app»: produtos sem código, códigos repetidos, nomes parecidos, itens só neste aparelho.
2. Autoteste num botão: grava, lê e apaga um item de teste por setor e diz se o Firebase aceita.
3. Arrumar a raiz: regras do Firebase (pedir o texto atual ao usuário) + campo próprio «setor» nos produtos.
4. Ficha única do produto (EAN, balança, doação/interno, setor, validades, quem mudou e quando).
5. Unificar duplicados com antes/depois e desfazer.
6. Indicador «salvo na nuvem ✓ / só neste aparelho ⚠» por aba.

Remendos conhecidos: Perecíveis depende de o Firebase aceitar a categoria «Perecíveis»; lixeira cai para o aparelho se a nuvem recusar o campo `lixo`; etiquetas de Perecíveis, contagem do KÓRIN e rascunho de doação por setor ficam só no aparelho.
Em 2026-10-30 o KÓRIN passou a usar o mesmo cadastro do FLV (v223).
