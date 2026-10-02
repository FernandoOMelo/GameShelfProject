CREATE TABLE "planning_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"weekly_minutes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_settings_singleton_id" CHECK ("planning_settings"."id" = 1),
	CONSTRAINT "planning_settings_weekly_minutes_nonnegative" CHECK ("planning_settings"."weekly_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_entries_game_id_unique" UNIQUE("game_id"),
	CONSTRAINT "queue_entries_position_nonnegative" CHECK ("queue_entries"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;