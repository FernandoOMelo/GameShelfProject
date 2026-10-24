# Painel

## Objetivo

O Painel é a tela inicial do GameShelf. Ele apresenta a situação atual da
biblioteca, ações para os jogos em andamento e estatísticas de atividade.
Configuração — cadastro de plataformas, sincronização com o Achievist, backup
e meta semanal — vive na tela Configurações, não aqui (ADR-029); a meta
semanal editada lá continua alimentando a previsão do backlog deste painel.

## Jogando agora

Exibe todos os jogos não arquivados em `PLAYING`, ordenados pela atividade mais
recente. Cada card pode abrir os detalhes, iniciar/continuar uma sessão, encerrar
uma sessão ativa ou pausar o jogo. O timer da sessão ativa atualiza ao vivo.

## Período

Opções: últimos 7 dias, mês atual, ano atual, intervalo personalizado e todo o
período. Mês atual é o padrão; a opção escolhida fica salva no navegador. Os
limites de data seguem o fuso do navegador.

## Indicadores do período

- horas jogadas: minutos de sessões encerradas que caem dentro do período;
- sessões: sessões iniciadas dentro do período;
- jogos jogados: títulos únicos com uma sessão que cruza o período;
- jogos zerados: títulos únicos com `completedAt` dentro do período.

Sessões abertas aparecem no card e contam como sessão/jogo quando iniciadas no
período, mas não entram nas horas fechadas. Uma sessão que cruza o limite
contribui apenas com os minutos dentro do intervalo.

## Indicadores navegáveis

Alguns indicadores levam à Biblioteca já filtrada, limpando os outros filtros:

- jogos zerados no período → status `COMPLETED`;
- cada barra de "zerados por ano" → status `COMPLETED` no ano da barra;
- horas restantes no backlog → status `BACKLOG`;
- "em andamento" e cada item da legenda de "biblioteca por estado" → o status
  correspondente.

O período do painel não é aplicado ao filtro: a Biblioteca filtra por status e ano
de conclusão, que são os filtros que ela tem. "Parados há mais tempo" não navega,
porque não existe filtro equivalente. Não há link direto nem botão voltar — a troca
é de tela, não de rota. Ver ADR-016.

## Fotografia atual

O Painel também mostra a quantidade total de jogos não arquivados, estados
atuais, horas jogadas em todo o histórico, horas estimadas restantes dos jogos
possuídos e a previsão da fila com base na meta semanal. Jogos arquivados ficam
fora dessas visões atuais, mas seus registros continuam contando em relatórios
históricos quando aplicável.

O sistema não apresenta histórico de estados abandonados: esse dado exigiria
persistir eventos de transição.

## Previsão do backlog

Cartão no Painel (`backlogForecast` em `GET /dashboard`), independente do período:

- **meses até zerar o backlog** = horas restantes do backlog / horas semanais da
  meta, em semanas e em meses (1 mês = 52/12 semanas). Sem meta semanal não há
  previsão. O backlog segue a definição já usada em `backlogRemainingHours`: jogos
  não arquivados, na biblioteca, que não estão zerados nem abandonados;
- jogos desse conjunto sem estimativa de tempo não entram na conta e são contados
  à parte (`gamesWithoutEstimate`);
- **parados há mais tempo**: jogos Jogando ou Pausados (não arquivados) sem
  atividade há 30 dias ou mais, até 5, do mais antigo ao mais recente. A última
  atividade é a sessão mais recente, ou a data de início do jogo, ou a última
  atualização do cadastro. Servem de lista de candidatos a retomar, pausar ou abandonar.

## Metas

Cartão no Painel para metas anuais ou mensais de **jogos zerados** ou **horas jogadas**
(ADR-011). O progresso é calculado a cada leitura, não gravado.

- `GET /goals?timezoneOffsetMinutes=` lista as metas, da mais recente à mais antiga, com
  `current`, `percent` (máximo 100), `elapsedPercent` (quanto do período já passou),
  `achieved` e `onTrack` (progresso >= tempo decorrido, ou meta atingida);
- `POST /goals` cria (`kind`, `period`, `year`, `month` só para metas mensais, `target`);
  uma meta por tipo e período, duplicata retorna 409;
- `PATCH /goals/:id` altera o alvo e `DELETE /goals/:id` exclui;
- zerados: jogos com data de conclusão no período (inclui arquivados); horas: mesmo
  recorte do indicador de horas do painel (sessões no período local mais horas retroativas).

## Missão principal

Cartão com um objetivo de longo prazo ligado a uma lista pessoal, com contagem de
jogos zerados e barra de progresso. Detalhes em [Estatísticas](stats.md).

## Visual

Indicadores do período em destaque, cartões de jogos em andamento com capa e
barra de progresso, barra empilhada com a biblioteca por estado (cores fixas por
estado), gráfico de zerados por ano e o resumo geral.

## API

O resumo atual também apresenta contagens por estado: Desejados, Na biblioteca,
Jogando, Pausados, Zerados, Abandonados e Arquivados. Cada card de jogo em
andamento oferece ações rápidas para iniciar ou encerrar sessão, pausar, zerar,
abandonar ou abrir os detalhes.

`GET /dashboard` aceita `from` e `to` no formato `YYYY-MM-DD` e
`timezoneOffsetMinutes` para delimitar o período local. Sem datas, retorna o
histórico completo. A resposta inclui `playingGames`, `period` e `periodStats`,
além das estatísticas gerais e prévia da fila.
