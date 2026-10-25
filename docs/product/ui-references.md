# Pesquisa de layouts — referências para modernizar a UI

Este documento reúne padrões de layout de sistemas parecidos com o GameShelf
(bibliotecas de jogos, trackers de mídia e launchers) e traduz cada padrão em
recomendações aplicáveis ao nosso stack atual, sem copiar interfaces
proprietárias (ver [Diretrizes de UI](ui.md)).

Não é uma proposta fechada de redesign: é a base de referência para priorizar
mudanças. Decisões relevantes devem virar ADR.

## Objetivo

Responder "quais layouts já resolvem os problemas que o GameShelf tem?", para
guiar a modernização da UI com decisões embasadas em produtos maduros.

## Ponto de partida (estado atual do GameShelf)

- Shell centralizado de `1120px` com **nav horizontal** no topo e 6 seções:
  Biblioteca, Fila, Listas, Painel, Atividade, Estatísticas.
- Tema escuro, acento dourado (`#d9b984`), fundo `#101318`, títulos em serifa
  (Georgia) e corpo em Inter.
- Estilos em um único `apps/web/src/styles.css` com classes escritas à mão;
  Tailwind v4 importado mas pouco usado.
- `packages/ui` contém apenas um `Button`. O stack documentado em `AGENTS.md`
  menciona shadcn/ui, mas **não há shadcn/ui instalado** (nem `components.json`,
  nem `cn()`/`clsx`).
- `apps/mobile` é um app Flutter que consome a mesma API.

Esses pontos definem o que é barato modernizar (casca, navegação, biblioteca,
detalhe) e o que exige uma decisão de design system.

## Método

Análise de produtos equivalentes (por função, não por estética) e de padrões de
layout documentados por ferramentas de UI atuais. Fontes listadas no fim.

## Panorama das referências

| Sistema | Categoria | O que pegar dele |
| --- | --- | --- |
| **Backloggd** | Tracker web de coleção | Grade de capas, página de jogo em coluna única com controles de log **sticky**, diário por data |
| **Letterboxd** | Tracker/diário de mídia | Poster grid, hover reveal, diário como objeto social, calendário de atividade |
| **Playnite** | Launcher/library manager desktop | Shell com sidebar + topbar + painel de filtros ("explorer"); modos Grid/List/Details |
| **Steam (2023)** | Launcher/library | Shelves/collections, Library Home com atividade, foco em "o que jogar depois" |
| **GOG Galaxy 2.0** | Launcher multi-plataforma | Biblioteca unificada, filtros/tags, **views salvas** e bookmarks |
| **HowLongToBeat** | Tracker de tempo de jogo | Três buckets de duração, quick add, stats por jogo |
| **Backlogr** | Tracker mobile | Tab bar inferior, temas, coleção como grade |
| **shadcn/ui + Bento** | Padrões de layout (não produto) | Sidebar colapsável, KPI cards, bento grid, charts |

### Referência: Trophies Hunter (screenshots fornecidos pelo usuário)

As imagens mostram um perfil com resumo no topo e áreas separadas para jogos,
conquistas, coleções, sessões, contas e estatísticas. A biblioteca usa cards
largos com arte de fundo, capa, progresso e plataforma; estatísticas e
conquistas usam painéis laterais, gráficos e atividade em calendário.

**O que vale adaptar ao GameShelf:**

- Cards de jogo mais visuais, com capa/arte, status e progresso legível; manter
  ações rápidas acessíveis por teclado e toque.
- Resumo de biblioteca e tempo investido como indicadores navegáveis, apoiados
  pelos dados que já existem no painel e nas estatísticas.
- Atividade recente e heatmap como formas de explorar sessões e conquistas;
  reaproveitar as telas atuais em vez de duplicar navegação ou métricas.
- Contas externas com plataforma, estado de sincronização e jogos recentes,
  alinhado à integração existente com Achievist.

**Não importar sem suporte de produto/dados:** pontuação/ranking global,
raridade comparada entre usuários, perfil público, streaks competitivos ou
estimativas de conclusão de DLC. GameShelf é pessoal e self-hosted; essas
métricas exigiriam fontes e semântica próprias. O estilo escuro e os cards de
fundo servem de inspiração, não como skin a copiar.

Sobre a conexão PSN por nick: serviços desse tipo podem resolver um Online ID
público para um identificador interno e consultar dados de troféus expostos para
perfis públicos, usando endpoints não oficiais. Isso não equivale a autenticar
a conta. Perfil privado/oculto e dados como tempo de jogo podem não estar
disponíveis; não devemos prometer horas ou atividade só com o nick. O GameShelf
continua recebendo dados externos via Achievist, conforme a
[ADR-024](../decisions/ADR-024-achievist-as-the-only-external-source.md).

## Padrões de layout, por área

### 1. Casca da aplicação (app shell) e navegação

**Referência.** Playnite separa **sidebar** (troca de views), **top panel**
(ações), **explorer** (filtro rápido) e **library panel** — cada função em seu
lugar. Os *blocks* de dashboard do shadcn/ui usam o mesmo modelo: sidebar
colapsável + header + conteúdo. Trackers web (Backloggd, Letterboxd) tendem a
manter nav simples no topo porque têm poucas seções e forte peso social.

**Recomendação.** Migrar a nav horizontal para uma **sidebar colapsável** no
desktop, com as 6 seções atuais agrupadas por intenção:

- *Coleção*: Biblioteca, Listas, Fila
- *Análise*: Painel, Estatísticas, Atividade

A sidebar absorve também o que hoje são filtros soltos (views salvas, ver §8).
Ganhos: espaço vertical para grades, lugar natural para views salvas e atalho de
"adicionar jogo". No mobile, tab bar/inferior ou drawer.

Referência direta de implementação: `SidebarProvider`/`Sidebar` (shadcn/ui),
que já é compatível com o Tailwind v4 em uso.

### 2. Biblioteca (coleção)

**Referência.** O poster grid do Letterboxd é o padrão dominante: `auto-fill`
de ~110px, `aspect-ratio` de capa, `hover` com leve `scale` e overlay de
detalhes. Steam e Playnite oferecem **modos alternáveis** (Grid / List /
Details), e GOG usa grade com filtros persistentes. Backloggd mantém grade com
controles de log sobrepostos.

**Recomendação.**

- Manter a **grade de capas** como modo padrão (já é a linguagem do produto) e
  adicionar um **alternador de densidade** (Grade densa / Grade confortável /
  Lista). Isso reaproveita o `Game` já existente e ajuda bibliotecas grandes.
- **Hover/focus reveal** no card: título, status, horas jogadas e ações
  rápidas (continuar sessão, editar). Acessível via `:focus-visible`, não só
  `:hover`.
- Barra de filtros **sticky** no topo do conteúdo, com contagem de resultados e
  botão de limpar. Hoje os filtros vivem num bloco `library-tools` que rola
  junto com a página.

### 3. Detalhe do jogo

**Referência.** O redesign da página de jogo do Backloggd foi explícito:
**coluna única focada em leitura** + **controles de log sticky** que seguem o
scroll. É exatamente o caso de uso do GameShelf (hero/backdrop + capa
sobreposta + muitas seções: diário, estimativas, horas, sessões).

**Recomendação.**

- Manter o hero com backdrop + capa sobreposta (já funciona bem).
- Distribuir o conteúdo em **duas colunas no desktop**: leitura à esquerda,
  **rail de ações sticky à direita** (status, continuar/encerrar sessão, editar,
  lançar horas, favoritar). As seções longas (sessões, diário) ficam na coluna
  de leitura.
- No mobile, o rail vira uma barra de ações fixa.

### 4. Painel (dashboard)

**Referência.** KPIs em grid (shadcn) e **bento grid** para agrupar widgets de
tamanhos diferentes, dando hierarquia pelo tamanho do bloco. O Steam "Library
Home" prioriza "o que jogar depois".

**Recomendação.**

- Manter os KPI cards navegáveis (o clique → biblioteca filtrada é um bom
  diferencial) e evoluir para um **bento grid** que dê mais peso a "Jogando
  agora" e à previsão do backlog do que aos números secundários.
- Padronizar os painéis em um único componente `Panel`/`StatCard` (hoje há
  variações de `stat-card`, `panel`, `current-game-panel`).
- Trocar os gráficos artesanais (barras/stacked em CSS) por um componente de
  chart único e acessível, mantendo os mesmos dados.

### 5. Estatísticas

**Referência.** HowLongToBeat resume em três buckets de duração; Letterboxd
oferece stats anuais. Tudo em cards de leitura rápida + ranking.

**Recomendação.** Manter heatmap, barras e rankings; focar em consistência
visual (mesma tipografia de número, mesma altura de linha de tabela) e em
`empty states` claros. Sem mudança estrutural — é a área mais próxima do
"moderno" hoje.

### 6. Atividade / timeline / diário

**Referência.** Steam integra atividade ao Library Home; Letterboxd trata o
diário como registro datado com miniaturas. Backloggd reorganizou o log para
"resumir todos os detalhes em uma leitura".

**Recomendação.** Manter a timeline agrupada por dia (já existe) e adicionar
miniatura de capa por evento, reforçando o "diário". O diário de sessão (ADR-018)
já é um diferencial — vale destacá-lo como seção de leitura no detalhe.

### 7. Fila (backlog)

**Referência.** Coleções do Steam e a ordenação de fila do Playnite usam lista
vertical com posição clara e reordenação.

**Recomendação.** Manter a lista atual (posição + jogo + ações) e adicionar
**reordenação por arrastar** (drag handle) além das setas, com feedback de
salvamento. É a interação mais pedida nesse tipo de tela.

### 8. Filtros, busca e views salvas

**Referência.** Playnite tem **filter presets**; GOG Galaxy tem **views salvas**
e bookmarks. Ambos tratam combinações de filtro como objetos de primeira classe,
não como estado escondido.

**Recomendação.** Promover os **filtros salvos** (ADR-017, já implementados) de
um select para uma **lista de views na sidebar**, com "Biblioteca completa",
views nomeadas e a contagem de jogos. Isso transforma um recurso existente em
parte visível da navegação.

### 9. Mobile

**Referência.** Backlogr e Letterboxd mobile usam **tab bar inferior** com
poucos destinos e destaque para ação (log/registro).

**Recomendação.** No app Flutter, manter tab bar com 4–5 destinos
(Coleção, Painel, Atividade, Listas, Mais) e ação flutuante de **registro
rápido de sessão** — o caso de uso de maior frequência.

### 10. Sistema visual (cor, tipografia, tokens)

**Referência.** GOG Galaxy publica um **design system**; Letterboxd tem tokens
documentados (fundo `#14181c`/`#202830`). Produtos modernos partem de **dark
mode como sistema**, não como tema alternativo.

**Recomendação.**

- Introduzir **tokens** (CSS variables + tema Tailwind): cor, espaçamento,
  raio, elevação e escala tipográfica. Hoje há muitos hex avulsos no
  `styles.css`.
- Manter a serifa apenas como **display/accent** (títulos e números grandes) e
  Consistir o corpo em Inter. Essa combinação é o que dá o "ar editorial" sem
  sacrificar legibilidade de UI.
- Padronizar **raio** (hoje varia entre 4/5/6/7/8/10/20/24) e **elevação**.
- Adotar **shadcn/ui** de fato (`cn()`, Radix) para Dialog, Select, Tabs,
  Tooltip, Progress — substituindo controles manuais (o modal atual tem focus
  trap escrito à mão, que o Radix Dialog resolve).

## Recomendações priorizadas

Ordem sugerida de execução, do menor para o maior risco.

**Fase A — baixo risco (sem mudar informação)**
1. Tokens de cor/espaço/raio/tipografia em CSS variables + tema Tailwind.
2. Componentes base no `packages/ui` (`Panel`, `StatCard`, `Badge`, `Field`)
   padronizando o que já existe.
3. Estados obrigatórios (carregando/vazio/erro/sucesso) como componentes
   reutilizáveis (ver [Diretrizes de UI](ui.md)).

**Fase B — navegação e coleção**
4. App shell com sidebar colapsável (desktop) + drawer (mobile).
5. Views salvas como itens da sidebar.
6. Biblioteca: densidade alternável + hover/focus reveal + filtros sticky.

**Fase C — telas de conteúdo**
7. Detalhe do jogo com rail de ações sticky.
8. Painel em bento grid + componente de chart único.
9. Fila com drag & drop.

**Fase D — mobile (Flutter)**
10. Tab bar inferior + registro rápido de sessão.

## Status de implementação

As quatro fases foram executadas (decisão registrada em
[ADR-020](../decisions/ADR-020-ui-modernization.md)). Áreas tocadas passaram por
`lint`, `typecheck`, testes e `build`; o app Flutter passou por `flutter analyze` e
`flutter test`.

**Fase A — tokens e componentes base:** concluída.
- Tokens em `apps/web/src/styles.css` (`:root` + `@theme`), com valores idênticos ao
  tema anterior (mudança neutra, habilita evolução consistente).
- `packages/ui`: `Panel`, `StatCard`, `EmptyState`, `LoadingState`, `ErrorState`.
- `.empty-state`, `.empty-icon`, `.notice` e `.section-heading` ganharam estilo
  (existiam no markup sem CSS).

**Fase B — navegação e coleção:** concluída.
- App shell com sidebar (Coleção / Análise), recolhível no desktop e drawer no mobile.
- Views salvas (ADR-017) promovidas para a sidebar.
- Biblioteca com densidade (grade / compacta / lista), reveal em hover/focus e
  filtros sticky.

**Fase C — telas de conteúdo:** concluída.
- Detalhe com rail de ações sticky.
- Painel em bento grid.
- Fila com drag & drop (além das setas).

**Fase D — mobile:** concluída.
- Bottom bar em `NavigationBar` (Material 3) com indicador de sessão ativa.
- Barra de sessão rápida global, com encerramento em um toque.

Pendências conscientes: componente de chart único (gráficos seguem artesanais em
CSS) e adoção efetiva do shadcn/ui/Radix (ex.: Dialog com focus trap nativo).

**Referência Trophies Hunter — casca (2026):** adotada conforme a
[ADR-032](../decisions/ADR-032-trophies-hunter-inspired-shell.md). A sidebar da
Fase B foi substituída por topnav fixa + abas do perfil (sem drawer mobile), o
acento dourado virou azul e a serifa saiu dos títulos. A biblioteca ganhou
cards largos (2 colunas, capa quadrada), as views salvas viraram chips na barra
de abas, e uma nova aba `Plataformas`
(`/plataformas`) mostra o resumo por plataforma dos sumários da
[ADR-031](../decisions/ADR-031-platform-catalog-and-summaries.md). Dados sociais
da referência (pontuações, seguidores) continuam fora de escopo, e progresso só
aparece quando existe dado real.

## O que evitar

- Efeitos de "vitrine" (glassmorphism pesado, AR, animações longas) que
  competem com a leitura dos dados.
- Copiar a identidade visual de terceiros — pegar **padrões de layout**, não
  skins.
- Redesenhar Estatísticas do zero: é a área mais madura.
- Introduzir bibliotecas de UI além do necessário, contrariando `AGENTS.md`.

## Critérios de validação (qualquer mudança de layout)

- Passa lint, testes e build (`apps/web`).
- Navegação por teclado e foco visível preservados.
- Contraste adequado no tema escuro (atenção ao acento dourado sobre fundo).
- Respeita `prefers-reduced-motion`.
- Estados vazio/erro/carregando presentes.
- Nenhuma regra de negócio migrada para o frontend.

## Fontes

- Backloggd — site e changelog (redesign da página de jogo, logs sticky):
  <https://backloggd.com/changelog/>
- Letterboxd — poster grid e diário (análise de padrões):
  <https://blakecrosley.com/guides/design/letterboxd>
- Playnite — Desktop Mode e painéis (sidebar/topbar/explorer/library):
  <https://api.playnite.link/docs/manual/gettingStarted/playniteDesktopMode.html>
- Steam — Library update e foco em descoberta:
  <https://store.steampowered.com/libraryupdate>
- GOG Galaxy 2.0 — views salvas e biblioteca unificada: <https://www.gogalaxy.com/en>
- HowLongToBeat — duração em três buckets e stats: <https://howlongtobeat.com/>
- Backlogr — tracker mobile: <https://www.backlogr.site/en>
- shadcn/ui — Sidebar e blocks de dashboard:
  <https://ui.shadcn.com/docs/components/sidebar> · <https://ui.shadcn.com/examples/dashboard>
- Bento grid — padrão de layout para dashboards: <https://superdesign.dev/styles/bento-grid>
- Trophies Hunter — perfil multiplataforma e acompanhamento de conquistas:
  <https://trophieshunter.com/>
