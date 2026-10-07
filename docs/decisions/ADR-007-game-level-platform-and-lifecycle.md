# ADR-007: Plataforma e jornada no jogo

## Status

Aceita.

## Contexto

GameShelf é uma biblioteca pessoal. O usuário precisa registrar o jogo como a
entidade central, com a plataforma em que o possui ou joga, além do ciclo de
vida e das datas da sua jornada. Não há necessidade de manter cópias do mesmo
jogo por plataforma.

## Decisão

- Um jogo seleciona zero ou uma plataforma principal do catálogo.
- Posse, status, início e conclusão são atributos do jogo, independentes da
  plataforma selecionada.
- Sessões continuam sendo registros individuais vinculados ao jogo.
- A nota é única por jogo: 1 a 10 e 11 para “Jogo da Vida”.
- Relatórios anuais e mensais agrupam pela data de conclusão do jogo.
- A migração consolida cada associação antiga no jogo. Se havia mais de uma
  plataforma, mantém a associação com status mais ativo segundo a ordem
  `PLAYING`, `PAUSED`, `BACKLOG`, `QUEUED`, `COMPLETED`, `ABANDONED`; empates
  são resolvidos pelo identificador da plataforma. Depois remove a tabela de
  associações antiga.

## Consequências

O formulário passa a oferecer um seletor único de plataforma e mantém os
atributos pessoais no formulário do jogo. Plataformas descobertas em metadata
continuam sendo apenas informação do catálogo até que o usuário escolha uma.
