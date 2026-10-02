# Planejamento

## Objetivo

Relacionar backlog com o tempo real disponível para jogar.

## Meta semanal

O usuário informa quantos minutos pretende jogar por semana.

Exemplo:

`360 minutos = 6 horas/semana`

## Previsão

Para um jogo:

`semanas = horas restantes / horas semanais`

Para a fila:

`semanas = horas restantes da fila / horas semanais`

## Regras

- meta semanal deve ser >= 0;
- se meta semanal for 0, não calcular previsão;
- previsões são aproximadas;
- não prometer data exata de conclusão.

## Exemplo

Jogo:

- estimativa pessoal: 35h;
- jogado: 28h;
- restante: 7h;
- meta: 6h/semana.

Resultado:

`~1,17 semana`

A UI pode apresentar isso como:

`aproximadamente 1–2 semanas`.

## Implementação inicial

A meta inicial é zero minutos por semana e é persistida localmente. O painel não apresenta previsão enquanto a meta for zero.

## Futuro

Poderá haver:

- metas mensais;
- períodos de férias;
- planejamento por franquia;
- simulação de diferentes metas semanais.
