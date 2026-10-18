-- Rollback manual da 0018. O Drizzle não aplica arquivos `.down.sql`: rode este
-- script e remova a entrada do journal e da tabela de controle das migrations.
-- Descarta apenas a fila de pendências; nenhum dado da biblioteca é tocado.
DROP TABLE IF EXISTS "external_game_matches";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."external_match_status";
