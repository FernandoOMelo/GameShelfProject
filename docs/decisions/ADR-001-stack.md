# ADR-001 — Stack inicial

## Status

Aceito

## Contexto

O projeto será desenvolvido como aplicação web self-hosted, com uso principal em PC e celular.

O desenvolvedor já possui experiência com TypeScript, PostgreSQL e Docker.

## Decisão

Adotar inicialmente:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Fastify
- PostgreSQL
- Drizzle ORM
- Zod
- Vitest
- Playwright
- Docker Compose

## Motivos

### TypeScript

Permite compartilhar tipos e schemas entre frontend e backend.

### React

Adequado para uma interface rica em biblioteca, dashboard e formulários.

### Fastify

Leve e apropriado para uma API self-hosted.

### PostgreSQL

Robusto e já conhecido pelo desenvolvedor.

### Drizzle

Permite trabalhar com schema tipado sem introduzir uma camada excessivamente pesada.

### Zod

Permite validar entradas e compartilhar contratos.

### Docker

Facilita instalação e reprodução do ambiente.

## Consequências

A aplicação ficará fortemente orientada a TypeScript.

A escolha não é irreversível. Mudanças futuras devem possuir ADR.
