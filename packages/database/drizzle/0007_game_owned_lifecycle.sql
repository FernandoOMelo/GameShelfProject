ALTER TABLE "games" ADD COLUMN "platform_id" uuid;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "owned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "started_at" date;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "completed_at" date;
--> statement-breakpoint
WITH ranked_platforms AS (
  SELECT
    "game_id",
    "platform_id",
    "owned",
    "status",
    "started_at",
    "completed_at",
    row_number() OVER (
      PARTITION BY "game_id"
      ORDER BY CASE "status"
        WHEN 'PLAYING' THEN 1
        WHEN 'PAUSED' THEN 2
        WHEN 'BACKLOG' THEN 3
        WHEN 'QUEUED' THEN 4
        WHEN 'COMPLETED' THEN 5
        WHEN 'ABANDONED' THEN 6
      END,
      "platform_id"
    ) AS "position"
  FROM "game_platforms"
)
UPDATE "games" AS "g"
SET
  "platform_id" = "gp"."platform_id",
  "owned" = "gp"."owned",
  "status" = "gp"."status",
  "started_at" = "gp"."started_at",
  "completed_at" = "gp"."completed_at"
FROM "ranked_platforms" AS "gp"
WHERE "gp"."game_id" = "g"."id" AND "gp"."position" = 1;
--> statement-breakpoint
DROP TABLE "game_platforms" CASCADE;
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_completion_not_before_start" CHECK ("games"."started_at" IS NULL OR "games"."completed_at" IS NULL OR "games"."completed_at" >= "games"."started_at");
