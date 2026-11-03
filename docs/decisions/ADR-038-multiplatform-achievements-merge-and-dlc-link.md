# ADR-038: conquistas por plataforma, mesclagem de duplicados e DLC vinculada a jogo

## Status

Aceita. Complementa os ADR-028 (conquistas externas), ADR-034 (DLC como entidade)
e ADR-023 (plataformas canônicas).

## Contexto

Quatro problemas apareceram no uso real:

1. Um jogo importado em duas plataformas pelo Achievist mostrava conquistas de
   uma só. A resposta de `GET /games/:id/achievements` juntava as conquistas de
   todas as associações e deduplicava **por nome**: o troféu "Primeiro passo" do
   PlayStation e o do Steam viravam um.
2. O mesmo jogo acabava cadastrado duas vezes (importação, metadados), sem forma
   de unir os cadastros.
3. Conquistas só da RAWG não apareciam. O vínculo com o catálogo era tentado uma
   única vez, ao **criar** o jogo, e em segundo plano; jogos anteriores à chave
   RAWG ou cuja busca falhou ficavam sem catálogo para sempre (a mensagem na tela
   sugeria editar e salvar, mas a edição não refazia a busca).
4. Metadados costumam listar a DLC como jogo à parte, gerando um segundo cadastro
   para o que o usuário já tem como DLC.

Também: o app Flutter não excluía nada. O Dio envia `Content-Type: application/json`
em todas as requisições, e o Fastify responde 400 a um DELETE com esse cabeçalho e
corpo vazio.

## Decisão

### Conquistas por plataforma

`GameAchievementsResponse` ganha `groups`: um grupo por associação de plataforma
com conquistas espelhadas (nome da plataforma, edição quando houver, totais e
lista próprios). Sem fonte pessoal, o catálogo RAWG forma um único grupo
`catalog`. Os campos da raiz (`achievements`, `total`, `unlockedCount`...) seguem
existindo como agregado dos grupos, então consumidores antigos continuam
funcionando. A deduplicação por nome vale **dentro** de um grupo, nunca entre
grupos. Web e Flutter mostram uma aba por plataforma quando há mais de uma.

### RAWG sem Achievist

A leitura de conquistas de um jogo sem vínculo tenta vincular o catálogo RAWG
(`linkRawgCatalog`, a mesma lógica do cadastro), com no máximo uma tentativa por
jogo a cada 10 minutos e sem tentativas simultâneas — abrir a ficha dispara mais
de uma leitura e a RAWG tem cota. Falha na busca nunca derruba a resposta.

### Mesclar duplicados

`POST /games/:id/merge` com `{ sourceGameId }`: o jogo da rota **permanece** e
absorve o de origem, que é removido, numa única transação.

- Sessões, jornadas (a sequência continua após a do jogo que permanece), DLCs,
  histórico de importações de tempo, gêneros, listas e fila passam para o jogo
  que permanece; DLCs vinculadas ao jogo absorvido passam a apontar para ele.
- Associações de plataforma: a mesma plataforma + edição vira uma só (conquistas
  repetidas ficam com a do jogo que permanece; a origem externa é herdada quando
  ele não tinha uma); as demais mudam de jogo. Só uma é principal.
- Campos: o jogo que permanece vence em texto e metadados; lacunas são
  preenchidas pelo absorvido. O progresso (status, datas, avaliação) vem do
  cadastro mais adiantado, e as horas lançadas sem sessão **somam**.
- Catálogo RAWG: fica o do jogo que permanece; o do absorvido é descartado se
  ele já tinha um.

`GET /games/duplicates` sugere grupos por título normalizado (sem acento, caixa,
pontuação, marcas). É só sugestão: nada é mesclado sem confirmação, e qualquer
jogo da biblioteca pode ser escolhido. A ação não é reversível.

### DLC vinculada a jogo cadastrado

`dlcs.linked_game_id` (nullable, `ON DELETE SET NULL`, diferente do jogo base).
Com o vínculo, o estado da DLC vem do ciclo de vida do jogo vinculado e os campos
manuais de status e horas deixam de ser mostrados; a interface oferece abrir o
jogo. A DLC continua existindo como entidade, então a aba de DLCs do jogo base
lista tudo num só lugar sem duplicar o cadastro.

### Cliente Flutter

`DELETE` passa a enviar corpo `{}` e o servidor aceita `application/json` com
corpo vazio (JSON malformado continua sendo 400). Qualquer das duas correções
basta; juntas, a ordem de atualização app/API não importa.

## Migração

`0029_dlc_linked_game.sql`: coluna, FK, check e índice novos; nada existente
muda. O rollback (`.down.sql`) remove a coluna.

## Consequências

- Os totais da raiz de `/achievements` somam plataformas: um jogo com 60 troféus
  PSN e 50 conquistas Steam tem `total` 110. A interface mostra a contagem da
  aba selecionada.
- Mesclar mexe em muitas tabelas; o código vive em um repositório próprio
  (`DrizzleGameMergeRepository`) e as regras de campos são uma função pura
  testada (`mergeGameFields`).
