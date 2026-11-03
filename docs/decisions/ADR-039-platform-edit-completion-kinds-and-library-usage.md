# ADR-039: trocar plataforma, tipos de conquista especial e uso na biblioteca

## Status

Aceita. Complementa os ADR-028, ADR-038 e ADR-027.

## Decisão

### Alterar a plataforma de uma associação
O menu da associação ganha "Alterar plataforma" (web e app): `PATCH` com
`platformId` e `edition`. Tempo importado, conquistas e origem Achievist ficam
com a associação. Se ela é a principal, `games.platform_id` acompanha. Sessões
já registradas mantêm a plataforma antiga (não há como saber quais pertenciam à
associação corrigida).

### Uma aba de conquistas por associação, mesmo vazia
Toda associação com fonte externa gera um grupo, mesmo sem conquistas
espelhadas, com botão "Atualizar conquistas" (`?refresh=true`). Duas associações
com o mesmo nome (dois "PlayStation 5") continuam sendo abas distintas,
desambiguadas pela conta ou pela ordem.

### Platina, jogo concluído e especiais
`specialKind` por conquista: `PLATINUM` (nome de platina ou "todas as
conquistas"), `COMPLETION` (terminar história/campanha, ex.: "You completed the
game on Normal") e `SPECIAL` (dificuldade máxima, todos os finais...). Nessa
ordem de precedência. `isCompletionTrophy` passa a valer só para `COMPLETION`;
`platinumTrophyId` é novo. A heurística é de texto (pt/en): não depende de o
Achievist informar o tipo do troféu.

Ao ler as conquistas, se `completionCondition` do jogo está vazia e existe uma
conquista `COMPLETION` visível, ela vira "Nome: descrição". Nunca sobrescreve
texto existente.

### Tempo e conquistas na biblioteca
`GET /games/usage` devolve, por jogo, o tempo consolidado (ADR-027) e as
conquistas somadas das associações. Fica fora de `gameSchema` por ser derivado
(o backup guarda só dados). Os cartões mostram os dois e a ordenação ganha
`HOURS_DESC`.

### DLC vinculada
O cartão da DLC usa capa, horas e conquistas do jogo vinculado.
