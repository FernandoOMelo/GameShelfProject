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

- `priority`
- `estimatedMainHours`
- `estimatedCompletionistHours`
- `personalEstimatedHours`
- `retroactivePlayedHours` (horas acumuladas sem data, lançadas fora de sessões)

### Usuário

- `notes`
- `rating` (1–10; 11 representa “Jogo da Vida”)
- `platformId` (uma plataforma principal, opcional)
- `owned` (posse pessoal, independente do status)
- `startedAt` e `completedAt` (datas da jornada do jogo)

## Status

- `DESIRED` — desejado;
- `BACKLOG`
- `BACKLOG` — exibido como “Na biblioteca”;
- `PLAYING`
- `PAUSED`
- `COMPLETED`
- `ABANDONED`

Arquivamento é uma propriedade separada (`archived`): esconde o jogo das visões
padrão e preserva seu status para quando for desarquivado. A fila também é
independente do status.

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
- cada jogo pode ter uma única plataforma selecionada; essa plataforma representa onde o usuário possui ou está jogando o título, não a lista de plataformas disponíveis no catálogo;
- posse (`owned`), status e datas pertencem ao jogo e não à plataforma;
- datas de início e conclusão podem ser registradas retroativamente;
- a avaliação é única por jogo, independente da plataforma, e aceita valores de 1 a 11;
- a nota só pode ser informada ou alterada quando o jogo está Zerado ou Abandonado; uma nota existente é preservada ao voltar para outro estado;
- a fila exige posse e remove jogos que deixem de ser elegíveis;
- relatórios contam cada jogo uma vez por período, mesmo quando concluído em várias plataformas;
- progresso de sessão não pertence ao jogo como dado editável isolado; o progresso atual deve ser derivado ou atualizado de forma consistente com as sessões;
- horas retroativas somam ao total jogado, ao progresso do jogo e às previsões; em estatísticas por período, jogos zerados sem sessões distribuem as horas retroativas uniformemente (média mensal) entre a data de início e a de conclusão;
- excluir um jogo deve exigir tratamento explícito das sessões e itens de fila relacionados.

## Futuro

Integração com IGDB poderá preencher metadata automaticamente.

## Implementação inicial

A biblioteca oferece criação, listagem, edição, exclusão, busca por título e filtros por status, prioridade, plataforma, gênero, franquia, desenvolvedora, lista e ano de conclusão. A ordenação pode ser por título (padrão), início mais recente ou conclusão mais recente; nas duas últimas, jogos sem a data correspondente vão para o fim. Filtros e ordenação acontecem no cliente, sobre a biblioteca já carregada (ADR-016).

Uma combinação de filtros e ordenação pode ser salva com um nome e reaplicada depois pelo seletor "Filtro salvo". O nome é único. Filtros salvos guardam ids: se a plataforma, o gênero, a franquia ou a lista referenciada for excluída, o filtro deixa de casar com qualquer jogo (ADR-017).

O detalhe do jogo abre com a seção "Onde parei", que resume o diário das sessões mais recentes; ver [Sessões](sessions.md) e ADR-018. "Não sugerir este jogo" tira o jogo da sugestão de próximo jogo sem arquivá-lo: ele continua na biblioteca, nos relatórios e na fila. Os agrupamentos de plataforma, gênero e franquia usam os catálogos já existentes; desenvolvedoras são agrupadas pelos valores usados nos jogos. Os detalhes permitem navegar pela sequência visível da biblioteca, respeitando busca e filtros. Franquias, plataformas e gêneros são entidades de catálogo com nome único; cada jogo pode selecionar no máximo uma plataforma e associar vários gêneros. Horas retroativas podem ser acumuladas sem data no detalhe do jogo e não entram em sessões, painel ou relatórios. Status, posse, datas de gameplay e avaliação pertencem ao jogo. Relatórios anuais e mensais contam jogos únicos por data de conclusão. Excluir um jogo remove suas sessões, relações de gênero e entrada de fila por cascata no banco; a interface solicita confirmação porque a operação também apaga o histórico de sessões.
