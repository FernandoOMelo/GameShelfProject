# ADR-040: metas flexíveis, missões múltiplas e saúde das integrações

## Status

Aceita. Substitui o desafio único (`main_challenge`) citado nos ADR-011 e ADR-013.

## Decisão

### Metas
Além de "jogos zerados" e "horas jogadas" (que continuam por ano/mês e únicas por
período), há três tipos sem período, com **data limite livre e opcional**:

- `COMPLETE_LIST`: zerar uma lista (progresso = jogos zerados da lista);
- `SESSION_HOURS`: jogar N horas seguidas (progresso = a **maior** sessão
  encerrada desde a criação da meta, dentro do prazo, e não a soma);
- `CUSTOM`: texto livre, concluída à mão (`PATCH { done }`).

Metas sem período não são únicas. Sem data limite não há "ritmo" a cobrar
(`onTrack` fica verdadeiro). O progresso continua calculado na leitura.

### Missões
Tabela `missions`: várias ativas, uma delas principal (índice único parcial).
Não dependem de lista. Tipos: `LIST`, `GAMES_COUNT` (jogos zerados na janela),
`HOURS` (horas de sessão na janela) e `CUSTOM` (manual). A janela vai de
`starts_on` ao `due_date`. Metas e missões têm propósitos distintos — metas medem
ritmo (ano/mês, ou um alvo pontual); missões são objetivos de médio prazo com um
destaque — e por isso são telas e APIs separadas, mesmo parecidas.

O desafio antigo foi copiado para `missions` como missão principal do tipo `LIST`.
`/challenge`, o backup e a detecção de conclusão na linha do tempo continuam
funcionando por cima de `missions`: `DrizzleMainChallengeRepository` lê a missão
principal de lista e a conclusão é detectada para **toda** missão de lista. A
tabela `main_challenge` fica, sem uso, para rollback.

Backup: `missions` é novo (padrão vazio) e as metas ganham campos opcionais.
Backups antigos importam: o campo `challenge` vira a missão principal.

### Saúde das integrações
`GET /integrations/health` e `POST /integrations/health/:key/test` para IGDB,
RAWG e Achievist: configurada ou não (nunca o valor da credencial), resultado da
última chamada, último sucesso e as variáveis de ambiente que a ligam. As
chamadas reais dos providers são observadas por um proxy, então o estado reflete
o uso de verdade; "Testar" faz uma chamada leve. O estado é em memória (vale
desde que a API subiu).

## Migração

`0030_flexible_goals_and_missions.sql`: novos valores do enum `goal_kind`, colunas
opcionais em `goals`, índice único de período só para as duas metas por período,
tabela `missions` e cópia de `main_challenge`. O rollback apaga as metas dos
tipos novos (valores de enum não podem ser removidos).
