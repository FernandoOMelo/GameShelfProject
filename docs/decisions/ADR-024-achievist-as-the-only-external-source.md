# ADR-024: Achievist como única fonte externa de plataformas

## Status

Aceita e implementada. O cliente isolado, a importação idempotente, a fila de
correspondências a confirmar, as rotas de sincronização manual e a tela da web
estão no código; a migração `0018_external_match_queue.sql` cria a fila. O
levantamento da API real está registrado aqui e em `docs/product/achievist.md`.

## Contexto

O GameShelf precisa de dados das plataformas (Steam, PlayStation, Xbox e outras)
sem implementar autenticação e conectores para cada uma. Uma instância
self-hosted do Achievist já faz exatamente isso na mesma máquina.

O levantamento foi feito contra a instância instalada (`/openapi.json` em
`localhost:8744` e o código em `app/main.py`, `app/db.py`, `schema.sql`), não
contra documentação genérica.

## Decisão

### Divisão de responsabilidades

O Achievist é a **única** integração externa para dados de plataformas. Ele
autentica as contas, guarda tokens e credenciais, consulta os serviços e
sincroniza biblioteca, conquistas e tempo acumulado.

O GameShelf não implementa conector direto para nenhuma plataforma e não duplica
os mecanismos de autenticação delas. Ele mantém o cadastro canônico, as
plataformas associadas, as jornadas, as sessões manuais, o backlog, as
avaliações e as estatísticas, e consome o que o Achievist expõe.

A comunicação é sempre servidor a servidor, pela rede Docker privada, usando o
nome interno do serviço. A API do Achievist não precisa ser publicada na
internet e o navegador nunca fala com ela.

### O que a API real oferece

Identificadores estáveis disponíveis:

- `platform_game_id` (inteiro, chave primária de `platform_games`);
- o par `(platform, platform_app_id)` — appid da Steam, id da RA, np comm id;
- `account_id` de `/api/accounts`.

Por conta disso, a importação é idempotente pelo identificador do jogo externo,
não pelo título.

### O que a API real **não** oferece

Isto decide o desenho da conciliação, e não é uma limitação temporária do
cliente: o banco do Achievist não guarda esse dado.

- **Não existe sessão de jogo.** `user_games` guarda apenas
  `playtime_minutes` acumulado, `last_played_at`, contagem de conquistas e
  `completion_pct`. Não há horário de início, horário de fim, nem evento de
  sessão em nenhuma tabela.
- Os únicos eventos com data e hora são desbloqueios de conquista
  (`user_achievements.unlocked_at`). Um desbloqueio é um instante, não um
  intervalo: não é uma sessão.
- `/api/activity` é um agregado diário de desbloqueios. `/api/unlocks/recent`
  vem de uma lista em memória do processo e se perde a cada reinício — não é
  fonte durável de eventos.
- `/api/games` só lista jogos com `total_achievements > 0`: jogos sem conquistas
  não aparecem.
- `/api/export` identifica jogos por nome, sem id, então não serve para
  correspondência por identificador.
- O `igdb_id` existe em `platform_games` mas **não** é exposto em nenhuma rota.
  Como o GameShelf também usa o IGDB para metadata (ADR-001), esse seria o
  identificador comum ideal; hoje ele não está disponível pela API.

### Consequências diretas dessas limitações

1. **Nenhuma sessão é importada do Achievist.** Tempo acumulado não é lista de
   sessões. Nenhuma sessão artificial é criada, nenhuma duração de sessão manual
   é alterada em silêncio e nenhuma correspondência exata é inventada.
2. Por isso não existe risco de contabilizar a mesma atividade duas vezes: só há
   um tipo de evento de sessão no sistema, o registrado manualmente. A
   hierarquia de conciliação por identificador de sessão não se aplica, porque a
   fonte não tem identificador de sessão. Afirmar que a conciliação de sessões é
   confiável aqui seria falso.
3. O tempo acumulado por plataforma é gravado em
   `game_platforms.external_playtime_minutes` e apresentado como métrica
   separada. `NULL` significa "a fonte não informa", nunca zero. Ele nunca é
   somado às horas das sessões locais.
4. A correspondência entre um jogo externo e o jogo canônico não pode usar o
   título como prova. Sem `igdb_id` na API, o vínculo é por identificador
   externo já confirmado ou fica pendente de confirmação do usuário. Uma
   correspondência ambígua não é resolvida automaticamente.

### Autenticação

A API do Achievist tem um único mecanismo: sessão por cookie
(`achievist_session`), obtida em `POST /api/auth/login` com usuário e senha.
Não há token de serviço nem chave de API, e toda rota de leitura exige login
(`401 {"detail":"Not logged in"}`).

Em consequência, a API do GameShelf precisa guardar credenciais do Achievist e
manter o cookie da sessão. A decisão é seguir o precedente do IGDB (ADR-001):
as credenciais ficam em variáveis de ambiente do container da API
(`ACHIEVIST_BASE_URL`, `ACHIEVIST_USERNAME`, `ACHIEVIST_PASSWORD`), nunca no
banco, nunca no frontend e nunca em log. Sem essas variáveis a integração fica
simplesmente desligada.

### Sincronização

`POST /api/sync` e `POST /api/accounts/{id}/sync` disparam a sincronização e
respondem 202; `409` quando já existe uma rodando (o Achievist usa um lock
global). `GET /api/sync/progress` informa o andamento, mas não é por usuário.

A sincronização do GameShelf é manual, serializada (uma rodada por vez) e
idempotente por `platform_game_id`. Indisponibilidade do Achievist não pode
impedir a biblioteca nem o registro manual de sessões.

## Alternativas descartadas

- Conectores diretos para Steam/PSN/Xbox: duplicaria autenticação e segredos
  que o Achievist já administra, contra o objetivo desta decisão.
- Derivar sessões dos desbloqueios de conquista: inventaria início, fim e
  duração a partir de instantes isolados.
- Ler o banco do Achievist direto para obter o `igdb_id`: acopla o GameShelf ao
  schema interno de outra aplicação. O caminho correto é expor `igdb_id` na API
  do Achievist; até lá, a confirmação é do usuário.

## Implementação

### Cliente isolado

`apps/api/src/modules/integrations/achievist/client.ts` concentra URL base,
login por cookie, reautenticação quando a sessão expira (um 401 refaz o login e
repete a requisição), timeout de 15 s por chamada, paginação de `/api/games` em
páginas de 200 e normalização das respostas. A senha só existe dentro dessa
classe e nenhuma mensagem de erro a repete: o que sai é o status HTTP.

A interface que o resto da API consome é `ExternalLibraryProvider`, em
`modules/integrations/external-library.ts`, e fala o vocabulário do GameShelf
(entradas de biblioteca com plataforma, tempo acumulado e última atividade).
Nada fora do cliente conhece endpoint, cookie ou chave de plataforma da fonte.

As chaves de plataforma da fonte (`steam`, `psn`, `xbox`, `retroachievements` e
as demais) são traduzidas no cliente para nomes do catálogo `platforms`. Uma
chave sem mapeamento vira o próprio nome capitalizado, e ao confirmar a
correspondência o usuário pode escolher outra plataforma do catálogo.

A listagem de biblioteca da fonte não diz de qual conta cada jogo veio, só a
plataforma. `external_account_label` recebe o nome da conta quando a plataforma
tem exatamente uma conta conectada; com mais de uma, fica nulo em vez de
atribuir a conta errada.

### Importação

`importExternalLibrary` percorre as entradas e, para cada uma já vinculada por
(`external_source`, `external_id`), atualiza só `external_account_label`,
`external_playtime_minutes`, `external_last_played_at` e `external_synced_at` da
associação. Entradas sem vínculo não viram associação: vão para a fila.

A idempotência vem do par (fonte, identificador externo), que tem índice parcial
único desde a 0017. Sincronizar duas vezes reescreve o mesmo retrato nas mesmas
linhas; edição, formato, posse, principal e notas da associação não são tocados.

### Fila de correspondências

`external_game_matches` (migração 0018) guarda o retrato das entradas sem
vínculo, com `PENDING` ou `IGNORED`. Confirmar remove a linha, porque o vínculo
passa a viver em `game_platforms`; ignorar mantém a linha, e é isso que impede a
próxima rodada de propor a mesma entrada outra vez. O status não entra no
`UPDATE` do upsert, então uma entrada ignorada resiste a qualquer sincronização.

As sugestões são calculadas na leitura da fila, comparando o título normalizado
(minúsculas, sem acentos, sem pontuação) com os jogos canônicos. Elas são
apresentadas como sugestão e nunca aplicadas sozinhas; mais de um candidato
marca a pendência como ambígua e a tela deixa a escolha vazia.

Confirmar é sempre ação explícita do usuário. A associação criada na confirmação
nasce com `owned = true` — a entrada vem da biblioteca da conta externa e a
criação só acontece porque o usuário confirmou. Uma associação já vinculada a
outra entrada externa não é sobrescrita: a confirmação responde 409.

### Sincronização manual

Rotas sob `/integrations/achievist`: `POST /sync` dispara (202, ou 409 quando já
existe uma rodando), `GET /sync` informa estado e resultado da última rodada,
`GET /pending` lista a fila com as sugestões, e
`POST /pending/:id/confirm` e `POST /pending/:id/ignore` resolvem uma pendência.

O estado da rodada vive no processo da API, não no banco: é a rodada atual e o
resultado da última, não histórico. Reiniciar a API volta para `idle` sem perder
nada, porque o resultado da importação está nas associações.

Sem as três variáveis de ambiente, `GET /sync` responde `disabled` e as ações
respondem 503. A biblioteca, as sessões e todo o resto da API seguem normais, e
a fonte indisponível é um resultado possível da rodada (`failed`), não uma falha
da aplicação.

### Rede Docker

O override opcional `docker-compose.achievist.yml` liga o container da API à
rede onde o Achievist já roda:

```bash
docker compose -f docker-compose.yml -f docker-compose.achievist.yml up -d
```

`ACHIEVIST_NETWORK` é o nome dessa rede (`docker network ls`) e
`ACHIEVIST_BASE_URL` usa o nome interno do serviço com a porta interna 8000.
Nada é publicado na internet e o navegador nunca fala com o Achievist.

### O que a fila não cobre

O backup (ADR-014) exporta `gamePlatforms` com os campos `external_*`, então os
vínculos confirmados sobrevivem a um export/import. A fila de pendências não é
exportada: ela é retrato da fonte, reconstruído pela próxima sincronização.
A consequência é que as entradas marcadas como ignoradas voltam a ser propostas
depois de restaurar um backup, e precisam ser ignoradas de novo. Levar a fila
para o backup só valeria para preservar essas decisões, e não vale o acoplamento
hoje.

Jogos sem conquistas não aparecem em `/api/games`, então não aparecem na fila:
eles continuam sendo cadastrados à mão, como antes.

### Limites provados por teste

Em `apps/api/src/modules/integrations/sync.test.ts`: nenhuma sessão e nenhuma
jornada são criadas por sincronização; o tempo externo é gravado separado e as
horas locais, a nota e as anotações do jogo não mudam; encontrar o mesmo jogo em
outra plataforma não cria replay (as métricas de jornada continuam em zero);
sincronizar duas vezes não duplica associações nem pendências e preserva o que o
usuário declarou; ambiguidade fica marcada e não se resolve sozinha; uma
pendência ignorada não volta; a fonte indisponível não impede listar a biblioteca
nem registrar uma sessão manual; e sem credenciais a integração se declara
desligada. O cliente tem testes próprios com `fetch` injetado em
`achievist/client.test.ts`.
