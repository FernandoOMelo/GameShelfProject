-- Rollback do 0023. Executado manualmente (psql), seguido da remoção da entrada
-- `0023_external_playtime_imports` em drizzle/meta/_journal.json e da linha
-- correspondente em drizzle.__drizzle_migrations.
--
-- Perde-se o histórico de lançamentos. As horas já lançadas permanecem em
-- games.retroactive_played_hours; o que se perde é a memória de quando cada
-- lançamento aconteceu.
ALTER TABLE "game_platforms" DROP CONSTRAINT IF EXISTS "game_platforms_activity_window";
ALTER TABLE "game_platforms" DROP CONSTRAINT IF EXISTS "game_platforms_activity_days_nonnegative";
ALTER TABLE "game_platforms" DROP COLUMN IF EXISTS "external_activity_days";
ALTER TABLE "game_platforms" DROP COLUMN IF EXISTS "external_activity_ended_at";
ALTER TABLE "game_platforms" DROP COLUMN IF EXISTS "external_activity_started_at";
DROP TABLE IF EXISTS "external_playtime_imports";
