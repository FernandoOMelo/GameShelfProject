# ADR-031 — Catálogo de plataformas e endpoint de sumários

## Status

Aceito

## Contexto

As plataformas eram entidades livres criadas pelo usuário, sem nenhuma
informação de apresentação (ícone, família). O frontend precisava derivar
a cor e o rótulo do badge somente pelo nome (`platformBadge(name)`), o que
era frágil e sem ícone visual.

Também não havia forma de obter uma visão agregada da biblioteca por
plataforma (total de jogos, horas, conquistas) sem montar vários queries
diferentes.

## Decisão

### 1. Chaves de catálogo

A tabela `platforms` recebe duas colunas opcionais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `catalog_key` | `text` | Variante específica (ex.: `ps5`, `switch`) |
| `icon_key` | `text` | Família do ícone (ex.: `playstation`, `nintendo`) |

A função `platformPresentation(name)` em
`apps/api/src/modules/platforms/catalog.ts` mapeia ~18 nomes canônicos para
`catalogKey` e `iconKey`. Ela é chamada automaticamente ao criar uma
plataforma via `POST /platforms`.

A migration `0024_platform_catalog_keys.sql` popula as linhas existentes via
`UPDATE … CASE`.

### 2. Ícones SVG na UI

O componente `PlatformIcon({ iconKey })` em
`apps/web/src/pages/platform-icons.tsx` renderiza formas geométricas
abstratas (sem copiar marcas proprietárias) para cada família:
`playstation`, `xbox`, `nintendo`, `steam`, `pc`, `epic`, `gog`, `retro`,
`mobile` e `generic` (fallback).

Os badges de plataforma nos cards da biblioteca e no detalhe do jogo exibem
`<PlatformIcon iconKey={...} />` antes do label.

### 3. Endpoint de sumários

`GET /platforms/summaries` retorna, para cada plataforma com pelo menos
um jogo:

```json
{
  "platform": { "id": "...", "name": "...", "catalogKey": "ps5", "iconKey": "playstation", "parentId": null },
  "gameCount": 12,
  "completedCount": 8,
  "dominatedCount": 2,
  "localPlayedMinutes": 18000,
  "externalPlayedMinutes": 19800,
  "achievementsUnlocked": 340,
  "achievementsTotal": 450,
  "recentGameCovers": ["/media/…", "/media/…", "/media/…", "/media/…"]
}
```

O cálculo usa uma única query com CTEs para eficiência. "Dominado" significa
todos os troféus desbloqueados (`total > 0 AND unlocked === total`).

## Consequências

- Novos campos `catalogKey` e `iconKey` em `platformSchema` são opcionais e
  nullable; clientes anteriores não quebram.
- Plataformas criadas antes da migration só têm as chaves se o nome coincidir
  com o catálogo, ou se o usuário as renomear (a lógica só roda no `create`).
- O endpoint de sumários é somente-leitura; não afeta operações de escrita.
- A UI da tela de Estatísticas consome os sumários para exibir cards de
  plataforma com ícone, contagens e progresso de conquistas.
