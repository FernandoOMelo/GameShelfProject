-- Captura automática de metadados (ADR-043).
CREATE TABLE "game_metadata_sync" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"checked_title" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_metadata_sync_status_valid" CHECK ("game_metadata_sync"."status" IN ('APPLIED_AUTO', 'NEEDS_REVIEW', 'NOT_FOUND', 'CONFIRMED', 'IGNORED'))
);--> statement-breakpoint
ALTER TABLE "game_metadata_sync" ADD CONSTRAINT "game_metadata_sync_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_metadata_sync_status_idx" ON "game_metadata_sync" USING btree ("status");
