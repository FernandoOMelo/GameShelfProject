ALTER TABLE "game_platforms" ADD COLUMN "owned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "status" "game_status" DEFAULT 'BACKLOG' NOT NULL;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "started_at" date;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "completed_at" date;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "rating" integer;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_completion_not_before_start" CHECK ("game_platforms"."started_at" IS NULL OR "game_platforms"."completed_at" IS NULL OR "game_platforms"."completed_at" >= "game_platforms"."started_at");
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_rating_valid" CHECK ("games"."rating" IS NULL OR "games"."rating" BETWEEN 1 AND 11);
--> statement-breakpoint
UPDATE "game_platforms" AS "gp"
SET "status" = "games"."status"
FROM "games"
WHERE "gp"."game_id" = "games"."id";
