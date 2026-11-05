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

## Próximas etapas

Biblioteca e backlog (envelhecimento), conquistas e comparativos; filtros salvos e
exportação em PDF.
