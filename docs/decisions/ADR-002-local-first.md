# ADR-002 — Self-hosted e local-first

## Status

Aceito

## Contexto

O sistema será usado inicialmente por uma única pessoa em uma rede doméstica.

## Decisão

O MVP será self-hosted e acessível pela rede local.

Não haverá dependência obrigatória de serviços externos para as funcionalidades básicas.

## Consequências

- PostgreSQL local;
- aplicação local;
- dados pertencem ao usuário;
- integração com metadata será opcional;
- o sistema deve continuar funcionando se a internet estiver indisponível.

## Futuro

Poderá existir acesso remoto seguro, mas isso não faz parte do MVP.
