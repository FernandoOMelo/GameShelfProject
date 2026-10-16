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

## Próximo jogo

`GET /backlog/suggestions` (aceita `timezoneOffsetMinutes`) devolve até 3 jogos com pontuação e os motivos. A tela da Fila
tem o botão "Me ajuda a escolher", que mostra a melhor opção e permite ver as outras. Sem IA: a regra é
determinística e soma pontos.

Candidatos: jogos possuídos, não arquivados, com status Na biblioteca ou Pausado, e que
não estejam marcados como "não sugerir". Essa marcação vence até a primeira posição da
fila, e não esconde o jogo da biblioteca nem dos relatórios (ADR-017).

| Critério | Pontos |
| --- | --- |
| Prioridade alta / normal / baixa | 30 / 15 / 0 |
| Está na fila | 40 − 3 por posição (a partir da 9ª posição, fixo em 16) |
| Faltam até 5 h (estimativa pessoal, ou principal, menos o já jogado) | +10 |
| Faltam até 15 h | +5 |
| Pausado | +8 |
| Esperando sem sessão (desde a última sessão, o início ou o cadastro) | +2 a cada 30 dias, máximo +10 |

Empates são decididos pelo título. As constantes ficam em `modules/backlog/suggestions.ts`.

## Fila a partir de uma lista

`POST /queue/from-list` (`{ listId }`) enfileira ao final os jogos elegíveis de uma lista, em ordem
alfabética, e devolve `added`, `skipped` e a fila atualizada. Na tela de Listas, o botão "Adicionar à fila"
faz isso. Elegível: possuído, não arquivado, não zerado nem abandonado e ainda fora da fila. Detalhes e
motivo de não termos múltiplas filas em ADR-013.

## Futuro

Múltiplas filas **não** serão criadas por ora (ADR-013). Os temas abaixo continuam sendo
listas pessoais, que podem ser enfileiradas:

- Principal;
- Curta;
- Coop;
- RPG;
- Próxima franquia.


## Implementação inicial

O MVP possui uma fila única persistida localmente. A posição é independente do campo prioridade e do estado do jogo. A fila aceita apenas jogos possuídos e não arquivados, zerados ou abandonados; excluir um jogo remove sua entrada por chave estrangeira em cascata.
