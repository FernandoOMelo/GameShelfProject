-- Os valores novos do enum goal_kind não podem ser removidos; as metas que os usam são apagadas.
DELETE FROM "goals" WHERE "kind"::text NOT IN ('COMPLETED_GAMES', 'PLAYED_HOURS');--> statement-breakpoint
DROP TABLE "missions";--> statement-breakpoint
DROP INDEX "goals_kind_period_year_month_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "goals_kind_period_year_month_unique" ON "goals" USING btree ("kind","period","year","month");--> statement-breakpoint
ALTER TABLE "goals" DROP CONSTRAINT "goals_list_id_game_lists_id_fk";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "done";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "due_date";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "list_id";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "title";
