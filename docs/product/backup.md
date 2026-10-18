# Backup

O backup inclui as plataformas associadas e as jornadas, e as sessões carregam
jornada e plataforma (ADR-023). As coleções novas têm padrão vazio, então um
arquivo gerado antes dessa mudança continua importável., exportação e importação

Decisões e motivos em ADR-014.

## Exportar e importar (JSON)

No Painel, o cartão **Backup dos dados**:

- **Exportar dados** baixa `gameshelf-backup-AAAA-MM-DD.json` (`GET /backup/export`).
- **Importar backup** envia um arquivo exportado (`POST /backup/import`). Só funciona em
  uma **biblioteca vazia**; com dados existentes a API responde 409 e nada muda.

O arquivo inclui franquias, plataformas, gêneros, jogos, sessões, imagens de sessão
(somente as URLs), fila, listas, missão principal, metas e a meta semanal. Os ids
são preservados. A importação valida o formato, ids repetidos e referências entre
coleções antes de gravar e é atômica: se algo falhar, nada é gravado.

Respostas de `POST /backup/import`:

| Código | Significado |
| --- | --- |
| 201 | Importado. Corpo traz as contagens. |
| 400 | Não é um backup do GameShelf, tem campos desconhecidos ou referências inconsistentes (`problems` lista até 20). |
| 409 | A biblioteca já tem dados. |
| 422 | O banco recusou os dados (por exemplo, uma constraint). Nada foi gravado. |

**As imagens (capas e screenshots) não vão no JSON**, só as URLs. Restaure os arquivos
do volume de mídia junto com o JSON.

## Backup completo (banco + mídia)

Com Docker Compose, na raiz do repositório:

```powershell
powershell -File scripts/backup.ps1            # grava em ./backups
powershell -File scripts/backup.ps1 -OutDir D:\Backups\gameshelf
```

Gera `gameshelf-<data>.dump` (formato custom do `pg_dump`) e `media-<data>/` (cópia de
`/app/storage` do container da API). Se não houver container da API (desenvolvimento
local), o dump é feito, a mídia é pulada com um aviso e o script sai com código 2.
A pasta `backups/` é ignorada pelo Git.

### Restaurar

```powershell
# banco (substitui o conteúdo atual)
docker compose cp backups/gameshelf-<data>.dump postgres:/tmp/restore.dump
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump'

# mídia
docker compose cp backups/media-<data>/. api:/app/storage
```

Faça o backup antes de atualizar a imagem ou rodar migrations novas.
