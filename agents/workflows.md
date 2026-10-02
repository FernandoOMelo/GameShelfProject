# Workflows para Agentes

## Feature pequena

1. Ler `AGENTS.md`.
2. Ler documentação da feature.
3. Inspecionar código relacionado.
4. Planejar.
5. Implementar.
6. Testar.
7. Revisar diff.
8. Atualizar documentação se necessário.

## Feature média ou grande

1. Criar/atualizar especificação.
2. Identificar decisões arquiteturais.
3. Dividir em tarefas verticais.
4. Implementar uma fatia por vez.
5. Testar cada fatia.
6. Integrar somente depois de cada parte estar estável.

## Correção de bug

1. Reproduzir.
2. Criar teste que falha.
3. Corrigir.
4. Confirmar teste.
5. Executar regressão relevante.
6. Documentar somente se houver mudança de comportamento.

## Refatoração

Não misturar com feature sem necessidade.

A refatoração deve:
- preservar comportamento;
- possuir testes suficientes;
- ter escopo limitado;
- explicar o motivo.

## Revisão por outro agente

Após uma feature significativa:

1. enviar diff para revisão;
2. pedir identificação de problemas;
3. corrigir somente problemas confirmados;
4. executar testes novamente.

## Contexto mínimo recomendado para uma tarefa

Fornecer ao agente:

- objetivo;
- arquivo de especificação;
- restrições;
- critérios de aceite;
- arquivos relevantes, quando conhecidos.

Evitar enviar todo o histórico da conversa como contexto.
