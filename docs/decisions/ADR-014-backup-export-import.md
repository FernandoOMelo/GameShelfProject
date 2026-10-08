# ADR-014: exportação, importação e backup

## Status

Aceito.

## Contexto

Os dados vivem só no PostgreSQL e no volume de mídia do Docker. Perder o volume
perde a biblioteca inteira. Faltava uma forma de tirar os dados do sistema e de
restaurá-los.

## Decisão

Dois mecanismos complementares:

1. **Exportação/importação em JSON** (`GET /backup/export`, `POST /backup/import`),
   para portabilidade e conferência humana.
2. **Script de backup físico** (`scripts/backup.ps1`): `pg_dump` do banco mais cópia
   do volume de mídia, para recuperação completa.

Regras da exportação/importação:

- O arquivo é `{ app: "gameshelf", version: 1, exportedAt, data }` e usa as mesmas
  formas da API (jogos com `genreIds`, números como números). `data` traz franquias,
  plataformas, gêneros, jogos, sessões, imagens de sessão, fila, listas, missão
  principal, metas e a meta semanal. `version` só muda se o formato quebrar.
- A exportação **compõe os repositórios existentes**; não há SQL novo para ler.
- A importação é validada por Zod (`backupSchema`, estrito: campo desconhecido é
  erro) e por `findBackupIssues`, que checa ids repetidos, nomes únicos e referências
  entre coleções, devolvendo até 20 problemas legíveis.
- **Só importa em biblioteca vazia** (sem jogos, franquias, plataformas, gêneros,
  listas ou metas): 409 caso contrário. Mesclar exigiria regras de conflito que o
  uso pessoal não justifica. Para restaurar sobre dados existentes, o caminho é
  o `pg_restore` do script de backup.
- Os ids são **preservados**, então referências (inclusive URLs de mídia) continuam
  válidas. A gravação é uma única transação: qualquer erro do banco, como uma
  constraint, desfaz tudo (422, sem detalhes internos na resposta).
- O corpo aceita até 64 MiB nessa rota; as demais mantêm o limite padrão.
- **Imagens não vão no JSON.** O arquivo guarda apenas as URLs locais; os arquivos
  vêm do volume de mídia, copiado pelo script de backup.

## Consequências

- Exportação e importação preservam os dados: validado em Postgres real com uma
  ida e volta (exportar, importar em outro banco, exportar de novo) byte a byte igual,
  além da falha atômica e da recusa em biblioteca não vazia.
- Quem adicionar uma tabela precisa incluí-la em `BackupData`, na exportação, na
  verificação de integridade e no importador.
- `scripts/backup.ps1` exige Docker Compose e o container da API em execução.
