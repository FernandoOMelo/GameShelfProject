# Metadata Externa

## Status

Opcional e fora dos critérios obrigatórios do MVP. A busca IGDB com revisão antes
de salvar e o armazenamento local de imagens já estão implementados.

## Objetivo

Permitir buscar um jogo e importar metadata em vez de preencher tudo manualmente.

## Fonte candidata

IGDB.

## Dados possíveis

- título;
- descrição;
- capa;
- artwork;
- screenshots;
- ano;
- desenvolvedora;
- publisher;
- gêneros;
- plataformas;
- franquia.

## Princípios

A integração externa não deve ser requisito para consultar a biblioteca já cadastrada.

Dados importados devem ser armazenados localmente.

O usuário deve poder corrigir dados importados.

## Arquitetura

```text
Game Module
    |
    +-- Metadata Provider Interface
             |
             +-- IGDB Adapter
             +-- Future Provider
```

A regra de negócio não deve depender diretamente da API da IGDB.

## Busca IGDB

A API expõe `GET /metadata/games?query=...` quando `IGDB_CLIENT_ID` e
`IGDB_CLIENT_SECRET` estão configurados no ambiente. A busca retorna até dez
candidatos normalizados. No formulário da biblioteca, o usuário pode escolher
um candidato, revisar os campos preenchidos e salvar o jogo pela ação normal;
nenhum resultado é gravado automaticamente. Sem as duas credenciais, o endpoint
responde `503` e a biblioteca local continua disponível. Configure as duas
variáveis no `.env` local antes de iniciar o ambiente. Ao salvar um jogo com
capa ou artwork do IGDB, a API baixa as imagens para `MEDIA_STORAGE_PATH` (por
padrão `.gameshelf/media` relativo ao diretório `apps/api`, independentemente
da pasta de onde a API foi iniciada) e
armazena URLs locais no PostgreSQL. O volume `gameshelf-media` do Docker Compose
preserva os arquivos entre reinicializações. Downloads são limitados a 8 MiB por
imagem e aceitam JPEG, PNG e WebP. Veja ADR-005.

Quando o IGDB fornecer localização para pt-BR, o título importado prioriza essa
versão, com fallback ao título original. A localização do IGDB fornece o nome
localizado; a descrição, desenvolvedora, publicadora, gêneros e plataformas
continuam usando os campos padrão retornados pelo serviço.
