# Metadata Externa

## Status

Opcional e fora dos critérios obrigatórios do MVP. A busca IGDB com revisão antes
de salvar, o armazenamento local de imagens e a busca de estimativas de tempo do
HowLongToBeat já estão implementados.

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
    |        |
    |        +-- IGDB Adapter
    |        +-- Future Provider
    |
    +-- Time Estimate Provider Interface
             |
             +-- HowLongToBeat Adapter
```

A regra de negócio não deve depender diretamente da API da IGDB nem do site do
HowLongToBeat.

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

## Estimativas de tempo (HowLongToBeat)

A API expõe `GET /metadata/time-estimates?query=...`, que consulta o HowLongToBeat e
devolve até dez candidatos com `mainHours`, `mainExtraHours` e `completionistHours`
(em horas, convertidas dos segundos do site) e, quando disponível, `releaseYear`.
Diferente do IGDB, não exige credenciais e fica sempre disponível.

No formulário da biblioteca, o botão "Buscar tempos (HowLongToBeat)" usa o título
digitado, mostra os candidatos e, escolhido um, preenche **Estimativa principal** e
**Estimativa completista** para revisão. "História principal + extras" aparece como
referência e não é gravado. A **Estimativa pessoal** nunca é preenchida
automaticamente: é a adaptação do usuário e tem precedência (ADR-003).

O HowLongToBeat não tem API pública; o cliente descobre o endpoint no build do site e
renova um token de curta duração. Se o site mudar ou bloquear a requisição, a busca
responde `502` e o restante da biblioteca continua normal. Sem provedor configurado,
a rota responde `503`. Veja ADR-019.
