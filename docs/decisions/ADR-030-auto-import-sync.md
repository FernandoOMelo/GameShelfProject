# ADR-030 — Importação automática de tempo e conquistas na sincronização

## Status

Aceito

## Contexto

A sincronização com o Achievist (`POST /integrations/sync`) importa jogos e
associações de plataforma. Antes deste ADR, tempo externo e conquistas de jogos
**novos** criados durante a sincronização precisavam de uma segunda chamada
explícita para serem registrados.

Com a expansão da integração (ADR-026 e ADR-028), o fluxo ficou inconsistente:
um jogo recém-importado aparecia sem tempo nem conquistas até o usuário
sincronizar novamente.

## Decisão

A sincronização com o Achievist importa automaticamente, em uma única passagem:

1. **Tempo de plataforma** — para cada jogo novo ou existente com dado de tempo
   externo no payload, o tempo é registrado via `setExternalPlaytime` (mesma
   lógica do endpoint avulso).
2. **Conquistas** — para cada jogo com dados de conquistas no payload, as
   conquistas são registradas via `importAchievements` (mesma lógica do endpoint
   avulso, ADR-028).

Nenhum novo endpoint ou tabela é criado; apenas a ordem de operações dentro de
`sync.ts` é estendida.

## Consequências

- Uma única chamada a `POST /integrations/sync` traz jogo, tempo e conquistas em
  sincronia, sem precisar de um segundo disparo.
- O campo `updatedGames` da resposta já conta os jogos cujo tempo ou conquistas
  foram atualizados.
- O custo por sincronização aumenta ligeiramente, mas o sync já era uma operação
  pontual (não é chamada em loop).
- Testes do módulo de sync precisam incluir `listSummaries: async () => []` no
  mock do repositório de plataformas.
