# ADR-017: Filtros salvos, exclusão de sugestões e novas estatísticas

## Status

Aceito.

## Contexto

Comparação com o [GameLog](https://github.com/horlesq/gamelog), um projeto self-hosted
de ideia parecida, apontou três coisas que ele resolvia e o GameShelf não. O resto do
que ele tem é decisão consciente aqui (single-user pelo ADR-004) ou já existe em forma
melhor — sessões, estimativas, fila, metas e missões não têm equivalente lá, e o
sugeridor determinístico do GameShelf foi mantido em vez do de LLM dele, por não
depender de chave de API, custo nem chamada externa.

A Biblioteca passou a ter onze dimensões de filtro e ordenação (ADR-016). Reconstruir
uma combinação usada com frequência virou trabalho repetitivo, e não havia como guardá-la.

O sugeridor de próximo jogo pontua jogos da própria biblioteca, mas não havia como dizer
"não me ofereça mais este" sem arquivar o jogo, o que o esconde da Biblioteca inteira —
efeito colateral indesejado.

## Decisão

**1. Filtros salvos em tabela própria, com o estado em `jsonb`.** `saved_filters`
(migration `0015`) guarda nome único e o estado completo do filtro num único campo
`jsonb`, não em onze colunas. O formato é definido e validado por
`libraryFilterStateSchema` em `packages/contracts` — a fronteira continua sendo Zod, como
manda o architecture.md, e o banco não precisa de migration a cada filtro novo.

O schema é `.strict()` com default por campo: um filtro salvo antes de uma dimensão nova
existir continua válido e recebe o default dela. Campo desconhecido é recusado com 400.

Rotas em `apps/api/src/modules/saved-filters/`: `GET`, `POST`, `PATCH` e `DELETE`
`/saved-filters`. Nome repetido responde 409, como listas.

Sem ícone e sem cor, que o GameLog tem: num app de um usuário é decoração, e o princípio
10 do AGENTS.md pede evitar abstração prematura.

**2. Exclusão de sugestões como coluna booleana, não tabela.** `games.excluded_from_suggestions`.
O GameLog usa uma tabela com o *nome* do jogo porque o LLM dele sugere títulos arbitrários,
que podem não existir na biblioteca. Aqui o sugeridor escolhe entre os jogos do próprio
acervo, então isso é atributo do jogo — e segue o padrão que já existe (`archived`,
`favorite`, `game_of_year`).

`buildSuggestions` passa a descartar esses jogos antes de pontuar, então a exclusão vence
até a primeira posição da fila. O jogo continua visível na Biblioteca, nos relatórios e na
fila: o único efeito é não ser oferecido como próximo jogo.

**3. Quatro estatísticas novas em `GET /stats`.**

- `totals.completionRate`: zerados sobre os jogos que estão na biblioteca. **Exclui
  `DESIRED`**, que são desejos e não acervo — incluí-los faria a taxa cair por querer
  jogos, o que não é progresso nem regressão.
- `totals.averageHoursPerGame`: média de horas por jogo com horas registradas, zerado ou
  não. Difere de `averageCompletedHours`, que considera só os zerados.
- `byReleaseYear`: contagem por ano de lançamento, sobre a biblioteca inteira (não só
  zerados), porque a pergunta é sobre a composição do acervo.
- `byDeveloper`: top 10 por desenvolvedora, sobre zerados, reaproveitando `statsGroupSchema`
  e o agrupador que já serve gênero, tipo e plataforma. A chave é o nome em minúsculas,
  pois desenvolvedora não é entidade de catálogo no GameShelf.

## Consequências

- Mudança na API pública: novas rotas `/saved-filters`; `gameSchema` ganha
  `excludedFromSuggestions`; `statsResponseSchema` ganha quatro campos. Único consumidor
  é o frontend, atualizado junto. O app Flutter não usa nenhum dos dois.
- `GameRecord` em `games/repository.ts` é escrito à mão e estava omitindo colunas do banco;
  passou a declarar a coluna nova. Vale conferir se há outras divergências.
- Filtro salvo guarda ids de plataforma, gênero, franquia e lista. Excluir uma dessas
  entidades deixa o filtro apontando para um id inexistente, e ele simplesmente não casa
  com nada. Aceito: o usuário renomeia ou apaga o filtro.
- Não foi adicionado export CSV, que o GameLog tem: o export JSON do ADR-014 já cobre
  backup, e CSV serviria a outro propósito (planilha), fora do escopo decidido.
