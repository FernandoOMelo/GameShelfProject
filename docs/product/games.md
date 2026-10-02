# Jogos

## Objetivo

Representar jogos pertencentes à biblioteca pessoal.

## Campos

### Identidade

- `id`
- `title`
- `description`

### Visual

- `coverUrl`
- `backgroundUrl`

### Metadata

- `releaseYear`
- `developer`
- `publisher`
- `franchiseId`

### Planejamento

- `status`
- `priority`
- `estimatedMainHours`
- `estimatedCompletionistHours`
- `personalEstimatedHours`

### Usuário

- `notes`

## Status

- `BACKLOG`
- `QUEUED`
- `PLAYING`
- `PAUSED`
- `COMPLETED`
- `ABANDONED`

## Prioridade

Inicialmente:

- `LOW`
- `NORMAL`
- `HIGH`

Não criar sistema de pontuação ou ranking no MVP.

## Regras

- título é obrigatório;
- título não pode ser vazio;
- horas estimadas não podem ser negativas;
- estimativas podem ser nulas;
- progresso não pertence ao jogo como dado editável isolado; o progresso atual deve ser derivado ou atualizado de forma consistente com as sessões;
- excluir um jogo deve exigir tratamento explícito das sessões e itens de fila relacionados.

## Futuro

Integração com IGDB poderá preencher metadata automaticamente.

## Implementação inicial

A biblioteca oferece criação, listagem, edição, exclusão, busca por título e filtros por status e prioridade. Franquias são entidades com nome único após remoção de espaços nas pontas; cada jogo pode ter zero ou uma franquia e uma franquia pode pertencer a vários jogos. Plataformas e gêneros também são entidades com nome único e relação muitos-para-muitos com jogos. Excluir um jogo remove suas sessões, relações de plataforma/gênero e entrada de fila por cascata no banco; a interface solicita confirmação porque a operação também apaga o histórico de sessões.
