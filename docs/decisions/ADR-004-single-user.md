# ADR-004 — Modelo de usuário único no MVP

## Status

Aceito

## Contexto

A aplicação é inicialmente uma ferramenta pessoal.

## Decisão

Não implementar autenticação ou múltiplos usuários no MVP.

## Consequências

- menor complexidade;
- implantação simples;
- menor superfície de ataque;
- algumas decisões de arquitetura devem deixar espaço para autenticação futura.

## Restrição

Isso não significa que a API deva assumir que qualquer entrada é confiável. Validação continua obrigatória.
