# Listas de jogos

## Objetivo

Permitir que o usuário organize o mesmo jogo em listas pessoais nomeadas, sem
alterar seu status, sua fila de planejamento ou seus registros de sessão.

## Regras

- listas possuem nome único, obrigatório, de até 100 caracteres;
- cada lista pode conter vários jogos;
- um jogo pode aparecer em várias listas, mas apenas uma vez em cada lista;
- remover um jogo da lista não remove o jogo da biblioteca;
- excluir uma lista não remove seus jogos;
- excluir um jogo da biblioteca remove suas associações às listas.

## Operações

Criar, renomear e excluir listas; adicionar e remover jogos; abrir um jogo a
partir de uma lista para consultar seus detalhes.

A fila de planejamento permanece separada, pois representa uma ordem de
execução e alimenta as previsões do painel.

## Usar uma lista como fila

Na lista selecionada, "Adicionar à fila" coloca ao final da fila os jogos que podem entrar nela,
em ordem alfabética. A lista não é alterada. Ver ADR-013.

## Filtrar a biblioteca por lista

A biblioteca tem um filtro "Lista" que mostra apenas os jogos da lista escolhida,
combinável com os demais filtros. É leitura: não altera a lista nem os jogos.

## Criar uma lista a partir do filtro

Com a biblioteca filtrada, "Criar lista com estes jogos" pede um nome e cria uma lista
já contendo os jogos visíveis. Nome repetido é recusado, como em qualquer criação de
lista. Ver ADR-016.
