DROP INDEX "dlcs_linked_game_idx";--> statement-breakpoint
ALTER TABLE "dlcs" DROP CONSTRAINT "dlcs_linked_game_not_base";--> statement-breakpoint
ALTER TABLE "dlcs" DROP CONSTRAINT "dlcs_linked_game_id_games_id_fk";--> statement-breakpoint
ALTER TABLE "dlcs" DROP COLUMN "linked_game_id";
