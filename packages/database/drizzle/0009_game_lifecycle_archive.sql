ALTER TYPE "public"."game_status" ADD VALUE 'DESIRED' BEFORE 'BACKLOG';--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "games" SET "status" = 'BACKLOG' WHERE "status" = 'QUEUED';
--> statement-breakpoint
DELETE FROM "queue_entries" USING "games" WHERE "queue_entries"."game_id" = "games"."id" AND (NOT "games"."owned" OR "games"."status" IN ('COMPLETED', 'ABANDONED'));
--> statement-breakpoint
UPDATE "queue_entries" SET "position" = ranked.new_position FROM (SELECT "id", row_number() OVER (ORDER BY "position", "added_at") - 1 AS new_position FROM "queue_entries") AS ranked WHERE "queue_entries"."id" = ranked."id";
