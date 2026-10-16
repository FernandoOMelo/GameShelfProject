CREATE TABLE "saved_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_filters_name_unique" UNIQUE("name"),
	CONSTRAINT "saved_filters_name_not_blank" CHECK (length(trim("saved_filters"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "excluded_from_suggestions" boolean DEFAULT false NOT NULL;
