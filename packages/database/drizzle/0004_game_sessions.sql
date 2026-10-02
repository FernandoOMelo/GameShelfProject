CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"progress" integer,
	"location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_ended_at_not_before_started_at" CHECK ("sessions"."ended_at" IS NULL OR "sessions"."ended_at" >= "sessions"."started_at"),
	CONSTRAINT "sessions_progress_valid" CHECK ("sessions"."progress" IS NULL OR "sessions"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;