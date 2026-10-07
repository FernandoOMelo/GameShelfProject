# ADR-010: classificação de jogos, estatísticas e missão principal

## Status

Aceito.

## Contexto

Uma planilha de controle de jogos zerados usada como referência apresenta
indicadores que o GameShelf ainda não calculava: dificuldade, tipo, condição de
zeramento, jogo do ano, favoritos, distribuição de notas e totais por gênero,
tipo e plataforma. A planilha serviu apenas de inspiração; não há importação.

## Decisão

- Cada jogo ganha cinco campos: `difficulty` (enum `C`, `B`, `A`, `AA`, `AAA`,
  opcional), `gameType` (texto livre, um por jogo), `completionCondition` (texto
  livre), `favorite` e `gameOfYear` (booleanos).
- O tipo é texto livre, comparado sem diferenciar maiúsculas, e não uma tabela de
  catálogo. Se surgir necessidade de renomear tipos em lote, vira catálogo depois.
- Jogo do ano exige `completedAt` e é único por ano de conclusão: marcar um jogo
  desmarca o anterior do mesmo ano (repositório, dentro da transação). A regra de
  exigir a data também é validada no contrato e por uma constraint no banco.
- `GET /stats` calcula os indicadores em uma função pura (`buildStats`). As
  estatísticas consideram jogos com status Zerado, inclusive arquivados. As horas
  de cada jogo (sessões fechadas + horas retroativas) contam no ano da conclusão.
  A distribuição de notas considera qualquer jogo com nota.
- Rankings de gênero e tipo usam a média das notas dos jogos zerados, com empate
  decidido pela quantidade de jogos. Favoritos são ordenados por nota (limite 10).
- A missão principal é um registro único (`main_challenge`) que aponta para uma
  lista pessoal. O progresso é jogos zerados / jogos da lista, calculado em
  `buildChallengeProgress`. Excluir a lista remove a missão.
- Fora do escopo: importação de planilha e filtros por período nas estatísticas.

## Consequências

A migration `0011` adiciona o enum, as colunas e a tabela. Nenhum dado existente
muda: os campos novos começam vazios. A tela Estatísticas e o Painel consomem os
novos endpoints `/stats` e `/challenge`.
