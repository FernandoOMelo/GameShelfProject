-- Registra quanto do tempo informado pela plataforma já virou horas retroativas
-- do jogo (ADR-026). Aditiva e com valor padrão: nenhuma associação existente
-- muda de comportamento, e todas começam com nada lançado, que é a verdade.
ALTER TABLE "game_platforms" ADD COLUMN "external_playtime_imported_minutes" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_imported_nonnegative" CHECK ("game_platforms"."external_playtime_imported_minutes" >= 0);
