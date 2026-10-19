# Contributing

Obrigado por querer contribuir com o GameShelf! Este documento descreve o fluxo básico de contribuições, convenções de commits e como preparar PRs.

## Como contribuir

1. Faça um fork (se necessário) e crie uma branch a partir de `master` com nome `feat/...`, `fix/...` ou `chore/...`.
2. Mantenha commits pequenos e focados. Use mensagens no formato Conventional Commits (ex.: `feat(sessions): add session creation`).
3. Rode as verificações locais antes de abrir PR:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gameshelf/ui build
```

4. Abra um Pull Request descrevendo objetivo, mudanças, testes e riscos.

## Convenção de commits
Usamos Conventional Commits para permitir versionamento automático com ferramentas como semantic-release.
Exemplos:

- feat(ui): add button component
- fix(api): avoid crash when queue is empty
- chore(deps): update dependency foo to ^1.2.3

## Revisão e Pull Requests
- PRs devem incluir testes quando mudam comportamento.
- Peça review de quem mantém a área (veja CODEOWNERS).

Obrigado!
