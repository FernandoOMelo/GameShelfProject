# ADR-021: Navegação por URL (deep links e botão voltar)

## Status

Aceito.

## Contexto

O ADR-016 §3 fixou a navegação do app web em `useState`, sem roteador: `activeView`
e `selectedGame` vivem apenas na memória. Três consequências incomodam no uso diário:

- recarregar a página sempre volta ao painel, mesmo estando no detalhe de um jogo;
- não existe link compartilhável para uma tela ou um jogo;
- no celular o app é instalado como PWA (ADR-015) e o gesto/botão de voltar do
  sistema sai do app em vez de fechar o detalhe — o comportamento que qualquer
  usuário de app espera.

Restrições do projeto: `AGENTS.md` proíbe dependências sem justificativa. Nenhum
roteador (`react-router`, `wouter`) está instalado, e adotar um custaria uma
dependência nova mais a reescrita de todos os pontos de navegação. O app é uma
SPA com **seis views de topo e um detalhe**: não há rotas aninhadas, loaders,
rotas protegidas, nem parâmetros de busca. A infraestrutura já está pronta para
receber caminhos: o `nginx.conf` usa `try_files $uri $uri/ /index.html` e o service
worker já serve navegação com fallback para o `index.html` em cache
(`networkFirst(request, '/', false)`).

## Decisão

**1. History API direto, sem dependência de roteador.** Um módulo pequeno
(`apps/web/src/router.ts`) traduz `location.pathname` ↔ `(view, gameId)` e é a
única fonte de verdade do mapeamento:

| Rota | Tela |
| --- | --- |
| `/painel` | Painel |
| `/biblioteca` | Biblioteca |
| `/fila` | Fila |
| `/listas` | Listas |
| `/estatisticas` | Estatísticas |
| `/atividade` | Atividade |
| `/jogos/:id` | Detalhe do jogo |

Caminhos desconhecidos (inclusive `/`, que é a entrada do PWA) caem no painel.

**2. A URL é a fonte da verdade da navegação; o estado React é a projeção.** O
estado inicial de `activeView`/`gameId` é lido da URL na montagem, `pushState`
acompanha cada navegação e um listener de `popstate` reconstrói o estado — por isso
o botão voltar do navegador funciona sem código por tela.

**3. O detalhe resolve o jogo pela lista já carregada.** Abrir `/jogos/:id`
diretamente **não** cria um endpoint novo: o id é procurado na lista de jogos que o
app já busca no boot. Se o id não existir na biblioteca, a tela mostra o erro
padrão e volta para `/biblioteca`.

**4. O botão "Voltar" do detalhe respeita a origem da entrada.** `history.state`
marca o detalhe empilhado pelo próprio app (`{ details: true }`): nesse caso o botão
usa `history.back()` e o `popstate` fecha o detalhe. Quando a página foi aberta por
um link direto não há entrada anterior dentro do app, então o botão faz
`replaceState` para a view atual em vez de sair do app.

## Consequências

- Recarregar a página preserva a tela e o detalhe; links ficam compartilháveis.
- O gesto de voltar do PWA fecha o detalhe em vez de sair do app.
- Nenhuma dependência nova e nenhum ponto de navegação reescrito: `goTo` e
  `showDetails` continuam sendo as entradas, agora com `navigate()` por baixo.
- `/jogos/:id` depende da lista de jogos estar carregada. É o mesmo dado que a
  biblioteca já exige, então não há requisição extra.
- Rotas passam a ser uma superfície pública: renomear um caminho quebra links
  salvos. Os caminhos acima ficam estáveis a partir deste ADR.
- A navegação por teclado dentro do app (setas entre jogos) também empilha o
  detalhe, então o voltar funciona em qualquer origem.

## Alternativas consideradas

- **`react-router`/`wouter`**: mais dependência e reescrita das views para o custo
  de rotas aninhadas que o app não tem. Se um dia houver rotas com parâmetros
  múltiplos e loaders, esta decisão deve ser reavaliada.
- **`hash` (`#/fila`)**: mais simples e sem fallback de servidor, mas gera URLs
  feias e não integra com o `try_files` que já existe; o nginx e o SW já estão
  preparados para caminhos limpos.
- **Sem rota para o detalhe** (só views): metade do valor viria de graça, mas o
  caso mais pedido — mandar "olha esse jogo" — continuaria impossível.
