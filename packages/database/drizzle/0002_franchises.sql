CREATE TABLE "franchises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "franchises_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "franchise_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE restrict ON UPDATE no action;