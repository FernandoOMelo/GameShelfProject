CREATE TYPE "public"."game_difficulty" AS ENUM('C', 'B', 'A', 'AA', 'AAA');--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "difficulty" "game_difficulty";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_type" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "completion_condition" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_of_year" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_game_of_year_requires_completion" CHECK (NOT "games"."game_of_year" OR "games"."completed_at" IS NOT NULL);--> statement-breakpoint
CREATE TABLE "main_challenge" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"list_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "main_challenge_singleton_id" CHECK ("main_challenge"."id" = 1),
	CONSTRAINT "main_challenge_title_not_blank" CHECK (length(trim("main_challenge"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "main_challenge" ADD CONSTRAINT "main_challenge_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE cascade ON UPDATE no action;
