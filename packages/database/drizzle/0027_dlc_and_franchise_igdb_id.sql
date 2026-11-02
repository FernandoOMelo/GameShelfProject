-- DLC como entidade própria (ADR-034) e id da franquia no IGDB (ADR-033),
-- para listar os outros jogos dela sem reambiguar por nome. Tabela nova e
-- coluna nova nullable: nada existente muda.
CREATE TYPE "public"."dlc_status" AS ENUM('NOT_STARTED', 'PLAYING', 'COMPLETED');
--> statement-breakpoint
ALTER TABLE "franchises" ADD COLUMN "igdb_franchise_id" integer;
--> statement-breakpoint
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_igdb_franchise_id_unique" UNIQUE("igdb_franchise_id");
--> statement-breakpoint
CREATE TABLE "dlcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover_url" text,
	"release_date" date,
	"owned" boolean DEFAULT false NOT NULL,
	"status" "dlc_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"estimated_hours" numeric(8, 2),
	"played_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"rawg_id" integer,
	"rawg_slug" text,
	"rawg_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dlcs_name_not_blank" CHECK (length(trim("dlcs"."name")) > 0),
	CONSTRAINT "dlcs_estimated_hours_nonnegative" CHECK ("dlcs"."estimated_hours" IS NULL OR "dlcs"."estimated_hours" >= 0),
	CONSTRAINT "dlcs_played_hours_nonnegative" CHECK ("dlcs"."played_hours" >= 0)
);
--> statement-breakpoint
ALTER TABLE "dlcs" ADD CONSTRAINT "dlcs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dlcs_game_idx" ON "dlcs" USING btree ("game_id");
