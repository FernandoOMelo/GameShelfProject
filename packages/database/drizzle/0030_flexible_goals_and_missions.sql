-- Metas flexíveis e missões múltiplas (ADR-040).
-- Novos tipos de meta, colunas opcionais e a unicidade por período passa a valer
-- só para as metas por período. `main_challenge` é copiado para `missions` como
-- missão principal e deixa de ser usado (a tabela fica, sem uso, para rollback).
ALTER TYPE "public"."goal_kind" ADD VALUE IF NOT EXISTS 'COMPLETE_LIST';--> statement-breakpoint
ALTER TYPE "public"."goal_kind" ADD VALUE IF NOT EXISTS 'SESSION_HOURS';--> statement-breakpoint
ALTER TYPE "public"."goal_kind" ADD VALUE IF NOT EXISTS 'CUSTOM';--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "list_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "goals_kind_period_year_month_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "goals_kind_period_year_month_unique" ON "goals" USING btree ("kind","period","year","month") WHERE "goals"."kind" IN ('COMPLETED_GAMES', 'PLAYED_HOURS');--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"list_id" uuid,
	"target" integer,
	"starts_on" date DEFAULT now() NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missions_kind_valid" CHECK ("missions"."kind" IN ('LIST', 'GAMES_COUNT', 'HOURS', 'CUSTOM')),
	CONSTRAINT "missions_title_not_blank" CHECK (length(trim("missions"."title")) > 0),
	CONSTRAINT "missions_target_positive" CHECK ("missions"."target" IS NULL OR "missions"."target" > 0),
	CONSTRAINT "missions_list_required" CHECK ("missions"."kind" <> 'LIST' OR "missions"."list_id" IS NOT NULL),
	CONSTRAINT "missions_due_not_before_start" CHECK ("missions"."due_date" IS NULL OR "missions"."due_date" >= "missions"."starts_on")
);--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "missions_single_primary" ON "missions" USING btree ("is_primary") WHERE "missions"."is_primary";--> statement-breakpoint
INSERT INTO "missions" ("title", "kind", "list_id", "is_primary", "starts_on")
SELECT "title", 'LIST', "list_id", true, "updated_at"::date FROM "main_challenge";
