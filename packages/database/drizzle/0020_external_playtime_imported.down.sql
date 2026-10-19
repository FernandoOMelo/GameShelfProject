-- Rollback do 0020. Executado manualmente (psql), seguido da remoção da entrada
-- `0020_external_playtime_imported` em drizzle/meta/_journal.json e da linha
-- correspondente em drizzle.__drizzle_migrations.
--
-- Perde-se o registro do que já foi lançado como horas retroativas. As horas em
-- si continuam no jogo: elas vivem em `games.retroactive_played_hours`, que esta
-- migração não toca. Sem a coluna, um novo lançamento voltaria a somar tudo.
ALTER TABLE "game_platforms" DROP CONSTRAINT IF EXISTS "game_platforms_imported_nonnegative";
--> statement-breakpoint
ALTER TABLE "game_platforms" DROP COLUMN IF EXISTS "external_playtime_imported_minutes";
