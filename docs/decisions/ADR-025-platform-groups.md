# ADR-025: grupos e subgrupos de plataforma

## Status

Aceita. Complementa o ADR-023 e muda a agregação das estatísticas por
plataforma.

## Contexto

A primeira sincronização real com o Achievist (ADR-024) expôs um problema do
catálogo plano de plataformas. O Achievist informa a loja — "Steam", "Google
Play" —, enquanto o catálogo do usuário usa o aparelho — "PC". Como as duas são
linhas independentes em `platforms`, confirmar uma correspondência cria uma
associação "Steam" ao lado da associação "PC" que já existia, para o mesmo jogo.
Com 86 entradas na fila, isso produziria uma associação paralela para cada jogo
de PC, com o tempo externo aparecendo sob "Steam" e as sessões manuais sob "PC",
como se fossem coisas diferentes.

O catálogo também já tinha duplicatas antes da integração: "PC" (criada pelo
usuário) e "PC (Microsoft Windows)" (vinda da metadata do IGDB).

## Decisão

O catálogo passa a ter **dois níveis**:

- uma plataforma sem `parent_id` é um **grupo** — PC, PlayStation 5, Nintendo
  Switch. É também o comportamento de todas as plataformas existentes, que não
  mudam;
- uma plataforma com `parent_id` é um **subgrupo** dentro dele — Steam, GOG,
  Epic, Google Play.

Regras, validadas na fronteira da API (`modules/platforms/service.ts`) e
cobertas por teste:

- uma plataforma não pode ser o próprio grupo (também garantido por `CHECK` no
  banco);
- o grupo escolhido não pode ter grupo: são dois níveis, não uma árvore;
- uma plataforma que já é grupo de outras não pode virar subgrupo, porque isso
  criaria um terceiro nível;
- remover o grupo é sempre permitido, e devolve a plataforma à condição de
  grupo.

A profundidade máxima não é imposta por `CHECK` no banco porque exigiria um
gatilho, que o projeto não usa em nenhum outro lugar. A regra vive na API e nos
testes; o banco garante apenas o que uma restrição de linha alcança.

### Onde a associação acontece

O jogo continua associado à plataforma específica, não ao grupo. Guardar "Steam"
preserva a informação de onde o jogo realmente está; o grupo é derivado quando
se quer a visão consolidada. O caminho inverso — associar ao grupo e perder a
loja — descartaria informação que a fonte externa fornece.

### O que agrega por grupo

Nas estatísticas:

- **jogos zerados por plataforma** (`byPlatform`): um jogo cuja plataforma é
  Steam conta em PC;
- **tempo informado por plataforma**
  (`library.externalPlaytimeByPlatform`): as horas de Steam e GOG somam em PC.

Somar entre subgrupos do mesmo grupo é legítimo: são lojas diferentes do mesmo
aparelho, não a mesma atividade contada duas vezes. A regra do ADR-024 que
continua valendo é outra: tempo externo e tempo local nunca se somam.

A lista de associações na tela de detalhes do jogo continua mostrando cada
plataforma individualmente, então nada se perde na visão detalhada.

### O que a decisão deliberadamente não faz

- **Não mescla plataformas.** "PC" e "PC (Microsoft Windows)" continuam sendo
  duas linhas; o usuário resolve a duplicata colocando uma dentro da outra, o
  que consolida as estatísticas sem apagar nada nem reescrever referências.
  Mesclar de verdade — reapontar jogos, associações e sessões e apagar a linha
  perdedora — é destrutivo e fica para uma decisão própria, se fizer falta.
- **Não atribui grupos automaticamente.** A sincronização não adivinha que
  "Steam" pertence a "PC": quem diz é o usuário, uma vez, no painel. Inferir por
  nome erraria em casos como "Google Play", que não é PC nem console.

## Migração

`0019_platform_groups.sql` apenas adiciona a coluna, a chave estrangeira, o
`CHECK` e o índice. Nenhuma plataforma muda de id ou nome, e todas começam sem
grupo — exatamente o comportamento anterior. Jogos, associações, sessões e
jornadas não são tocados.

Rollback manual em `0019_platform_groups.down.sql`: perde-se apenas a
hierarquia.

## Consequências

- `platformSchema` ganha `parentId`, com padrão nulo para que backups anteriores
  continuem importáveis; o backup passa a exportar e restaurar a hierarquia.
- Nova rota `PATCH /platforms/:id` para definir ou remover o grupo, e
  `POST /platforms` aceita `parentId` na criação.
- Novo painel "Grupos de plataforma" no Painel.
- O app Flutter (`apps/mobile`) não foi alterado: a mudança é aditiva e ele
  ignora `parentId`, continuando a ver o catálogo plano.
