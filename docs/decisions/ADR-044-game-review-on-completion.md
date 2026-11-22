# ADR-044: análise do jogo ao zerar

## Status

Aceito. Estende o assistente de "Zerar" do ADR-042.

## Contexto

Ao zerar, o usuário registra nota e dificuldade, mas não tem onde explicar o que achou
do jogo. Ele quer avaliar por critérios (gameplay, ambientação, trilha sonora e
história) apenas nos jogos que merecem, e pular nos demais.

## Decisão

- A análise é um objeto opcional `review` do jogo, gravado em `games.review` (`jsonb`,
  nulo por padrão; migration 0032). Contém `summary` (texto livre, até 5000 caracteres) e,
  para cada critério (`gameplay`, `setting`, `soundtrack`, `story`), `score` (1 a 10) e
  `comment` (até 1000 caracteres), todos anuláveis. Um único `jsonb` evita uma coluna por
  critério e permite acrescentar critérios sem migration; o formato é validado no
  contrato (`gameReviewSchema`), e a coluna não é consultada por filtro.
- A nota geral (`rating`, 1 a 11) continua separada: a análise detalha, não a substitui.
- A análise só é aceita para jogos zerados ou abandonados, como `rating`. `finish`
  aceita `review`; uma análise sem nenhum campo preenchido é descartada no servidor
  (`isReviewEmpty`), então "pular tudo" nunca grava nada.
- `finish/undo` devolve e restaura `review`. O campo é opcional no descritor de
  desfazer para que versões antigas do app continuem funcionando.
- Web e Flutter acrescentam duas etapas puláveis ao assistente: "Critérios" (chips de
  1 a 10 e comentário curto por critério) e "Análise" (texto livre). O detalhe do jogo
  mostra "Minha análise" só com o que foi preenchido.
- Mesclar jogos duplicados mantém a análise do cadastro que permanece e, se ele não
  tiver, usa a do absorvido. Backups incluem `review` (importação de backups antigos
  assume nulo).

## Consequências

- A análise pode ser editada depois, na ficha do jogo (web: diálogo; Flutter: folha),
  por `PATCH /games/:id` com `review`. Esvaziar todos os campos envia `review: null`
  e remove a análise. Jogos zerados ou abandonados sem análise mostram "Adicionar
  análise". Os campos do assistente e do editor são os mesmos componentes.
- Estatísticas e filtros por critério não existem; a coluna `jsonb` permitiria
  consultas, mas isso não foi pedido.
