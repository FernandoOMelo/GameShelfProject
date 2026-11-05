# ADR-041 — Aba de Relatórios

## Contexto

As Estatísticas respondem "como está minha trajetória" com totais, distribuições e
recordes. Faltava uma área para investigar os dados: cruzar sessões, plataformas,
gêneros e estimativas e responder perguntas como "em que jogos gastei essas horas?".

## Decisão

1. Nova view `reports` (`/relatorios`), uma central com categorias. Nesta etapa:
   **Tempo de jogo**, **Conclusões**, **Jornadas e replays**, **Biblioteca e backlog**,
   **Conquistas** e **Comparativos**, entregues em etapas.
2. Cada relatório tem **rota e consulta próprias** (`GET /reports/playtime`,
   `GET /reports/completions`), com filtros validados por Zod nas fronteiras. Não
   existe endpoint único que devolve tudo para o frontend calcular.
3. Os cálculos são funções puras em `apps/api/src/modules/reports`, no mesmo padrão
   do módulo de estatísticas: recebem registros já carregados pelos repositórios e
   são testadas sem banco.
4. Tabelas detalhadas são paginadas e ordenadas no servidor; a exportação CSV busca
   até 500 linhas por vez.
5. Nenhuma tabela nova.

## Definições compartilhadas

- Tempo de jogo = soma das sessões **encerradas**, atribuída ao dia **local** de
  início (`timezoneOffsetMinutes`, mesma regra do mapa de atividade).
- Horas retroativas e tempo informado por plataformas **não** entram no relatório de
  tempo de jogo (não têm data/hora de sessão). No relatório de conclusões, as horas
  reais de um jogo são sessões encerradas + horas retroativas.
- Um jogo conta como zerado no período pela `completedAt`; o funil (iniciados,
  zerados, pausados, abandonados) é o estado atual e não depende do período.
- "Iniciado" = status Jogando, Pausado, Zerado ou Abandonado.

## Consequências

- **Divergência consciente da proposta inicial:** agregar em SQL (`DATE_TRUNC`,
  `GROUP BY`) no PostgreSQL ficou adiado. A base de testes do projeto trabalha com
  repositórios em memória e não há infraestrutura para testar SQL, então a primeira
  entrega segue o padrão existente. Os relatórios carregam jogos e sessões como as
  estatísticas; o custo é aceitável para uma biblioteca pessoal. Se o volume
  crescer, cada builder pode ser trocado por uma consulta agregada sem mudar o
  contrato da API nem a tela.
- Índices em `sessions.started_at` e `sessions.game_id` só passam a importar quando
  essa migração para SQL acontecer.
- Filtros salvos de relatório, exportação em PDF e filtros por desenvolvedora/status
  ficaram fora desta etapa.
