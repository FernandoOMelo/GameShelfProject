# Sessões

## Objetivo

Registrar cada período em que o usuário jogou.

## Campos

- `id`
- `gameId`
- `startedAt`
- `endedAt`
- `progress`
- `location`
- `notes`
- `createdAt`
- `updatedAt`

## Regras

1. Uma sessão pertence a exatamente um jogo.
2. `startedAt` é obrigatório.
3. `endedAt` é obrigatório para uma sessão finalizada.
4. `endedAt` não pode ser anterior a `startedAt`.
5. A duração é calculada pelo backend.
6. O cliente não deve ser a fonte de verdade da duração.
7. `progress` deve estar entre 0 e 100 quando informado.
8. `location` pode ser vazia.
9. `notes` pode ser vazia.
10. Uma sessão não deve ter duração negativa.
11. O usuário pode excluir uma sessão; uma sessão inexistente ou pertencente a outro jogo retorna não encontrado.

## Registro rápido

No celular, o fluxo prioritário é:

1. selecionar jogo;
2. informar duração ou início/fim;
3. informar onde parou;
4. opcionalmente informar progresso;
5. salvar.

## Cálculos

### Tempo jogado

Soma das durações das sessões válidas do jogo.

No cadastro inicial, a duração de uma sessão finalizada é calculada pela API em minutos completos a partir de `startedAt` e `endedAt`. Uma sessão sem `endedAt` permanece em andamento e ainda não contribui para a duração.

### Tempo total da biblioteca

Soma das sessões de todos os jogos.

### Progresso

No MVP, o progresso atual pode ser associado à sessão mais recente que possuir progresso informado.

Uma implementação futura poderá tratar progresso por capítulos, objetivos ou eventos.

## Implementação inicial

A página de detalhes do jogo permite registrar, editar e excluir sessões, encerrar sessões em andamento e consultar o histórico. A API calcula a duração e limita cada operação ao jogo da rota.
