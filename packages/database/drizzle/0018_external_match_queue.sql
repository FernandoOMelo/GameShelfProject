CREATE TYPE "public"."external_match_status" AS ENUM('PENDING', 'IGNORED');
--> statement-breakpoint
-- Fila de correspondências a confirmar (ADR-024). A API do Achievist não expõe
-- `igdb_id`, então nenhum jogo externo vira associação de plataforma sem
-- confirmação do usuário. Esta tabela guarda apenas o retrato da entrada
-- externa; o vínculo confirmado vive em `game_platforms`.
CREATE TABLE "external_game_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"platform_name" text NOT NULL,
	"account_label" text,
	"playtime_minutes" integer,
	"last_played_at" timestamp with time zone,
	"status" "external_match_status" DEFAULT 'PENDING' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_game_matches_title_not_blank" CHECK (length(trim("external_game_matches"."title")) > 0),
	CONSTRAINT "external_game_matches_playtime_nonnegative" CHECK ("external_game_matches"."playtime_minutes" IS NULL OR "external_game_matches"."playtime_minutes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "external_game_matches_source_external_unique" ON "external_game_matches" USING btree ("source","external_id");
--> statement-breakpoint
CREATE INDEX "external_game_matches_status_idx" ON "external_game_matches" USING btree ("status");
