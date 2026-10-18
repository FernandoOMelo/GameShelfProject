-- Rollback do 0019. Executado manualmente (psql), seguido da remoção da entrada
-- `0019_platform_groups` em drizzle/meta/_journal.json e da linha correspondente
-- em drizzle.__drizzle_migrations.
--
-- Perde-se apenas a hierarquia: cada plataforma volta a ser independente, com o
-- mesmo id e nome. Nenhum jogo, associação, sessão ou jornada é afetado.
DROP INDEX IF EXISTS "platforms_parent_idx";
--> statement-breakpoint
ALTER TABLE "platforms" DROP CONSTRAINT IF EXISTS "platforms_parent_not_self";
--> statement-breakpoint
ALTER TABLE "platforms" DROP CONSTRAINT IF EXISTS "platforms_parent_id_platforms_id_fk";
--> statement-breakpoint
ALTER TABLE "platforms" DROP COLUMN IF EXISTS "parent_id";
