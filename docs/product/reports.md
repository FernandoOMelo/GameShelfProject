# Relatórios

Área de análise detalhada (ADR-041), separada das Estatísticas: aqui o usuário
escolhe uma categoria, um período e filtros, e explora o resultado. Rota da tela:
`/relatorios`. O período (atalhos ou datas De/Até) vale para todas as categorias.

## Tempo de jogo (`GET /reports/playtime`)

Parâmetros: `from`, `to` (datas), `platformId`, `genreId`, `timezoneOffsetMinutes`.

- totais: horas, sessões, dias ativos, média por sessão e média mensal (sobre os
  meses com sessões);
- destaques: mês mais ativo, dia da semana mais ativo, horário (hora de início) mais
  frequente;
- horas por mês, por ano e por dia da semana; sessões por faixa de duração
  (até 30 min, 30 min–1 h, 1–2 h, 2–4 h, mais de 4 h);
- ranking com participação percentual por plataforma (sessões sem plataforma
  aparecem como "Sem plataforma"), gênero (um jogo com vários gêneros conta em cada
  um), desenvolvedora (top 10) e jogo (top 15);
- só sessões encerradas; o dia é o dia local de início.

## Conclusões (`GET /reports/completions`)

Parâmetros: `from`, `to`, `reference` (`MAIN`, `COMPLETIONIST`, `PERSONAL`), `sort`
(`DIFFERENCE_DESC`, `DIFFERENCE_ASC`, `PLAYED_DESC`, `TITLE`), `page`, `pageSize` (até 500).

- funil do estado atual: iniciados, zerados, pausados, abandonados, taxa de conclusão
  e de abandono sobre os iniciados;
- no período: jogos zerados, média de dias entre início e conclusão, conclusões por
  mês e por ano;
- estimativa versus realidade: para jogos zerados no período com a estimativa
  escolhida e horas registradas (sessões + retroativas); mostra quantos passaram e
  quantos ficaram abaixo, diferença média e tabela paginada, com exportação CSV;
- jogos pausados há mais tempo (última sessão ou última atualização).

## Jornadas e replays (`GET /reports/playthroughs`)

Parâmetros: `from`, `to` (data de início da jornada). Usa as jornadas, não o status
atual do jogo, então conclusões antigas de um jogo rejogado continuam contadas.
Jornadas só planejadas não contam como iniciadas.

- totais: jornadas iniciadas, jogos com jornadas, média por jogo, taxa de conclusão,
  replays, dias médios para zerar e intervalo médio entre a conclusão e a jornada seguinte;
- primeira jornada contra as seguintes: horas médias das jornadas zeradas com horas
  (sessões vinculadas à jornada);
- jornadas por plataforma, jogos com mais jornadas abandonadas e histórico completo
  dos jogos mais rejogados (plataforma, início, situação, dias, horas).

## Biblioteca e backlog (`GET /reports/backlog`)

Sem parâmetros: é um retrato do estado atual e o período não se aplica. Backlog são
os jogos com status Backlog, sem os arquivados.

- totais: jogos no backlog, nunca iniciados (sem data de início, sessões nem horas
  retroativas), idade média desde o cadastro, horas que faltam (estimativa pessoal,
  senão a da história principal; jogos sem estimativa são contados à parte) e jogos
  desejados contra jogos que você possui;
- envelhecimento: menos de 30 dias, 30–90 dias, 3–6 meses, 6 meses–1 ano, mais de 1 ano;
- backlog por ano de lançamento, gênero e plataforma (jogos e horas que faltam);
- os 10 jogos esperando há mais tempo.

## Conquistas (`GET /reports/achievements`)

Parâmetros: `from`, `to`, `timezoneOffsetMinutes`. Só existe com o espelho de
conquistas (Achievist) configurado. O período filtra os desbloqueios pelo dia local;
o progresso por jogo é o estado atual.

- no período: conquistas desbloqueadas, pontos, dias com desbloqueio, por mês, por
  plataforma, jogos com mais conquistas, caças mais longas (dias entre a primeira e a
  última conquista do jogo) e as mais raras (pela raridade informada pela fonte);
- estado atual: conclusão geral, jogos com conquistas, jogos com 100%, jogos mais
  perto de 100% (a partir de 50%, por menos conquistas faltando) e jogos completos;
- um jogo em várias plataformas soma as conquistas de cada associação.

## Comparativos (`GET /reports/comparison`)

Parâmetros: `aFrom`, `aTo`, `bFrom`, `bTo` (obrigatórios) e `timezoneOffsetMinutes`. A
tela traz atalhos (ano passado × este ano, mês passado × este mês) e datas livres; o
período global da tela não vale aqui.

Métricas lado a lado, com a variação de B em relação a A (vazia quando A é zero):
horas, sessões, dias com sessão, média por sessão, jogos zerados, jornadas iniciadas e
conquistas (só com o espelho de conquistas), mais o jogo mais jogado de cada período.
Cada métrica usa a definição do relatório de origem.

## Próximas etapas

Filtros salvos de relatório e exportação em PDF; migrar os cálculos para agregações
em SQL se o volume de dados crescer (ADR-041).
