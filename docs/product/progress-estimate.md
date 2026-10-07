# Estimativa de progresso

## Data de referência

2026-10-02

Esta estimativa acompanha o estado do roadmap e dos critérios documentados. Percentuais medem escopo funcional entregue, não esforço restante nem tempo de calendário. Itens recebem peso aproximado por área para evitar tratar cada checkbox como tendo o mesmo tamanho.

## Até o MVP

**Estimativa atual: 100% dos critérios documentados do MVP implementados e validados.**

| Área | Peso | Entrega estimada | Evidência |
|---|---:|---:|---|
| Fundação, execução local e qualidade | 10% | 100% | Monorepo, Compose, migrations, lint, testes, typecheck, build e execução containerizada validados. |
| Biblioteca e metadados manuais | 25% | 100% | Cadastro, listagem, busca, detalhes, edição, exclusão, campos manuais e filtros por status/prioridade. |
| Planejamento por jogo | 10% | 100% | Status, prioridade e estimativas persistidos e editáveis; meta semanal configurável. |
| Sessões | 15% | 100% | Criação, edição, exclusão, histórico, duração calculada, progresso e localização. |
| Fila | 15% | 100% | Adicionar, remover, ordenar e consultar posição; jogos concluídos/abandonados não entram. |
| Dashboard | 15% | 100% | Jogo atual, sessões, progresso, backlog, fila, estatísticas, meta semanal e previsão. |
| Uso em celular | 10% | 100% | Layout responsivo, acesso ao jogo atual, formulário de sessão e consulta da fila. |
| **Total ponderado** | **100%** | **100%** | Critérios de aceite do MVP e execução via Docker Compose foram verificados. |

O MVP está implementado conforme o escopo documentado. Metadata externa não bloqueia esse marco: sua especificação define essa integração como futura e não obrigatória para o MVP inicial.

## Até a versão 1.0

**O projeto ainda não tem uma definição documentada de “versão 1.0”; portanto, não há um percentual único confiável para esse marco.** A seção “Depois do MVP” lista ideias a avaliar com base no uso real, sem dizer quais entram na versão 1.0.

Como referência provisória, se a 1.0 significar concluir as Fases 0–6 do roadmap — incluindo integração de metadata opcional —, o progresso atual é de aproximadamente **100%**. As Fases 0–6 estão concluídas, incluindo busca IGDB, revisão de metadata e armazenamento local de capas e artworks. O valor cai se a 1.0 incluir itens da lista pós-MVP, como Steam, PWA offline, autenticação ou acesso remoto.

## Recalibração

Recalcular ao decidir o escopo da versão 1.0. A estimativa deve acompanhar aceite funcional e qualidade, não somente tarefas marcadas no roadmap.
