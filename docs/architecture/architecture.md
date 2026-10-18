# Arquitetura

## Visão

Aplicação web self-hosted composta por frontend, API, PostgreSQL e armazenamento
local de arquivos de mídia.

```text
Browser
  |
  v
Frontend React
  |
  v
Fastify API
  |             \
  v              v
PostgreSQL     Filesystem local (imagens)
```

## Monorepo

```text
apps/
  web/
  api/
  mobile/

packages/
  contracts/
  database/
  ui/
  config/
```

`apps/mobile` é um app Flutter (Dart) que consome a mesma API HTTP. Não compartilha
os pacotes TypeScript: os contratos são reimplementados à mão nos seus models, então
mudanças em `packages/contracts` que afetem as rotas que ele usa precisam ser
replicadas lá. Ver ADR-016.

## Frontend

Responsabilidades:

- apresentação;
- interação;
- estado de interface;
- chamadas à API;
- validação de formulário para feedback rápido.

Não deve conter regras críticas de negócio como fonte única de verdade.

## Backend

Responsabilidades:

- regras de negócio;
- validação;
- autorização futura;
- acesso ao banco;
- cálculos;
- integração com serviços externos.

## Banco

PostgreSQL é a fonte persistente de dados.

Todas as alterações de schema devem ocorrer por migrations.

Imagens importadas ficam em filesystem local persistido por volume do Docker;
suas URLs locais são armazenadas nos campos de capa e background do jogo. Veja
ADR-005.

## Contratos

Schemas Zod compartilhados devem definir:

- payloads de entrada;
- respostas;
- enums relevantes.

## Domínio

O domínio deve ser organizado por módulos:

- games;
- franchises;
- platforms;
- game-platforms (plataformas e edições associadas a um jogo, ADR-023);
- playthroughs (jornadas e fator replay, ADR-023);
- integrations (importação da fonte externa e fila de correspondências, ADR-024);
- genres;
- sessions;
- backlog;
- game-lists;
- planning;
- goals;
- backup;
- dashboard.

## Integrações

Integrações externas devem ficar isoladas em infraestrutura. Dados de
plataformas de jogos vêm exclusivamente da API do Achievist self-hosted, por
rede Docker privada e comunicação servidor a servidor (ADR-024); o GameShelf não
implementa conector direto para Steam, PlayStation ou Xbox. É o caso de:

```text
modules/games
  |
  +-- application
  +-- domain
  +-- infrastructure
        |
        +-- igdb
        +-- howlongtobeat

modules/integrations
  |
  +-- achievist   (cliente isolado: URL base, login por cookie, paginação)
  +-- external-library.ts        (a interface que o resto da API consome)
  +-- import-service.ts          (importação idempotente e fila de pendências)
  +-- sync-runner.ts             (uma rodada por vez; estado no processo)
  +-- routes.ts                  (sincronização manual e confirmação)
```

A interface `ExternalLibraryProvider` fala o vocabulário do GameShelf: o resto da
API não conhece endpoint, cookie ou chave de plataforma da fonte.

A lógica de negócio não deve depender diretamente do SDK de um fornecedor.

## Comunicação

Frontend utiliza HTTP/JSON com a API.

## Deploy

Docker Compose deverá subir:

- web;
- api;
- postgres.

Um reverse proxy poderá ser adicionado depois.

## Rede doméstica

O sistema deve funcionar em um host da rede local e ser acessível por outros dispositivos através do endereço local do host.

## Segurança

Mesmo sendo self-hosted:

- não expor PostgreSQL diretamente;
- segredos devem estar em `.env`;
- não versionar credenciais;
- validar entradas no backend;
- evitar execução de conteúdo fornecido pelo usuário.
