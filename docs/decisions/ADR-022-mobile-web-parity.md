# ADR-022: Paridade funcional entre web e app Flutter

## Status

Aceito.

## Contexto

O ADR-016 §6 fixou o escopo do app Flutter (`apps/mobile`) como **consulta + registro
de sessão**, e o `docs/product/mobile.md` foi explícito: "o que não entra no celular é
a edição: cadastrar e alterar jogos, listas e metas continua só no desktop". Na
prática o app tem quatro abas (Jogando, Biblioteca somente leitura, Fila, Progresso)
e nenhuma forma de cadastrar ou alterar dados.

O uso real mudou: o celular passou a ser o aparelho mais usado para consultar a
coleção e, com frequência, o único disponível quando surge a vontade de registrar um
jogo, corrigir um status ou atualizar uma meta. Manter a edição exclusiva do desktop
obriga a abrir o computador para tarefas que o app já teria condição de fazer: a API
é a mesma e não há autorização nem multiusuário (ADR-004).

## Decisão

**1. O app Flutter passa a ter paridade funcional com a web.** As seis seções de
topo (Biblioteca, Fila, Listas, Painel, Estatísticas, Atividade) existem no celular,
e a edição — criar, alterar e excluir jogos, listas e metas — deixa de ser exclusiva
do desktop. Este ADR **revoga a restrição de edição do ADR-016 §6**; o resto do
ADR-016 (linha do tempo, indicadores navegáveis, cache de leitura) continua válido.

**2. Nenhuma rota nova.** A paridade usa exatamente os endpoints que a web já consome
(`GET/POST/PATCH/DELETE /games`, `/lists`, `/goals`, `/saved-filters`,
`/stats`, `/stats/activity`, `/stats/replay`, `/stats/timeline`,
`/metadata/games`, `/metadata/time-estimates`, `/queue`, `/planning/settings`,
`/challenge`). A API não muda; mudanças
em `packages/contracts` que afetem essas rotas continuam precisando ser replicadas à
mão nos models Dart (limitação registrada em `architecture.md`).

**3. Domínio permanece no backend.** O celular replica **rotas e telas**, não regras:
os cálculos de painel, estatísticas, progresso de meta e previsão continuam vindo
prontos da API. Nenhuma fórmula de negócio é reimplementada em Dart (AGENTS.md,
princípio 7).

**4. Navegação: barra inferior com cinco destinos.** As quatro abas atuais ganham uma
quinta, **Mais**, que reúne os destinos de menor frequência (Listas, Estatísticas,
Atividade, Metas, Configurações). O Painel continua na aba Progresso. A barra
inferior de poucos destinos é a linguagem de trackers mobile
([ui-references.md](../product/ui-references.md) §9) e evita um drawer global que
esconderia a navegação atrás de um gesto.

**5. Edição no celular é a mesma superfície, menor.** O formulário de jogo do mobile
busca metadata (IGDB) e tempos (HowLongToBeat) nas mesmas rotas da web e cobre os
mesmos campos, mas a apresentação é adaptada a telas estreitas (formulário em tela
cheia, seções colapsáveis). Continua valendo o princípio de que o fluxo primário —
registrar sessão — se resolve em poucos toques (ADR-016 §6).

**6. Offline continua restrito a escrita de sessão.** O ADR-015 e o ADR-016 §7 definem
a fila offline para iniciar/encerrar sessões. Editar jogos, listas e metas exige
conexão: a fila não é estendida, para não introduzir resolução de conflitos que um
aparelho por vez não justifica. Sem conexão, os GETs mostram o último cache e o
banner avisa.

## Consequências

- `docs/product/mobile.md` deixa de afirmar que edição é exclusiva do desktop e passa
  a descrever o escopo de paridade.
- O app Flutter ganha models e clientes para todos os contratos que passou a usar;
  como não compartilha os pacotes TypeScript, a duplicação à mão aumenta e precisa
  ser mantida em sincronia com `packages/contracts`.
- A superfície de teste do app cresce: paridade implica testes de formulário, lista,
  meta e estatísticas, além dos de sessão que já existiam.
- Backend, banco e web **não mudam** nesta decisão: a paridade é uma entrega do app.

## Alternativas consideradas

- **Manter ADR-016 (só consulta)**: menos código e menos superfície de teste, mas é
  exatamente o incômodo que motivou esta decisão.
- **Paridade só de leitura**: cobriria Estatísticas, Atividade e Listas, mas deixaria
  sem resposta os pedidos de criar jogo e ajustar meta no celular.
- **Compartilhar contratos via geração de código Dart a partir do Zod**: reduziria a
  duplicação, mas adiciona um passo de build e uma dependência de tooling para um
  ganho que a biblioteca pessoal não exige hoje (AGENTS.md, princípio 12).

## Referências

- [ADR-016](ADR-016-timeline-and-library-navigation.md) — app Flutter entra no escopo
  (revogado apenas o item de edição, §6).
- [ADR-015](ADR-015-pwa-offline.md) — uso offline e fila de sessões.
- [ADR-004](ADR-004-single-user.md) — usuário único, sem autorização.
- [docs/product/mobile.md](../product/mobile.md) — experiência mobile.
