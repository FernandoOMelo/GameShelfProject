# ADR-023: cadastro canônico, plataformas associadas e jornadas

## Status

Aceita. Revisa parcialmente o ADR-007 e complementa o ADR-009.

## Contexto

O ADR-007 consolidou plataforma, posse e ciclo de vida no próprio jogo e removeu
a tabela de associações `game_platforms`. Na prática isso impede três coisas que
o uso real exige:

- o mesmo jogo possuído ou jogado em mais de uma plataforma ou edição;
- registrar que um jogo foi jogado mais de uma vez (replay), com datas e estado
  próprios de cada rodada;
- separar o tempo que o usuário registrou aqui do tempo acumulado que uma
  plataforma externa informa.

O ADR-009 continua valendo para a ficha pessoal do jogo: status, posse e as
datas `started_at`/`completed_at` do jogo são o que alimenta o Painel, os
relatórios anuais, as metas e as estatísticas de conclusão.

## Decisão

### Cadastro canônico

`games` continua sendo o cadastro canônico e único de cada jogo. Nada cria um
segundo jogo: nem outra plataforma, nem outra edição, nem um replay. Os ids
atuais são preservados.

### Plataformas associadas

`game_platforms` volta a existir, agora com edição, formato, posse, proveniência
externa e tempo acumulado informado pela plataforma. Um jogo pode ter quantas
associações precisar.

- Unicidade: `(game_id, platform_id, coalesce(edition, ''))`. Edições diferentes
  da mesma plataforma são associações legítimas; a mesma edição duas vezes não.
- `is_primary` marca no máximo uma associação por jogo (índice parcial único) e
  é apenas um resumo de exibição.
- `games.platform_id` continua existindo e é a plataforma principal. Escolher
  uma plataforma no formulário do jogo garante a associação correspondente e a
  marca como principal; limpar a escolha apenas desmarca a principal, sem
  remover a associação.
- Identificadores externos (`external_source`, `external_id`) são únicos quando
  presentes, para que uma importação repetida encontre a associação existente em
  vez de criar outra.
- Desassociar uma plataforma não apaga sessões nem jornadas.

As quatro afirmações a seguir são informações diferentes e não se derivam uma da
outra: o jogo existe naquela plataforma (associação), o usuário possui o jogo
naquela plataforma (`owned` da associação), o usuário jogou naquela plataforma
(`sessions.platform_id`) e o usuário zerou (jornada concluída).

### Jornadas

`playthroughs` representa uma experiência contínua de jogo. Um jogo pode ter
zero, uma ou várias jornadas.

- `sequence` é único por jogo e define a ordenação documentada. Replay é toda
  jornada iniciada com `sequence > 1`; não existe contador manual de replays.
- Estados: `PLANNED`, `PLAYING`, `PAUSED`, `COMPLETED`, `ABANDONED`.
- Transições válidas: `PLANNED → PLAYING`; `PLAYING → PAUSED | COMPLETED |
  ABANDONED`; `PAUSED → PLAYING | COMPLETED | ABANDONED`; `COMPLETED → PLAYING`
  (reabrir); `ABANDONED → PLAYING` (retomar). Qualquer outra é recusada com 409.
- Retomar uma jornada pausada ou abandonada continua na mesma jornada. Reabrir
  uma jornada concluída limpa `completed_at` no mesmo pedido, para que ela deixe
  de ser contada como concluída.
- Concluir exige `completed_at`; `PLANNED` não pode ter datas. As duas regras
  valem no banco (checks) e na fronteira (Zod).
- Uma jornada não obriga uma plataforma. `primary_platform_id` é apenas resumo
  de exibição: a plataforma real é registrada por sessão.
- Excluir uma jornada não apaga sessões: elas ficam sem jornada.

### Relação com o status global do jogo

Jornadas **não** reescrevem `games.status`, `games.started_at` ou
`games.completed_at`. Não há duas fontes de verdade porque as duas respondem a
perguntas diferentes e são declaradas explicitamente pelo usuário:

- a ficha do jogo (ADR-009) responde "em que ponto este jogo está na minha
  biblioteca" e continua sendo a base do Painel, das metas, do Replay anual e de
  `stats.totals`;
- as jornadas respondem "quantas vezes eu joguei, quando, e como cada rodada
  terminou", e são a base das métricas de replay.

Concluir uma jornada não marca o jogo como zerado automaticamente. A interface
mostra os dois e o usuário decide, com uma ação explícita, se quer alinhar a
ficha do jogo. Em consequência, `stats.totals.completedCount` (jogos zerados
pela ficha) e `stats.library.gamesWithCompletedPlaythrough` (jogos com ao menos
uma jornada concluída) são métricas distintas e ambas são publicadas.

### Sessões

`sessions` ganha `playthrough_id` e `platform_id`, ambos opcionais:

- sessões antigas e sessões sem informação confiável continuam válidas sem
  vínculo nenhum;
- sessões da mesma jornada podem usar plataformas diferentes;
- a jornada precisa ser do mesmo jogo da sessão. Uma chave estrangeira de coluna
  única não garante isso, então a regra é validada na rota e coberta por teste;
- remover a jornada aplica `ON DELETE SET NULL`: a sessão permanece com
  duração, datas e anotações intactas.

### Métricas

Definições publicadas em `/games/:id/playthroughs/metrics` e em `stats.library`:

- **jornadas iniciadas**: jornadas que deixaram de ser `PLANNED`. Uma jornada
  planejada não conta como iniciada;
- **jornadas concluídas**: jornadas em `COMPLETED`. Abandonada não conta como
  concluída;
- **replays iniciados**: jornadas iniciadas com `sequence > 1`;
- **jogos com jornada zerada**: jogos canônicos distintos com ao menos uma
  jornada concluída;
- **associações de plataforma**: contagem de linhas de `game_platforms`, que não
  se confunde com a contagem de jogos — um jogo em três plataformas continua
  sendo um jogo;
- **horas registradas aqui** e **horas informadas por plataformas** são campos
  separados e nunca são somados.

## Migração

`0017_game_platforms_and_playthroughs.sql`:

- cria `game_platforms` e `playthroughs` e adiciona as duas colunas de
  `sessions`;
- reaproveita a plataforma principal que o usuário já escolhera: cada jogo com
  `platform_id` ganha uma associação com a mesma plataforma, a mesma posse e
  `is_primary = true`. Jogos sem plataforma continuam sem associação;
- **não** cria jornadas, **não** gera sessões e **não** preenche plataforma ou
  jornada nas sessões existentes. Nenhuma data ou conclusão é inventada.

Validada em uma cópia do banco real (54 jogos, 19 sessões): os ids de jogos e
sessões e as datas das sessões saem idênticos, 52 associações são criadas — uma
para cada jogo que já tinha plataforma — e nenhuma jornada é criada.

Rollback manual em `0017_game_platforms_and_playthroughs.down.sql`, também
validado na mesma cópia. O Drizzle não aplica arquivos `.down.sql`: é preciso
rodar o script e remover a entrada do journal e da tabela de controle. O
rollback só descarta o que foi criado depois da migração (associações, jornadas
e os vínculos das sessões); o histórico anterior não é tocado.

## Consequências

- O backup passa a exportar e importar `gamePlatforms` e `playthroughs`, e as
  sessões carregam `playthroughId`/`platformId`. As coleções novas têm padrão
  vazio no schema, então um backup gerado antes desta versão continua
  importável.
- `gameSchema` ganha `platformIds` (derivado). O filtro de plataforma da
  biblioteca passa a considerar todas as associações, não só a principal.
- O app Flutter (`apps/mobile`) não foi alterado. As mudanças da API são
  aditivas e ele ignora os campos novos, então continua funcionando com a
  plataforma principal e sem jornadas. Levar a paridade do ADR-022 para
  plataformas e jornadas é trabalho à parte.
