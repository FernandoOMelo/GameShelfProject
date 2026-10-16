CREATE TABLE "challenge_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"list_id" uuid,
	"games_count" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_completions_games_count_positive" CHECK ("challenge_completions"."games_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "challenge_completions" ADD CONSTRAINT "challenge_completions_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_completions_list_games_count_unique" ON "challenge_completions" USING btree ("list_id","games_count");--> statement-breakpoint
INSERT INTO "challenge_completions" ("title", "list_id", "games_count", "completed_at")
SELECT "mc"."title", "mc"."list_id", COUNT("gle"."game_id")::integer, MAX("g"."completed_at")::timestamptz
FROM "main_challenge" "mc"
JOIN "game_list_entries" "gle" ON "gle"."list_id" = "mc"."list_id"
JOIN "games" "g" ON "g"."id" = "gle"."game_id"
GROUP BY "mc"."title", "mc"."list_id"
HAVING COUNT("gle"."game_id") > 0
	AND COUNT("gle"."game_id") = COUNT(CASE WHEN "g"."status" = 'COMPLETED' AND "g"."completed_at" IS NOT NULL THEN 1 END)
ON CONFLICT DO NOTHING;
