# GameShelf

Aplicação pessoal self-hosted e local-first para organizar biblioteca, backlog, sessões e planejamento de jogos. Os critérios documentados do MVP estão implementados; metadata externa permanece futura e não é necessária para o MVP.

## Estrutura

- `apps/web`: aplicação React, TypeScript, Vite e Tailwind CSS.
- `apps/api`: API Fastify e configuração de ambiente validada com Zod.
- `packages/contracts`: contratos Zod compartilhados.
- `packages/database`: Drizzle ORM, schema e migrations PostgreSQL.
- `packages/ui`: componentes compartilhados iniciais.
- `packages/config`: configurações TypeScript compartilhadas.
- `docs`, `agents`: especificações, decisões e fluxos de trabalho.

## Requisitos

Node.js 22+ (gerenciado pelo nvm, se usado), npm e Docker Compose. pnpm 10.12.1 é fixado no `package.json`.

## Instalação no Windows com nvm

O fluxo usa o Node selecionado pelo nvm e não requer `corepack enable` global:

```powershell
$env:NPM_CONFIG_CACHE = Join-Path $PWD '.npm-cache'
npm exec --yes --package=pnpm@10.12.1 -- pnpm install
Copy-Item .env.example .env
```

Os comandos pnpm seguintes podem ser executados pelo mesmo `npm exec --yes --package=pnpm@10.12.1 -- pnpm <comando>`; se pnpm já estiver no PATH, use `pnpm <comando>`.

## Desenvolvimento

```sh
pnpm dev
```

Frontend: `http://localhost:5173`; API health check: `http://localhost:3000/health`. O frontend usa `/api` como proxy para evitar diferenças de host na rede local.

## Banco e containers

`docker compose up -d postgres` sobe somente o PostgreSQL para desenvolvimento local. Ele publica a porta `5433` no loopback para evitar conflito com instalações locais de PostgreSQL. Depois aplique as migrations com `pnpm db:migrate` e inicie web/API com `pnpm dev`. Para executar a stack containerizada, `docker compose up --build` sobe PostgreSQL, aplica migrations automaticamente e inicia API e web (`http://localhost:8080`).

Copie `.env.example` para `.env` para personalizar as credenciais. Migrations: `pnpm db:generate` e `pnpm db:migrate`.

## Verificações

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (Vitest: API e frontend)
- `pnpm build`
- `pnpm build` seguido de `pnpm test:e2e` (Playwright; na primeira execução, `pnpm exec playwright install chromium`)

No Windows, se a CDN do Chromium não estiver acessível e Google Chrome já estiver instalado, rode E2E com `$env:GAMESHELF_USE_SYSTEM_CHROME = '1'; pnpm test:e2e`.

## Biblioteca inicial

Com PostgreSQL ativo e migrations aplicadas, a biblioteca permite cadastrar, listar, pesquisar, filtrar, editar e excluir jogos. A API oferece `/games`, `/queue`, `/dashboard`, `/planning/settings`, `/franchises`, `/platforms` e `/genres`; jogos podem ter uma franquia opcional e múltiplas plataformas e gêneros. Na página do jogo é possível registrar, encerrar, editar e excluir sessões. A duração é calculada pela API a partir dos horários de início e término. A fila pode ser ordenada e o painel resume sessões, backlog, jogo atual e previsão semanal.

A estimativa atual de progresso está em [docs/product/progress-estimate.md](docs/product/progress-estimate.md). A definição funcional do MVP está em [docs/product/mvp.md](docs/product/mvp.md).

## Busca de metadata IGDB

### Backup e uso offline

- **Backup:** o Painel exporta e importa os dados em JSON, e `scripts/backup.ps1` copia o banco e o volume de mídia (ver `docs/product/backup.md`).
- **PWA:** o app é instalável e registra sessões sem conexão (ver `docs/product/mobile.md`). O service worker só funciona em HTTPS ou `localhost`.
- Após atualizar o código, rode `docker compose up -d --build` para aplicar as migrations novas (`migrate` roda sozinho).

Opcionalmente, configure `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` no `.env` para habilitar a busca de candidatos de metadata no formulário de jogos. Os resultados são preenchidos para revisão e só são gravados quando o formulário é salvo. Ao salvar, capas e artworks IGDB são baixadas para `MEDIA_STORAGE_PATH`; no Docker Compose, o volume persistente `gameshelf-media` guarda esses arquivos. Sem credenciais, a biblioteca e os demais recursos seguem funcionando normalmente.

A busca de estimativas de tempo usa o HowLongToBeat e não precisa de credenciais: a busca acontece conforme você digita o título e também pelo botão "Buscar tempos (HowLongToBeat)", preenchendo as estimativas principal, pessoal e completista para revisão, sem gravar nada automaticamente. Ao abrir um jogo sem alguma dessas estimativas, o HowLongToBeat é consultado sozinho (ver `docs/decisions/ADR-019-howlongtobeat-time-estimates.md`).

## Primeira execução passo a passo

1. Selecione Node.js 22 ou superior no nvm e instale as dependências: `pnpm install` (no PowerShell, use o comando via `npm exec` descrito acima se pnpm não estiver no PATH).
2. Copie `.env.example` para `.env`.
3. Inicie o PostgreSQL: `docker compose up -d postgres`.
4. Aplique as migrations: `pnpm db:migrate`.
5. Inicie API e frontend: `pnpm dev`.
6. Abra `http://localhost:5173`; verifique `http://localhost:3000/health`.
7. Para testar o projeto, em outro terminal execute `pnpm test`, `pnpm lint`, `pnpm typecheck` e `pnpm build`.

Como alternativa aos passos 3–5, `docker compose up --build` sobe o ambiente completo em containers, aplica as migrations e publica a aplicação em `http://localhost:8080`.

## Stack

React, TypeScript, Vite, Tailwind CSS v4, Fastify, PostgreSQL, Drizzle ORM, Zod, Vitest, Playwright e Docker Compose. `packages/ui` inicia a base de componentes; a configuração do gerador shadcn/ui poderá ser feita quando componentes de produto forem necessários.
