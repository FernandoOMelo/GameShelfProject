-- Conquistas trazidas da fonte externa (ADR-028). Penduradas na associação de
-- plataforma: desassociar a plataforma leva as conquistas junto. Tabela nova e
-- vazia; nada existente muda.
CREATE TABLE "external_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_platform_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"points" integer,
	"rarity_percent" numeric(6, 3),
	"unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_achievements_name_not_blank" CHECK (length(trim("external_achievements"."name")) > 0),
	CONSTRAINT "external_achievements_points_nonnegative" CHECK ("external_achievements"."points" IS NULL OR "external_achievements"."points" >= 0),
	CONSTRAINT "external_achievements_rarity_range" CHECK ("external_achievements"."rarity_percent" IS NULL OR ("external_achievements"."rarity_percent" >= 0 AND "external_achievements"."rarity_percent" <= 100)),
	CONSTRAINT "external_achievements_unlocked_at_requires_unlock" CHECK ("external_achievements"."unlocked_at" IS NULL OR "external_achievements"."unlocked")
);
--> statement-breakpoint
ALTER TABLE "external_achievements" ADD CONSTRAINT "external_achievements_game_platform_id_game_platforms_id_fk" FOREIGN KEY ("game_platform_id") REFERENCES "public"."game_platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "external_achievements_unique" ON "external_achievements" USING btree ("game_platform_id","external_id");
--> statement-breakpoint
CREATE INDEX "external_achievements_game_platform_idx" ON "external_achievements" USING btree ("game_platform_id");
