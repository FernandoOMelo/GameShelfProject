# Linha do tempo

## Objetivo

Responder "o que eu fiz", reunindo num só lugar e em ordem decrescente tudo o que
aconteceu na biblioteca. É a aba **Atividade**.

## Eventos

| Evento | Origem | Texto |
|---|---|---|
| `GAME_ADDED` | `games.createdAt` | Adicionou à biblioteca |
| `GAME_STARTED` | `games.startedAt` | Iniciou |
| `GAME_COMPLETED` | `games.completedAt` | Zerou |
| `SESSION` | sessões encerradas | Jogou |
| `CHALLENGE_COMPLETED` | `challenge_completions` | Completou a missão |

Eventos de sessão mostram os mesmos campos do detalhe do jogo: data e hora, duração,
onde parou, progresso, notas e screenshots.

## Regras

1. Os eventos são agrupados pelo dia civil, no fuso do navegador.
2. `startedAt` e `completedAt` são datas sem hora; esses eventos são ordenados pelo
   início do dia, então aparecem acima das sessões do mesmo dia.
3. Sessões em andamento não aparecem — só sessões encerradas entram no histórico.
4. A linha do tempo é somente leitura. O título do jogo abre o detalhe, onde a sessão
   pode ser editada ou excluída.
5. O evento de sessão mostra o diário inteiro: onde parei, resumo da história, decisões
   importantes e dicas e lembretes (ADR-018).
6. A paginação é por cursor (`before`), carregada por "Carregar mais".
7. Conclusões de missão só existem a partir da migration `0014`. O backfill recuperou
   a missão atual se ela já estava completa; missões concluídas antes e desfeitas
   depois não têm registro.

## API

`GET /stats/timeline?limit=&before=&timezoneOffsetMinutes=`

`limit` vai de 1 a 200 (padrão 50). A resposta traz `events` e `nextBefore`, que é
`null` quando não há mais histórico.

Decisões em ADR-016.
