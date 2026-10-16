# ADR-016: Linha do tempo, navegação por indicadores e app Flutter

## Status

Aceito.

## Contexto

A aplicação respondia bem "o que estou jogando", mas não respondia "o que eu fiz".
As sessões só existiam dentro do detalhe de cada jogo: não havia nenhuma visão de
histórico que atravessasse a biblioteca. Os indicadores do painel mostravam números
sem levar a lugar nenhum, e a biblioteca não permitia filtrar por lista nem ordenar
por data.

Além disso, `apps/mobile` (Flutter) foi adicionado ao monorepo sem passar por
nenhuma decisão registrada: não constava em `architecture.md`, `mobile.md` nem
`AGENTS.md`. O `mobile.md` descrevia apenas a PWA e afirmava "não transformar o
mobile em uma cópia reduzida do dashboard desktop".

Sobre missões: `main_challenge` é uma linha única com título e lista, e o progresso
era calculado ao vivo (jogos zerados / jogos da lista). Não havia histórico de status
em nenhuma tabela, então não existia registro de **quando** uma missão foi concluída.

## Decisão

**1. Linha do tempo única, em vez de duas telas.** A lista de sessões recentes de
todos os jogos e o feed de eventos se sobrepõem quase por completo, então existe uma
só view (`apps/web/src/pages/timeline-view.tsx`, item "Atividade" no menu). As
sessões aparecem como eventos e carregam os mesmos campos do detalhe do jogo
(duração, progresso, onde parou, notas e screenshots). A timeline é somente leitura:
editar sessão continua no detalhe do jogo, alcançável pelo título clicável.

Cinco tipos de evento, em `GET /stats/timeline`: `GAME_ADDED` (de `games.created_at`),
`GAME_STARTED` (`games.started_at`), `GAME_COMPLETED` (`games.completed_at`),
`SESSION` (sessões encerradas) e `CHALLENGE_COMPLETED`. Eventos derivados de colunas
`date` usam o início do dia como instante de ordenação; sessões usam o timestamp real.
Paginação por cursor (`before`), não por offset, porque o feed é imutável no passado.

A lógica fica num builder puro (`apps/api/src/modules/stats/timeline.ts`), seguindo
`activity.ts` e `replay.ts`, para ser testável sem banco.

**2. Histórico de conclusão de missões em tabela nova.** Como não havia como saber
quando uma missão terminou, `challenge_completions` (migration `0014`) passa a
registrar cada conclusão: título (snapshot, porque o título da missão muda),
`list_id`, quantidade de jogos e data. A detecção acontece no `PATCH /games/:id`
quando um jogo passa a `COMPLETED` com data: se todos os jogos da lista da missão
estão zerados, grava-se a conclusão datada pelo último jogo zerado.

Idempotência pelo índice único `(list_id, games_count)` — a missão pode oscilar
entre 100% e menos quando jogos entram na lista, e cada tamanho distinto rende no
máximo um registro. A migration faz backfill do histórico derivável: se a missão
atual já está completa, registra-a com `max(completed_at)`.

O detector é uma função pura (`detectChallengeCompletion`) e recebe o jogo
recém-atualizado sobreposto ao estado lido, para não depender de read-after-write
do repositório.

**3. Indicadores navegáveis por props de callback, sem estado na URL.** O app troca
de tela por `useState` e o detalhe de jogo é estado, não rota. Introduzir roteamento
afetaria toda a navegação para ganhar links compartilháveis que um app pessoal de um
usuário só não precisa. Então `DashboardView` recebe `onFilterLibrary(filter)` e os
indicadores clicáveis viram `<button>` com o mesmo visual do cartão. Mapeamentos:
jogos zerados no período e as barras de "zerados por ano" → status `COMPLETED` (as
barras também fixam o ano), horas restantes no backlog → `BACKLOG`, "em andamento" e
a legenda de status → o status correspondente.

Consequência aceita: sem link direto e sem botão voltar entre telas.

**4. Filtro da biblioteca por lista e criação de lista a partir do filtro.** Estende
o ADR-008, que definiu listas como independentes de status, estimativas, fila e
relatórios — filtrar a biblioteca por lista não viola isso, pois é leitura. O filtro
e a ordenação continuam no cliente, sobre o `GET /games` completo, como todo o resto
dos filtros: o `GET /games` não tem parâmetros de query e não vale criar uma camada
de consulta no backend para uma biblioteca pessoal.

`POST /lists` passa a aceitar `gameIds` opcional (`gameListCreateSchema`), com
`addGames` em lote no repositório. O `PATCH` continua com o schema antigo, para não
aceitar um campo que ignoraria.

**5. Ordenação da biblioteca por data.** Título (padrão) preserva a ordem do servidor,
que já ordena por título — reordenar no cliente seria redundante. Início e conclusão
ordenam do mais recente para o mais antigo, com jogos sem data sempre no fim e título
como desempate.

**6. `apps/mobile` (Flutter) entra no escopo documentado.** O app existe, compila e é
usado; ignorá-lo na documentação é pior que registrá-lo. Ele ganha biblioteca
navegável e detalhe de jogo, o que contraria a letra do `mobile.md`
("não transformar o mobile em uma cópia reduzida do dashboard desktop"). O princípio
continua válido no espírito: o registro de sessão segue sendo o fluxo primário, em
poucos toques, e a biblioteca é consulta — não há edição de jogo no celular.

**7. Cache de leitura no mobile, espelhando o ADR-015.** O app já tinha fila de
escrita offline, mas nenhuma resposta GET era guardada, então offline ele falhava
seco com "Tentar novamente". `cached_responses` (sqflite, versão 2 do banco local,
sem dependência nova) guarda a última resposta de cada GET; `ApiClient.getCached`
tenta a rede e cai no cache apenas em erro de conexão — erro HTTP do servidor
continua aparecendo. O banner offline avisa que os dados podem estar defasados.

## Consequências

- Mudança na API pública: nova rota `GET /stats/timeline`; `POST /lists` aceita
  `gameIds`. Único consumidor é o frontend, atualizado junto.
- `games.created_at` passa a ser dado visível ao usuário ("adicionou à biblioteca"),
  não só auditoria.
- A detecção de missão concluída roda a cada `PATCH` que zera um jogo e lê a lista
  inteira de jogos. Custo aceitável numa biblioteca pessoal; se crescer, vira query.
- Conclusões de missão anteriores ao backfill, de missões que não estão completas
  hoje, não existem e não podem ser recuperadas.
- `docs/product/mobile.md` deixa de descrever só a PWA.
