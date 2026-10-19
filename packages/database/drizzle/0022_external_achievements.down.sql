-- Rollback do 0022. Executado manualmente (psql), seguido da remoção da entrada
-- `0022_external_achievements` em drizzle/meta/_journal.json e da linha
-- correspondente em drizzle.__drizzle_migrations.
--
-- Perde-se o espelho local das conquistas. Nada de origem local é afetado: elas
-- vêm da fonte externa e voltam na próxima consulta.
DROP TABLE IF EXISTS "external_achievements";
