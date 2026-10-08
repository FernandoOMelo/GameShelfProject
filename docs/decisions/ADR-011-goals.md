# ADR-011: metas anuais e mensais

## Status

Aceito.

## Contexto

O roadmap da Fase 8 inclui metas (por exemplo "zerar 12 jogos em 2026" ou "40 h
por mês"). A missão principal (ADR-010) é um objetivo único ligado a uma lista; as
metas são diferentes: têm período e alvo numérico, e várias podem coexistir.

## Decisão

- Tabela `goals` com `kind` (`COMPLETED_GAMES` ou `PLAYED_HOURS`), `period`
  (`YEAR` ou `MONTH`), `year`, `month` e `target` inteiro positivo. Para metas
  anuais `month` é 0 (evita índice único com `NULL`); constraints no banco
  garantem a combinação período/mês.
- Uma meta por combinação `kind + period + year + month` (índice único). Criar
  outra igual retorna 409; para mudar o alvo usa-se `PATCH`.
- O progresso **não é gravado**: é calculado a cada leitura por função pura
  (`buildGoalProgress`), a partir de jogos e sessões.
  - Zerados: jogos com `completedAt` no período, inclusive arquivados e jogos que
    voltaram a Jogando (mesma regra de `periodStats.gamesCompleted` do painel).
  - Horas: `periodStats.playedHours` do painel para o mesmo período, ou seja,
    sessões recortadas no período local mais horas retroativas distribuídas.
- Dias e meses seguem o fuso do cliente (`timezoneOffsetMinutes`), como o painel.
- A resposta traz também `elapsedPercent` (quanto do período já passou) e
  `onTrack` (progresso >= tempo decorrido), para o painel indicar o ritmo sem
  duplicar a regra no frontend.
- Metas passadas permanecem como histórico; excluir é manual.

## Consequências

- Reaproveita `buildDashboard`, então qualquer ajuste na contagem do painel vale
  para as metas.
- Sem histórico de alvo: alterar o alvo reescreve o passado da meta.
