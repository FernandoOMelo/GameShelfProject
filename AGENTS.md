# GameShelf — AI Development Guide

## Objetivo

GameShelf é uma aplicação pessoal self-hosted para gerenciamento de biblioteca,
backlog, sessões e planejamento de jogos.

A aplicação deve ajudar o usuário a responder:
- O que estou jogando agora?
- Quanto tempo já investi?
- Quanto tempo provavelmente falta?
- Onde parei?
- O que vem depois?
- Quanto tempo meu backlog representa?

## Princípios

1. Não implementar funcionalidades fora do escopo solicitado.
2. O repositório é a fonte da verdade do projeto.
3. Não alterar arquitetura sem registrar uma decisão.
4. Domínio deve permanecer independente de infraestrutura.
5. Regras de negócio devem ser testáveis.
6. Validação deve acontecer nas fronteiras da aplicação.
7. Não duplicar regras de negócio desnecessariamente entre frontend e backend.
8. Não alterar banco manualmente fora das migrations.
9. Não remover testes existentes para fazer uma implementação passar.
10. Evitar abstrações prematuras.
11. Preferir mudanças pequenas, coesas e revisáveis.
12. Não adicionar dependências sem justificar sua necessidade.

## Stack inicial

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Backend: Node.js + TypeScript + Fastify
- Banco: PostgreSQL
- ORM: Drizzle ORM
- Validação: Zod
- Testes: Vitest + Playwright
- Infraestrutura local: Docker Compose

A stack pode mudar, mas mudanças relevantes devem ser registradas em ADR.

## Arquitetura

O projeto é um monorepo:

- `apps/web`: frontend
- `apps/api`: backend
- `packages/contracts`: contratos compartilhados
- `packages/database`: schema, migrations e acesso ao banco
- `packages/ui`: componentes compartilhados
- `packages/config`: configurações compartilhadas
- `docs`: documentação
- `agents`: orientações e prompts para agentes

## Fluxo obrigatório de implementação

Antes de implementar uma feature:

1. Ler este arquivo.
2. Ler a documentação da feature.
3. Ler a arquitetura relevante.
4. Identificar contratos e módulos afetados.
5. Apresentar um plano curto quando a mudança for significativa.
6. Implementar a menor solução coerente.
7. Criar ou atualizar testes.
8. Executar lint, testes e build.
9. Atualizar documentação quando necessário.
10. Resumir arquivos alterados, testes executados e pendências.

## Nunca

- reescrever arquivos inteiros sem necessidade;
- criar uma camada de abstração apenas "para o futuro";
- introduzir uma biblioteca para uma tarefa trivial;
- misturar acesso ao banco diretamente em componentes React;
- colocar regra de negócio importante apenas no frontend;
- modificar uma API pública sem avaliar consumidores;
- ignorar falhas de testes;
- criar dados fictícios permanentes apenas para fazer a UI parecer pronta.

## Definição de pronto

Uma feature é considerada pronta quando:

- atende aos critérios de aceite;
- possui testes adequados;
- não introduz erros no restante do projeto;
- passa lint;
- passa testes;
- passa build;
- documentação relevante está atualizada.

## Regra para agentes

Se houver ambiguidade relevante que possa mudar o domínio ou a arquitetura, pare e peça esclarecimento. Para detalhes de implementação de baixo risco, escolha a solução mais simples compatível com esta documentação e registre decisões importantes.
