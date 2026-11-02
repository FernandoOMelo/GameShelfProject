# ADR-033: Vínculo da franquia com o IGDB e jogos irmãos

## Status

Aceito.

## Contexto

A franquia local era só um nome. Ao cadastrar um jogo pela busca de metadata, o IGDB
já informa a franquia, mas esse vínculo se perdia, e não havia como descobrir quais
outros jogos da série faltavam na biblioteca.

## Decisão

1. `franchises.igdb_franchise_id` (único, opcional) guarda o id da franquia no IGDB. É
   preenchido ao salvar um jogo vindo da busca de metadata, ou por
   `PATCH /franchises/:id/igdb-link`.
2. `GET /franchises/:id/igdb-games` devolve os jogos da franquia no IGDB e marca os que
   já estão na biblioteca, cruzando por título normalizado (`inLibrary`,
   `libraryGameId`, `libraryGameStatus`). Sem vínculo, devolve lista vazia; sem
   credenciais do IGDB, responde 503.
3. O cruzamento é só uma indicação: nada é criado sozinho. O atalho "Adicionar" abre o
   formulário de cadastro com o título preenchido.

## Consequências

- Migração `0027`. A lista de irmãos não é cacheada no banco: vem ao vivo do IGDB.
- Dois títulos locais com o mesmo nome normalizado apontam para o mesmo candidato; a
  ambiguidade fica visível, não é resolvida.
