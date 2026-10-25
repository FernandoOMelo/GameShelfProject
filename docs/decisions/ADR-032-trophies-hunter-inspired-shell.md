# ADR-032 — Casca visual no padrão Trophies Hunter

## Status

Aceito

## Contexto

A UI do GameShelf havia sido modernizada com uma sidebar colapsável
([ADR-020](ADR-020-ui-modernization.md)), acento dourado e títulos em serifa.
O usuário pediu aproximar o **visual** do Trophies Hunter
(<https://trophieshunter.com/>) — sem copiar a interface proprietária e sem
mudar funcionalidades — mantendo apenas os dados que o GameShelf de fato tem.

Restrições levantadas antes de implementar:

- dados sociais da referência (pontos, troféus, seguidores, seguindo) ficam de
  fora: o GameShelf é pessoal e self-hosted;
- nada de dados fictícios: barras de progresso e estatísticas só aparecem
  quando o dado existe;
- a área "Contas" da referência vira nossa aba **Plataformas**, reaproveitando
  os sumários da [ADR-031](ADR-031-platform-catalog-and-summaries.md);
- mudança apenas de aparência: contratos, endpoints e regras de negócio
  permanecem os mesmos.

## Decisão

### 1. Casca: topnav fixa + abas do perfil, sem sidebar

A sidebar (e o drawer mobile) foram removidas. A navegação passa a ser:

- **Topnav fixa**: marca GameShelf, busca da biblioteca
  (`aria-label="Buscar jogos"`), links `Painel` e `Configurações`, selo `LOCAL`
  e avatar;
- **Cabeçalho de perfil** (`ProfileHeader`): avatar, nome e métricas reais —
  jogos na biblioteca, zerados, conquistas (quando a API de sumários responde)
  e tempo total. Renderizado só nas views de perfil;
- **Abas do perfil** (`ProfileTabs`), visíveis em todas as views (exceto no
  detalhe de um jogo), para que a navegação continue completa:
  `Jogos · Fila · Coleções · Sessões de jogo · Plataformas · Estatísticas`.

A barra de abas mantém o badge da fila com `aria-hidden`, preservando o nome
acessível `Fila`.

### 2. Rótulos e rotas

| Antes | Agora | Rota |
|-------|-------|------|
| Biblioteca | Jogos | `/biblioteca` |
| Listas | Coleções | `/listas` |
| Atividade | Sessões de jogo | `/atividade` |
| — | Plataformas | `/plataformas` (nova) |

As rotas não mudaram; só os rótulos. `AppView` ganhou `'platforms'` e a view
`/plataformas` cai no mesmo fallback das demais rotas
([ADR-021](ADR-021-url-navigation.md)).

Os testes que referenciavam os nomes antigos (`Biblioteca`, `Listas`,
`Atividade`, `Mais filtros`) foram atualizados para os novos.

### 3. Identidade visual

- Acento **azul** (`#3b82f6` / `#60a5fa`) no lugar do dourado; fundo `#0b0d10`;
- serifa (Georgia) removida: títulos e corpo usam a mesma família sem serifa;
- tokens (`--gs-*`) mantidos com as mesmas chaves, apenas com novos valores —
  nenhuma tela trocou hex avulso.

### 4. Biblioteca

- Busca e ações principais (views salvas como chips, densidade, `＋ Adicionar
  jogo`) ficam na casca, não no corpo da página;
- Cards no layout largo da referência (2 colunas no desktop, capa quadrada à
  esquerda, metadados e chips de plataforma à direita). `compact` e `list`
  mantêm o comportamento anterior;
- **Progresso por card só quando é fato conhecido**: 100% para jogos zerados,
  o progresso real registrado no painel para jogos em andamento, 0% para
  jogos ainda não iniciados. Para estados sem dado (pausado, abandonado) a
  barra é omitida.

### 5. Aba Plataformas

`apps/web/src/pages/platforms-view.tsx` lista uma card por plataforma com
contagem de jogos, zerados, tempo registrado, tempo informado pela plataforma,
conquistas e capas recentes — tudo a partir de `/platforms/summaries`
([ADR-031](ADR-031-platform-catalog-and-summaries.md)) e da biblioteca local.
Quando uma linha não tem dado, ela é **omitida**, nunca exibida como zero. O
cadastro de plataformas continua em `/configuracoes`.

## Consequências

- A navegação para `Painel`/`Configurações` deixou de ser item de seção e virou
  link da topnav; as views de perfil ganharam cabeçalho próprio.
- O cabeçalho de perfil duplica parcialmente o "Resumo da biblioteca" do
  painel; revisar se a duplicação passar a incomodar.
- `styles.css` perdeu o CSS da sidebar, do drawer e do `.library-heading`, e
  ganhou os blocos `.topnav`, `.profile-header`, `.profile-tabs`, `.view-chip`,
  `.platform-card` e o card largo da biblioteca.
- Pendências conscientes: a referência também usa as telas de detalhe do jogo,
  painel, fila, listas e atividade — fora do escopo desta etapa.
