<#
Backup completo do GameShelf com Docker Compose: banco (pg_dump) e volume de midia.

Uso (na raiz do repositorio, com os containers em execucao):
  powershell -File scripts/backup.ps1 [-OutDir backups]

Gera, em OutDir:
  gameshelf-<data>.dump   banco em formato custom do pg_dump (restaure com pg_restore)
  media-<data>/           copia de /app/storage do container da API (capas e screenshots)
#>
param([string]$OutDir = 'backups')

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dump = Join-Path $OutDir "gameshelf-$stamp.dump"
$media = Join-Path $OutDir "media-$stamp"

# Nao usamos $ErrorActionPreference = 'Stop': o Docker escreve progresso em stderr e o PowerShell 5.1 o trataria como erro.
# O dump e gravado dentro do container e copiado: o redirecionamento do PowerShell corromperia o binario.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/gameshelf.dump'
if ($LASTEXITCODE -ne 0) { throw 'pg_dump falhou.' }
docker compose cp postgres:/tmp/gameshelf.dump $dump
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel copiar o dump.' }
docker compose exec -T postgres rm -f /tmp/gameshelf.dump | Out-Null

# Sem o container da API (ex.: desenvolvimento local) a midia nao esta no Docker: avisa, mas mantem o dump.
$partial = $false
docker compose cp api:/app/storage $media
if ($LASTEXITCODE -ne 0) {
  $partial = $true
  Write-Warning 'Volume de midia NAO copiado: nao ha container da API. Copie a pasta de midia manualmente.'
}

Write-Host "Banco:  $dump"
if (-not $partial) { Write-Host "Midia:  $media" }
if ($partial) { exit 2 }
