# Metadata Externa

## Status

Futuro, não obrigatório para o MVP inicial.

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

## Arquitetura futura

```text
Game Module
    |
    +-- Metadata Provider Interface
             |
             +-- IGDB Adapter
             +-- Future Provider
```

A regra de negócio não deve depender diretamente da API da IGDB.
