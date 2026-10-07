# ADR-008: Listas pessoais de jogos

## Status

Aceita.

## Contexto

A fila atual é única, ordenada e usada para previsão de backlog. O usuário
também quer separar jogos por temas ou intenções sem mudar o estado do jogo.

## Decisão

- Adicionar listas nomeadas e reutilizáveis, independentes da fila de
  planejamento.
- Permitir que um jogo apareça em várias listas, sem duplicação dentro de cada
  lista.
- Criar, renomear e excluir listas, além de adicionar e remover jogos.
- A exclusão de lista remove apenas suas associações; excluir um jogo remove
  suas associações às listas por cascata.

## Consequências

As listas não afetam status, estimativas, fila ou relatórios do jogo. A nova
entidade fica persistida nas tabelas `game_lists` e `game_list_entries`.
