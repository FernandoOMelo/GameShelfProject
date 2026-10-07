# Backlog e Fila

## Conceito

Backlog é o conjunto de jogos que o usuário possui e ainda não concluiu.

Fila é uma ordenação explícita de jogos que o usuário pretende jogar.

## Fila

Cada item possui:

- jogo;
- posição;
- data de entrada.

## Operações

- adicionar à fila;
- remover;
- mover para cima;
- mover para baixo;
- reordenar;
- visualizar.

## Regras

- um jogo não deve aparecer duas vezes na mesma fila;
- a posição deve ser consistente;
- apenas jogos possuídos podem entrar na fila;
- jogos arquivados, zerados ou abandonados não podem entrar na fila;
- mudar posse, arquivar ou concluir um jogo remove sua entrada da fila.

## Prioridade

Prioridade e posição de fila são conceitos diferentes.

Exemplo:

Um jogo pode possuir prioridade alta, mas estar em terceira posição porque existem dois jogos que o usuário deseja terminar primeiro.

## Futuro

A fila poderá possuir múltiplas listas, como:

- Principal;
- Curta;
- Coop;
- RPG;
- Próxima franquia.

Isso não faz parte do MVP.

## Implementação inicial

O MVP possui uma fila única persistida localmente. A posição é independente do campo prioridade e do estado do jogo. A fila aceita apenas jogos possuídos e não arquivados, zerados ou abandonados; excluir um jogo remove sua entrada por chave estrangeira em cascata.
