# ADR-006: Posse e jornada por plataforma

## Status

Substituída por [ADR-007](ADR-007-game-level-platform-and-lifecycle.md).

## Contexto

Uma entrada de jogo representa o título do catálogo, mas posse e progresso do
usuário podem diferir entre plataformas. O estado global não permite registrar
que o título foi concluído em uma plataforma e permanece na fila em outra. A
biblioteca também precisa registrar conclusões retroativas, notas do título e
relatórios sem duplicar jogos concluídos em múltiplas plataformas.

## Decisão

- Cada associação jogo-plataforma armazena posse, status e datas de início e
  conclusão.
- Posse é independente do status.
- A nota de 1 a 10, incluindo 11 para “Jogo da Vida”, pertence ao jogo e é
  compartilhada entre plataformas.
- Relatórios agrupam por data de conclusão e contam IDs de jogos únicos em cada
  ano e mês.
- Datas ausentes em registros antigos permanecem ausentes; a migração não
  inventa datas.
- Associações antigas recebem o status que o jogo possuía antes da migração e
  posse falsa, pois a disponibilidade de uma plataforma não comprova posse.

## Consequências

A biblioteca continua podendo filtrar e exibir um status agregado por jogo, mas
os detalhes mantêm o status específico de cada plataforma. O estado da fila de
planejamento continua sendo uma lista de jogos; o status `QUEUED` por plataforma
é independente dessa lista.
