-- Rollback do 0021. Executado manualmente (psql), seguido da remoção da entrada
-- `0021_counts_toward_total` em drizzle/meta/_journal.json e da linha
-- correspondente em drizzle.__drizzle_migrations.
--
-- Perde-se apenas quais plataformas o usuário marcou como fonte do total. As
-- horas, locais e externas, continuam onde estavam.
ALTER TABLE "game_platforms" DROP COLUMN IF EXISTS "counts_toward_total";
