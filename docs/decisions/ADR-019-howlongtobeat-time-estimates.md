# ADR-019: Estimativas de tempo do HowLongToBeat

## Status

Aceito.

## Contexto

O roadmap carregava uma pendência antiga (Fase 9, item 12): importar estimativas de
duração do **HowLongToBeat** (HLTB) para preencher `estimatedMainHours` e
`estimatedCompletionistHours` sem digitação manual. O ADR-003 já define que essas
estimativas externas convivem com a `personalEstimatedHours`, que tem precedência
no planejamento.

A biblioteca `howlongtobeat-core` é usada como referência no roadmap, mas está
quebrada contra o site atual. O HLTB **não oferece API pública**; o site é um app
Next.js cuja API interna muda de caminho e de credencial sem aviso
(`/api/search` → `/api/find` → `/api/bleed` → `/api/search/site`). Um endpoint fixo
quebraria na próxima rotação.

## Decisão

**1. Integração como provedor próprio, não como metadata de jogo.** O HLTB não traz
capa, gênero ou franquia: traz apenas tempos. Modelá-lo como `GameMetadataProvider`
misturaria candidatos de origens diferentes no mesmo seletor e ainda exigiria casar
IGDB ↔ HLTB por nome. Fica um provedor dedicado, `GameTimeEstimateProvider`, e uma
rota dedicada `GET /metadata/time-estimates?query=`, no mesmo padrão de
infraestrutura isolada do IGDB (`docs/architecture/architecture.md`).

**2. Descoberta dinâmica do endpoint, sem fallback fixo.** O cliente busca a página
inicial, lê o `_buildManifest.js` do Next.js e procura o par `{path}` + `{path}/init`;
se o manifesto não enumerar as rotas, varre os chunks JavaScript. O caminho de busca
é o que possui um handshake `/init` correspondente.

**3. Handshake de autenticação com cache e retry.** Um `GET {searchUrl}/init?t=...`
devolve `token` e, às vezes, `hpKey`/`hpVal`. O token é cacheado por 5 minutos.
Quando ambos existem, `hpKey`/`hpVal` vão como cabeçalhos (`x-hp-key`, `x-hp-val`) e
como um campo do corpo nomeado por `hpKey`. Em qualquer falha, o cliente descarta
endpoint e token e tenta **uma vez** de novo — o suficiente para atravessar uma
rotação sem reiniciar a API.

**4. Sem credenciais, sempre ligado; falha isolada.** Diferente do IGDB, não há
chaves. O provedor é registrado sempre e a rota é opt-in na interface. Erros de
rede, bloqueio do Cloudflare ou rotação não tratada viram `502` e não afetam a
biblioteca local nem o restante da API. Nada é gravado automaticamente: o usuário
escolhe um candidato e revisa antes de salvar, como na busca IGDB.

**5. Três estimativas continuam sendo três.** `comp_main` → `estimatedMainHours` e
`comp_100` → `estimatedCompletionistHours`. `comp_plus` ("história principal +
extras") aparece no resultado como referência, mas **não** ganha coluna nova: o
ADR-003 define exatamente três valores, e criar um quarto campo seria mudança de
domínio sem necessidade demonstrada.

## Consequências

- Nova superfície pública: `GET /metadata/time-estimates` e o contrato
  `gameTimeEstimateSchema` / `GameTimeEstimate` em `packages/contracts`. Consumidores
  são o frontend web (formulário de jogo) e, futuramente, o app Flutter.
- Nenhuma migration: os campos de estimativa já existem em `games`.
- A integração depende de um protocolo não documentado que pode mudar. A dívida é
  assumida: o tratamento de erro foi desenhado para que essa quebra seja silenciosa
  para o restante do sistema e visível apenas na ação de buscar tempos.
- O casamento é por nome: o usuário escolhe entre os candidatos retornados, então
  nomes parecidos (remaster, DLC, edição) não são resolvidos automaticamente.
- `profile_steam`, o endpoint de importação da biblioteca Steam e a verificação por
  Steam App ID existem no site, mas ficam fora do escopo (a integração com Steam
  está explicitamente descartada em `docs/product/next-phase.md`).
