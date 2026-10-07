# Plano — Fase 8 em diante

Itens escolhidos a partir de "Depois do MVP". Fora de escopo por decisão do
usuário: integração Steam, achievements, autenticação e acesso remoto.

Ordem de execução: do que só deriva dados existentes (sem migration) para o que
exige novo schema. Cada etapa é uma entrega independente, com testes e docs.

## Etapa 1 — Atividade (heatmap e sequências)

- `GET /stats/activity?year=`: minutos jogados por dia, dias ativos, sequência
  atual e maior sequência de dias jogados.
- Cálculo em `modules/stats` (função pura, testável); contrato em
  `packages/contracts`.
- Frontend: heatmap anual na tela de Estatísticas.
- Sem migration. Apenas sessões com duração contam; horas retroativas não têm
  data de sessão e ficam de fora.

## Etapa 2 — Replay do ano

- `GET /stats/replay?year=`: horas, sessões, zerados, jogo mais jogado, gênero
  mais jogado, maior sessão, jogo do ano, mês mais ativo.
- Reutiliza os serviços de stats e dashboard. Sem migration.
- Frontend: painel "Replay do ano" na tela de Estatísticas, com seletor de ano
  (em vez de uma tela separada, para não ampliar a navegação).

## Etapa 3 — Previsão do backlog

- Evolui a previsão do painel: com o ritmo semanal (já configurado em
  planejamento), mostrar "backlog acaba em X meses" e destacar jogos parados
  há mais tempo como candidatos a abandono.
- Extensão do `dashboard/service.ts`. Sem migration.

## Etapa 4 — Próximo jogo

- `GET /backlog/suggestions`: ranking determinístico por prioridade, posição na
  fila, tempo restante estimado e tempo parado. Sem IA.
- Regra de pontuação em módulo de domínio testável e documentada em
  `backlog.md`. Frontend: botão "Me ajuda a escolher" com motivo da sugestão.

## Etapa 5 — Metas

- Nova tabela `goals` (migration): tipo (`COMPLETED_GAMES` | `PLAYED_HOURS`),
  período (`YEAR` | `MONTH`), ano/mês e alvo.
- CRUD + progresso calculado no backend; cartões de progresso no painel.
- Exige ADR-011 (decisões abaixo).

## Etapa 6 — Diário de sessão com screenshots

- Notas por sessão (campo de texto) e imagens anexadas à sessão, reutilizando o
  armazenamento local de mídia (ADR-005). Migration + ADR-012.

## Etapa 7 — Múltiplas filas

- Avaliar antes de construir: as listas personalizadas (ADR-008) já cobrem o
  caso? Se sim, só adicionar "ordenar/ativar lista como fila" em vez de nova
  entidade. Decisão registrada em ADR antes de qualquer código.

## Etapa 8 — Exportar, importar e backup

- Exportação JSON completa (jogos, sessões, listas, metas, configurações) e
  importação validada por Zod.
- Script de backup do PostgreSQL (`pg_dump`) documentado para Docker Compose.

## Etapa 9 — PWA offline

- Manifest, service worker e fila local de sessões registradas offline,
  sincronizadas ao voltar a conexão. Exige ADR-013 (conflitos de sincronização).

## Decisões em aberto (etapa 5)

Assumidas como padrão até o usuário dizer o contrário:

- uma meta por combinação tipo + período;
- meta de zerados conta jogos com `completedAt` no período (inclui arquivados);
- meta de horas conta sessões no período, igual ao `periodStats` do painel.
