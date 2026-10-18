-- Rollback do 0017. O Drizzle não aplica arquivos `.down.sql`: este script é
-- executado manualmente (psql) e precisa ser seguido da remoção da entrada
-- `0017_game_platforms_and_playthroughs` em drizzle/meta/_journal.json e da
-- linha correspondente em drizzle.__drizzle_migrations.
--
-- Nada do histórico anterior ao 0017 é perdido: jogos, sessões, datas e
-- anotações não são tocados. O que se perde é apenas o que foi criado depois
-- da migração — as associações de plataforma e as jornadas, além do vínculo
-- de cada sessão com elas. A plataforma principal de cada jogo continua em
-- `games.platform_id`, que o 0017 não altera.
DROP INDEX IF EXISTS "sessions_playthrough_idx";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_playthrough_id_playthroughs_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_platform_id_platforms_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "playthrough_id";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "platform_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "playthroughs";
--> statement-breakpoint
DROP TABLE IF EXISTS "game_platforms";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."playthrough_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."game_platform_format";
