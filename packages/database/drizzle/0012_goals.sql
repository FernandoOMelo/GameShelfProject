CREATE TYPE "public"."goal_kind" AS ENUM('COMPLETED_GAMES', 'PLAYED_HOURS');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('YEAR', 'MONTH');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "goal_kind" NOT NULL,
	"period" "goal_period" NOT NULL,
	"year" integer NOT NULL,
	"month" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_positive" CHECK ("goals"."target" > 0),
	CONSTRAINT "goals_period_month" CHECK (("goals"."period" = 'YEAR' AND "goals"."month" = 0) OR ("goals"."period" = 'MONTH' AND "goals"."month" BETWEEN 1 AND 12))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "goals_kind_period_year_month_unique" ON "goals" USING btree ("kind","period","year","month");
