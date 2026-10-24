-- Histórico dos lançamentos automáticos de tempo externo como horas
-- retroativas e janela de atividade derivada dos troféus (ADR-030). O número
-- continua em games.retroactive_played_hours; esta tabela registra cada
-- lançamento para a linha do tempo. Tabela nova e colunas aditivas em
-- game_platforms; nada existente muda.
CREATE TABLE "external_playtime_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"game_platform_id" uuid,
	"platform_name" text NOT NULL,
	"source" text NOT NULL,
	"imported_minutes" integer NOT NULL,
	"total_imported_minutes" integer NOT NULL,
	"external_last_played_at" timestamp with time zone,
	"activity_started_at" timestamp with time zone,
	"activity_ended_at" timestamp with time zone,
	"activity_days" integer DEFAULT 0 NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_playtime_imports_imported_positive" CHECK ("external_playtime_imports"."imported_minutes" > 0),
	CONSTRAINT "external_playtime_imports_total_nonnegative" CHECK ("external_playtime_imports"."total_imported_minutes" >= 0),
	CONSTRAINT "external_playtime_imports_total_covers_imported" CHECK ("external_playtime_imports"."total_imported_minutes" >= "external_playtime_imports"."imported_minutes"),
	CONSTRAINT "external_playtime_imports_platform_not_blank" CHECK (length(trim("external_playtime_imports"."platform_name")) > 0),
	CONSTRAINT "external_playtime_imports_activity_days_nonnegative" CHECK ("external_playtime_imports"."activity_days" >= 0),
	CONSTRAINT "external_playtime_imports_activity_window" CHECK ("external_playtime_imports"."activity_started_at" IS NULL OR "external_playtime_imports"."activity_ended_at" IS NULL OR "external_playtime_imports"."activity_ended_at" >= "external_playtime_imports"."activity_started_at")
);
--> statement-breakpoint
ALTER TABLE "external_playtime_imports" ADD CONSTRAINT "external_playtime_imports_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "external_playtime_imports" ADD CONSTRAINT "external_playtime_imports_game_platform_id_game_platforms_id_fk" FOREIGN KEY ("game_platform_id") REFERENCES "public"."game_platforms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "external_playtime_imports_game_idx" ON "external_playtime_imports" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "external_playtime_imports_imported_at_idx" ON "external_playtime_imports" USING btree ("imported_at");
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "external_activity_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "external_activity_ended_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD COLUMN "external_activity_days" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_activity_days_nonnegative" CHECK ("game_platforms"."external_activity_days" >= 0);
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_activity_window" CHECK ("game_platforms"."external_activity_started_at" IS NULL OR "game_platforms"."external_activity_ended_at" IS NULL OR "game_platforms"."external_activity_ended_at" >= "game_platforms"."external_activity_started_at");
