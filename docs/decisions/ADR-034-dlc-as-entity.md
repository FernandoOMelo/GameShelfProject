# ADR-034: DLC como entidade própria

## Status

Aceito.

## Contexto

DLCs têm progresso, posse, horas e conquistas independentes do jogo base. Tratá-las
como campo do jogo (por exemplo, uma nota ou um contador) perdia isso e impedia
acompanhar "zerei o jogo, falta a DLC".

## Decisão

1. Tabela `dlcs` ligada ao jogo (`ON DELETE CASCADE`): nome, descrição, capa, data de
   lançamento, `owned`, `status` (`NOT_STARTED`, `PLAYING`, `COMPLETED`), horas
   estimadas e jogadas, e o vínculo opcional com um catálogo da RAWG.
2. Rotas `GET/POST /games/:id/dlcs` e `PATCH/DELETE /games/:id/dlcs/:dlcId`, mais a
   busca e o vínculo de candidatos da RAWG e as conquistas da DLC.
3. As horas da DLC não entram nas horas do jogo base, nem no total consolidado
   (ADR-027): são a medida de outra coisa.
4. Conquistas da DLC vêm ao vivo da RAWG pelo `rawgId`; não há espelho local nem
   desbloqueio pessoal.

## Consequências

- Migração `0027` (junto da franquia IGDB, ADR-033).
- Entra no backup (exportação e importação).
