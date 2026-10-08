# ADR-013: enfileirar uma lista em vez de múltiplas filas

## Status

Aceito.

## Contexto

O roadmap previa "múltiplas filas" (Principal, Curta, Coop, RPG, Próxima
franquia). Antes de criar uma entidade nova, avaliamos o que as listas pessoais
(ADR-008) já cobrem: agrupar jogos por tema ou intenção, sem ordem, sem efeito na
fila nem nas previsões.

O que uma fila acrescenta às listas é **ordem explícita** e a **previsão do
backlog** (horas na fila / ritmo semanal). Várias filas simultâneas obrigariam a
decidir qual alimenta a previsão, o painel e as sugestões, sem uma necessidade real
observada no uso.

## Decisão

- **Não** criar múltiplas filas. A fila continua única (ADR sobre fila do MVP).
- Os temas ("Curta", "Coop", "RPG") continuam sendo listas. Para usar uma lista
  como plano de jogo, `POST /queue/from-list` enfileira ao final da fila os jogos
  elegíveis da lista, em ordem alfabética do título; depois o usuário reordena.
- Elegível = mesma regra da fila: possuído, não arquivado, não zerado e não
  abandonado. Jogos já na fila e inelegíveis são ignorados e contados em `skipped`.
- A lista não é alterada nem vinculada à fila: é uma ação pontual.

## Consequências

- Nenhuma tabela nova nem mudança nas previsões, no painel ou nas sugestões.
- Reavaliar múltiplas filas apenas se o uso mostrar a necessidade de ordens
  independentes e simultâneas; nesse caso, será um novo ADR.
