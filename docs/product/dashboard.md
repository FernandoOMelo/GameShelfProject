# Dashboard

## Objetivo

Mostrar rapidamente a situação atual da biblioteca.

## Seção: Continuar jogando

Mostrar:

- jogo atual;
- capa;
- progresso;
- horas jogadas;
- estimativa pessoal;
- última sessão;
- local onde parou.

## Seção: Fila

Mostrar os próximos jogos da fila.

## Seção: Estatísticas

Indicadores mínimos:

- quantidade de jogos;
- jogos concluídos;
- jogos em andamento;
- jogos abandonados;
- horas jogadas;
- horas estimadas do backlog;
- horas disponíveis por semana.

## Cálculos

### Horas jogadas

Soma das sessões.

### Horas restantes

Quando houver estimativa pessoal:

`max(estimativa pessoal - horas jogadas, 0)`

Caso contrário, usar a estimativa principal.

### Semanas restantes

Quando houver meta semanal maior que zero:

`horas restantes / horas semanais`

O resultado é aproximado e deve ser apresentado como estimativa.

## Não fazer no MVP

Não criar uma "pontuação de jogador" ou ranking de eficiência.

## Implementação inicial

`GET /dashboard` agrega os jogos, sessões finalizadas, fila e meta semanal. A meta é configurada em minutos por semana em `/planning/settings` e começa em zero. O jogo atual é o jogo em status `PLAYING` com a sessão mais recente; se não houver sessão, usa a última atualização do jogo. O painel mostra até cinco jogos na prévia da fila e destaca os três primeiros.
