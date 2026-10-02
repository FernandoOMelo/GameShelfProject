CREATE TYPE "public"."game_priority" AS ENUM('LOW', 'NORMAL', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_url" text,
	"background_url" text,
	"release_year" integer,
	"developer" text,
	"publisher" text,
	"status" "game_status" DEFAULT 'BACKLOG' NOT NULL,
	"priority" "game_priority" DEFAULT 'NORMAL' NOT NULL,
	"estimated_main_hours" numeric(8, 2),
	"estimated_completionist_hours" numeric(8, 2),
	"personal_estimated_hours" numeric(8, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_title_not_blank" CHECK (length(trim("games"."title")) > 0),
	CONSTRAINT "games_release_year_valid" CHECK ("games"."release_year" IS NULL OR "games"."release_year" BETWEEN 1 AND 9999),
	CONSTRAINT "games_estimated_main_hours_nonnegative" CHECK ("games"."estimated_main_hours" IS NULL OR "games"."estimated_main_hours" >= 0),
	CONSTRAINT "games_estimated_completionist_hours_nonnegative" CHECK ("games"."estimated_completionist_hours" IS NULL OR "games"."estimated_completionist_hours" >= 0),
	CONSTRAINT "games_personal_estimated_hours_nonnegative" CHECK ("games"."personal_estimated_hours" IS NULL OR "games"."personal_estimated_hours" >= 0)
);
