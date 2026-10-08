# Roadmap

## Fase 0 — Fundação

- [x] monorepo
- [x] Docker Compose
- [x] PostgreSQL
- [x] API
- [x] frontend
- [x] migrations
- [x] lint (executado)
- [x] testes unitários (Vitest executado)
- [x] teste E2E executado no Chrome local (download do Chromium Playwright segue pendente por timeout na CDN)
- [x] typecheck e build (executados)
- [x] documentação de agentes

## Fase 1 — Jogos

- [x] cadastro, listagem e edição de jogos
- [x] biblioteca inicial com busca por título
- [x] página de detalhes
- [x] status
- [x] prioridade
- [x] estimativas
- [x] plataformas
- [x] franquias
- [x] gêneros

## Fase 2 — Sessões

- [x] criação
- [x] edição
- [x] exclusão
- [x] histórico
- [x] cálculo de duração
- [x] progresso
- [x] localização

## Fase 3 — Backlog

- [x] fila
- [x] ordenação
- [x] filtros
- [x] prioridades
- [x] listas pessoais nomeadas de jogos

## Fase 4 — Dashboard

- [x] jogo atual
- [x] horas
- [x] progresso
- [x] backlog
- [x] estatísticas
- [x] previsão

## Fase 5 — Mobile

- [x] layout responsivo
- [x] registro rápido
- [x] consulta de fila

## Fase 6 — Metadata

- [x] provider interface
- [x] integração IGDB (busca de candidatos pela API)
- [x] importação e armazenamento local de capas e artworks
- [x] importação de metadata com revisão antes de salvar

## Fase 7 — Estatísticas

- [x] dificuldade, tipo, condição de zeramento, favorito e jogo do ano
- [x] tela de estatísticas (notas, dificuldade, gênero, tipo, plataforma, anos)
- [x] missão principal
- [x] painel redesenhado

Ver [Estatísticas](stats.md) e ADR-010.

## Fase 8 — Evolução (em andamento)

Detalhes em [Plano — Fase 8 em diante](next-phase.md).

- [x] 1. atividade: heatmap e sequências
- [x] 2. replay do ano
- [x] 3. previsão do backlog
- [x] 4. próximo jogo
- [x] 5. metas
- [x] 6. diário de sessão com screenshots
- [ ] 7. múltiplas filas (avaliar antes)
- [ ] 8. exportar, importar e backup
- [ ] 9. PWA offline

## Depois do MVP

O planejamento da experiência e do escopo da versão 1.0 está em
[Blueprint de produto — GameShelf 1.0](v1-blueprint.md).

Avaliar, com base no uso real:

- Steam;
- PWA offline;
- múltiplas filas;
- metas mensais;
- achievements;
- integrações;
- recomendações;
- autenticação;
- acesso remoto.
