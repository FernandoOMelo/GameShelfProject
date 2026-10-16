# ADR-020: Modernização da UI (tokens, app shell com sidebar e componentes base)

## Status

Aceito.

## Contexto

A pesquisa de referências de layout ([ui-references.md](../product/ui-references.md))
comparou o GameShelf a trackers e launchers maduros (Backloggd, Letterboxd,
Playnite, Steam, GOG Galaxy, HowLongToBeat) e apontou lacunas de UI, não de domínio:
casca com nav horizontal apertada, sem tokens (muitos hex avulsos em `styles.css`),
estados vazio/erro/carregando existindo no markup mas **sem CSS**, detalhe com ações
jogadas no fim de uma coluna longa e fila reordenável apenas por setas.

Restrições do projeto que moldaram a decisão: `AGENTS.md` pede mudanças pequenas,
proíbe dependências sem justificativa e proíbe abstrações prematuras. O stack
documentado cita shadcn/ui, mas ele **não está instalado**; adotá-lo de fato (Radix,
`cn()`) é uma decisão maior, fora do escopo desta modernização.

O ADR-016 §3 fixou navegação por `useState` (sem roteador). Isso permanece válido e
é um limite que esta decisão não cruza.

## Decisão

**1. Tokens de design como CSS variables + `@theme` do Tailwind v4.** Os tokens
(`--gs-bg`, `--gs-surface`, `--gs-ink`, `--gs-accent`, `--gs-line-*`, raios, largura
de shell) ficam em `apps/web/src/styles.css`, e a paleta é exposta ao Tailwind via
`@theme` (`bg-surface`, `text-ink-dim`, `border-line`...). Os valores foram
**mantidos idênticos** aos do tema anterior: a camada é neutra visualmente e serve
para que telas novas não introduzam hex soltos. Código existente migra de forma
incremental.

**2. Componentes base em `packages/ui`, sem biblioteca de UI nova.** `Panel`,
`StatCard`, `EmptyState`, `LoadingState` e `ErrorState` padronizam o que já existia
duplicado (Painel, Estatísticas, Biblioteca). `Badge` e `Field` não foram criados:
sem uso concreto seriam abstração preventiva. Adotar shadcn/ui/Radix (Dialog, Select,
Tabs) fica como decisão separada, porque exige avaliar dependências e reescrever
controles — inclusive o focus trap manual do modal.

**3. App shell com sidebar colapsável (desktop) e drawer (mobile).** A nav horizontal
sai de cena; a sidebar agrupa as seis seções por intenção (*Coleção*: Biblioteca,
Fila, Listas; *Análise*: Painel, Estatísticas, Atividade) e hospeda as **views
salvas** do ADR-017 como itens de navegação. A troca de tela continua por `useState`
(ADR-016 §3): a sidebar só escreve o mesmo estado que a nav escrevia. No mobile a
sidebar vira drawer com scrim e a topbar mostra o título contextual. Os nomes
acessíveis dos botões de navegação foram preservados para não quebrar testes.

**4. Biblioteca: densidade, reveal e filtros fixos.** Um alternador de densidade
(grade / grade compacta / lista) persistido em `localStorage`; ações rápidas
reveladas em `:hover` e `:focus-visible` (não só hover); barra de filtros `sticky`.
Os filtros continuam no cliente, sobre `GET /games`, como no ADR-016 §4/§5.

**5. Telas de conteúdo.** Detalhe do jogo com **rail de ações sticky** à direita
(colapsa abaixo do conteúdo em telas estreitas); Painel em **bento grid** (6 colunas,
com peso maior para previsão/metas/missão); Fila com **drag & drop** além das setas,
salvando a ordem pela rota existente `PUT /queue/order`. Nenhuma regra de negócio
mudou e nenhuma rota nova foi criada.

**6. Mobile (Flutter): `NavigationBar` Material 3 + barra de sessão rápida.** A
`BottomNavigationBar` vira `NavigationBar` (ícones preenchidos no estado selecionado,
indicador de sessão ativa) e uma **barra de sessão global** aparece nas abas que não
são "Jogando", mostrando jogo e tempo decorrido com encerramento em um toque. O
registro de sessão segue sendo o fluxo primário em poucos toques (ADR-016 §6).

## Consequências

- Preferências de UI (densidade, menu recolhido) ficam em `localStorage`, não no
  banco: são preferências de apresentação, não dados de domínio.
- A sidebar colapsada esconde rótulos visuais; por isso cada item mantém `aria-label`,
  preservando navegação por leitor de tela e por teclado.
- Acessibilidade coberta por testes: navegação, filtros salvos pela sidebar e
  reordenação da fila por arrastar têm testes dedicados (`apps/web/src/pages/app.test.tsx`).
- `.empty-state`, `.empty-icon`, `.notice` e `.section-heading` deixam de ser classes
  sem estilo; os estados obrigatórios de `ui.md` passam a ter componente próprio.
- `ConfirmDialog` (`packages/ui`) substituiu os três `window.confirm` do app. O
  diálogo tem rótulo, prende o Tab, fecha com Escape e com clique no fundo, e
  devolve o foco ao botão que o abriu.
- Anel de foco global em `:focus-visible`, imagens fora da dobra com
  `loading="lazy" decoding="async"` e `prefers-reduced-motion` respeitado.
- Estatísticas e Atividade são carregadas sob demanda (`React.lazy`) e embrulhadas
  em `ErrorBoundary`: falhar ao baixar um chunk offline mostra erro recuperável em
  vez de tela branca. `manualChunks` separa o vendor do React, melhorando o cache
  entre deploys.
- O painel compara cada indicador de período com o período anterior de mesma
  duração (`▲/▼ N% vs. período anterior`). O cálculo é do cliente, sobre uma
  segunda chamada a `/dashboard` com `from`/`to`: nenhum contrato novo. Sem base de
  comparação (período anterior zerado), o indicador é omitido.
- Gráficos continuam artesanais em HTML/CSS — sem biblioteca de chart, e sem SVG
  porque as barras se adaptam melhor ao layout responsivo e acessível. As três
  listas de barras de Estatísticas usam `BarList` (`packages/ui`), que calcula o
  máximo e o rótulo acessível sozinho. **Pendência consciente:** o gráfico vertical
  do painel (uma barra por período, clicável) ainda é a variante local `bar-chart`;
  unificá-lo num componente único exige nova decisão.
- A navegação deixou de ser apenas `useState` (como o ADR-016 §3 registrava): as
  telas passam a ter URL, deep link e botão voltar. Decisão própria em
  [ADR-021](ADR-021-url-navigation.md).
- shadcn/ui continua **não adotado**; o stack em `AGENTS.md` menciona a lib, e essa
  divergência permanece registrada aqui até uma decisão específica.
