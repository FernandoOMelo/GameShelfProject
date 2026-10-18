CREATE TYPE "public"."game_platform_format" AS ENUM('PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'CLOUD');
--> statement-breakpoint
CREATE TYPE "public"."playthrough_status" AS ENUM('PLANNED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED');
--> statement-breakpoint
CREATE TABLE "game_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	"edition" text,
	"format" "game_platform_format",
	"owned" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"external_source" text,
	"external_id" text,
	"external_account_label" text,
	"external_playtime_minutes" integer,
	"external_last_played_at" timestamp with time zone,
	"external_synced_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_platforms_edition_not_blank" CHECK ("game_platforms"."edition" IS NULL OR length(trim("game_platforms"."edition")) > 0),
	CONSTRAINT "game_platforms_external_playtime_nonnegative" CHECK ("game_platforms"."external_playtime_minutes" IS NULL OR "game_platforms"."external_playtime_minutes" >= 0),
	CONSTRAINT "game_platforms_external_pair" CHECK (("game_platforms"."external_source" IS NULL) = ("game_platforms"."external_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "playthroughs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" text,
	"status" "playthrough_status" DEFAULT 'PLANNED' NOT NULL,
	"primary_platform_id" uuid,
	"started_at" date,
	"completed_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playthroughs_sequence_positive" CHECK ("playthroughs"."sequence" > 0),
	CONSTRAINT "playthroughs_label_not_blank" CHECK ("playthroughs"."label" IS NULL OR length(trim("playthroughs"."label")) > 0),
	CONSTRAINT "playthroughs_completion_not_before_start" CHECK ("playthroughs"."started_at" IS NULL OR "playthroughs"."completed_at" IS NULL OR "playthroughs"."completed_at" >= "playthroughs"."started_at"),
	CONSTRAINT "playthroughs_completed_requires_date" CHECK ("playthroughs"."status" <> 'COMPLETED' OR "playthroughs"."completed_at" IS NOT NULL),
	CONSTRAINT "playthroughs_planned_has_no_dates" CHECK ("playthroughs"."status" <> 'PLANNED' OR ("playthroughs"."started_at" IS NULL AND "playthroughs"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "playthroughs" ADD CONSTRAINT "playthroughs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "playthroughs" ADD CONSTRAINT "playthroughs_primary_platform_id_platforms_id_fk" FOREIGN KEY ("primary_platform_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "game_platforms_game_platform_edition_unique" ON "game_platforms" USING btree ("game_id","platform_id",coalesce("edition", ''));
--> statement-breakpoint
CREATE UNIQUE INDEX "game_platforms_external_unique" ON "game_platforms" USING btree ("external_source","external_id") WHERE "game_platforms"."external_source" IS NOT NULL AND "game_platforms"."external_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "game_platforms_single_primary" ON "game_platforms" USING btree ("game_id") WHERE "game_platforms"."is_primary";
--> statement-breakpoint
CREATE INDEX "game_platforms_game_idx" ON "game_platforms" USING btree ("game_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "playthroughs_game_sequence_unique" ON "playthroughs" USING btree ("game_id","sequence");
--> statement-breakpoint
CREATE INDEX "playthroughs_game_idx" ON "playthroughs" USING btree ("game_id");
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "playthrough_id" uuid;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "platform_id" uuid;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_playthrough_id_playthroughs_id_fk" FOREIGN KEY ("playthrough_id") REFERENCES "public"."playthroughs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sessions_playthrough_idx" ON "sessions" USING btree ("playthrough_id");
--> statement-breakpoint
-- Reaproveita a plataforma principal já escolhida pelo usuário como primeira
-- associação do jogo. Nada é inventado: apenas os jogos que já têm
-- `platform_id` ganham uma linha, com a posse que o jogo já declarava.
-- Jogos sem plataforma continuam sem associação, e nenhuma jornada é criada:
-- o histórico de sessões permanece exatamente como está.
INSERT INTO "game_platforms" ("game_id", "platform_id", "owned", "is_primary")
SELECT "id", "platform_id", "owned", true FROM "games" WHERE "platform_id" IS NOT NULL;
