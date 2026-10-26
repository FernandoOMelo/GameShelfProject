CREATE TABLE "rawg_game_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL, "rawg_id" integer NOT NULL, "slug" text NOT NULL, "name" text NOT NULL,
  "released" date, "background_image" text, "synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rawg_game_links_slug_not_blank" CHECK (length(trim("rawg_game_links"."slug")) > 0)
);
--> statement-breakpoint
ALTER TABLE "rawg_game_links" ADD CONSTRAINT "rawg_game_links_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "rawg_game_links_game_unique" ON "rawg_game_links" USING btree ("game_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "rawg_game_links_rawg_unique" ON "rawg_game_links" USING btree ("rawg_id");
--> statement-breakpoint
CREATE TABLE "rawg_achievements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "rawg_game_link_id" uuid NOT NULL, "rawg_id" integer NOT NULL,
  "name" text NOT NULL, "description" text, "image_url" text, "percent" numeric(6,3),
  CONSTRAINT "rawg_achievements_name_not_blank" CHECK (length(trim("rawg_achievements"."name")) > 0),
  CONSTRAINT "rawg_achievements_percent_range" CHECK ("rawg_achievements"."percent" IS NULL OR ("rawg_achievements"."percent" >= 0 AND "rawg_achievements"."percent" <= 100))
);
--> statement-breakpoint
ALTER TABLE "rawg_achievements" ADD CONSTRAINT "rawg_achievements_link_fk" FOREIGN KEY ("rawg_game_link_id") REFERENCES "public"."rawg_game_links"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "rawg_achievements_link_rawg_unique" ON "rawg_achievements" USING btree ("rawg_game_link_id", "rawg_id");
--> statement-breakpoint
CREATE INDEX "rawg_achievements_link_idx" ON "rawg_achievements" USING btree ("rawg_game_link_id");
