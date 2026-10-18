# Achievist: o que a API oferece e o que não oferece

Levantamento feito contra a instância self-hosted instalada (OpenAPI em
`/openapi.json` e o código da aplicação: `app/main.py`, `app/db.py`,
`schema.sql`). Decisão arquitetural no ADR-024, onde está também o desenho da
integração já implementada.

## Modelo de dados do Achievist

| Tabela | Conteúdo |
| --- | --- |
| `linked_accounts` | Conta externa por plataforma, com credenciais e `last_synced_at`. |
| `platform_games` | Catálogo por `(platform, platform_app_id)`, com `igdb_id` e horas do HowLongToBeat. |
| `user_games` | Por conta e jogo: `playtime_minutes` acumulado, `last_played_at`, conquistas ganhas/totais, `completion_pct`. |
| `achievements` / `user_achievements` | Definição da conquista e o desbloqueio, com `unlocked_at`. |
| `sync_runs` | Histórico das sincronizações. |

Não existe tabela de sessão de jogo.

## Endpoints úteis

| Rota | Para que serve |
| --- | --- |
| `POST /api/auth/login` | Único jeito de autenticar. Corpo `{"username","password"}`, devolve o cookie `achievist_session` (validade de 30 dias). |
| `GET /api/auth/status` | Único endpoint que responde sem login. |
| `GET /api/accounts` | Contas conectadas, com credenciais mascaradas. |
| `GET /api/platforms` | Esquema de conexão de cada plataforma suportada. |
| `GET /api/games` | Biblioteca paginada (`page`, `page_size` até 200, `platform`, `search`, `completion`, `sort`). Traz `platform_game_id`, `platform`, `platform_app_id`, `name`, `playtime_minutes`, `last_played_at`, conquistas e capas. |
| `GET /api/games/{platform_game_id}` | Detalhe do jogo, com horas do HLTB e resumo de raridade. |
| `GET /api/games/{platform_game_id}/achievements` | Conquistas do jogo. |
| `POST /api/sync` e `POST /api/accounts/{id}/sync` | Dispara a sincronização (202); `409` se já houver uma rodando. |
| `GET /api/sync/progress` | Andamento da sincronização em curso. |

## Identificadores estáveis

- `platform_game_id`: inteiro, chave primária do catálogo. É a chave de
  idempotência da importação.
- `(platform, platform_app_id)`: appid da Steam, id da RetroAchievements, np
  comm id da PSN.
- `account_id` das contas conectadas.

## Limitações confirmadas

- **Sem sessões.** Só existe tempo acumulado (`playtime_minutes`) e a última
  atividade. Nenhum horário de início ou fim, em nenhuma rota.
- Os únicos eventos com data e hora são desbloqueios de conquista. Um instante
  não é um intervalo, então não dá para derivar sessão dele.
- `/api/activity` é agregado diário de desbloqueios.
- `/api/unlocks/recent` vem de uma lista em memória do processo: zera a cada
  reinício.
- `/api/games` filtra `total_achievements > 0`, então jogos sem conquistas não
  aparecem na biblioteca.
- `/api/export` identifica jogos só por nome, sem id.
- `igdb_id` existe no banco mas não é exposto por nenhuma rota. Seria o
  identificador comum com a metadata do GameShelf (ADR-001). Enquanto não
  existir, correspondência ambígua fica para o usuário confirmar.
- `GET /api/sync/progress` reflete qualquer sincronização em curso na instância,
  não só a do usuário logado.
- Autenticação é só por cookie de sessão, com usuário e senha. Não há token de
  serviço nem chave de API.

## Nomes de plataforma

O Achievist informa a loja ("Steam", "Google Play"), não o aparelho. Para que
isso não vire uma associação paralela à que você já tem, coloque a loja dentro
do grupo correspondente no painel "Grupos de plataforma" (ADR-025). A
sincronização continua gravando a loja, e as estatísticas agregam pelo grupo.

## Como a integração consome isso

- Tempo acumulado por plataforma vai para
  `game_platforms.external_playtime_minutes`, com `external_source`,
  `external_id` (`platform_game_id`), `external_account_label`,
  `external_last_played_at` e `external_synced_at`. Fica sempre separado das
  sessões e nunca é somado a elas.
- Nenhuma sessão é criada a partir do Achievist. Nenhuma duração ou anotação
  manual é alterada por sincronização.
- Nenhuma jornada é criada automaticamente, e encontrar o mesmo jogo em outra
  plataforma não cria replay.
- Correspondência por identificador externo; nunca por título. Sem evidência
  suficiente, o vínculo fica pendente de confirmação.
- A listagem de biblioteca não informa a conta de cada jogo, só a plataforma:
  o rótulo da conta é preenchido quando a plataforma tem exatamente uma conta
  conectada e fica nulo quando há mais de uma.
- Jogos sem conquistas não aparecem em `/api/games`, então não aparecem na fila
  de correspondências. Esses jogos continuam sendo cadastrados à mão.

## Configuração

Variáveis no container da API (ver ADR-024). Credenciais só no servidor, nunca
no navegador e nunca em log:

```env
ACHIEVIST_BASE_URL=http://achievist-app-1:8000
ACHIEVIST_USERNAME=
ACHIEVIST_PASSWORD=
```

As três são exigidas em conjunto; sem elas a integração fica desligada, a tela
do painel diz isso e o resto da aplicação funciona normalmente.

Os dois containers precisam compartilhar uma rede Docker. O override
`docker-compose.achievist.yml` liga a API à rede onde o Achievist já roda:

```bash
docker network ls   # descubra o nome da rede do Achievist
# ACHIEVIST_NETWORK e ACHIEVIST_BASE_URL no .env
docker compose -f docker-compose.yml -f docker-compose.achievist.yml up -d
```

O GameShelf chama o Achievist pelo nome interno do serviço e pela porta interna
(8000), sem publicar nada na internet e sem precisar de domínio ou HTTPS
público. O navegador nunca fala com o Achievist.

## Como usar

No Painel, o cartão "Plataformas externas (Achievist)" dispara a sincronização,
mostra o resultado da última rodada e lista as correspondências a confirmar. Para
cada entrada você escolhe o jogo canônico e a plataforma, ou manda ignorar. Nada
é vinculado sem essa confirmação, e sincronizar não cria sessão nem jornada.
