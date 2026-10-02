# Estratégia de Agentes

## Objetivo

Usar agentes de IA para acelerar desenvolvimento sem perder controle arquitetural.

## Fonte de verdade

A ordem de autoridade é:

1. `AGENTS.md`
2. documentação de produto
3. documentação de arquitetura
4. ADRs
5. código e testes existentes
6. instruções específicas da tarefa

## Papéis

### Implementador

Implementa uma feature específica.

Deve:
- entender a especificação;
- propor plano;
- alterar somente o necessário;
- criar testes;
- executar verificações.

### Revisor

Não deve reimplementar automaticamente.

Deve procurar:
- violações de arquitetura;
- bugs;
- casos extremos;
- regressões;
- problemas de segurança;
- testes ausentes.

### QA

Concentra-se em comportamento observável e testes E2E.

## Regra

Um agente não deve assumir que uma feature futura existe.

## Commits

Preferir commits pequenos e semanticamente claros.

Exemplo:

`feat(sessions): add session creation`

`test(sessions): cover invalid end time`

`fix(planning): prevent division by zero`

## Pull requests

Mesmo em projeto pessoal, manter descrição curta:

- objetivo;
- mudanças;
- testes;
- riscos;
- pendências.
