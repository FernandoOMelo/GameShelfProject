CREATE TABLE "game_list_entries" (
	"list_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_list_entries_list_id_game_id_pk" PRIMARY KEY("list_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "game_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_lists_name_unique" UNIQUE("name"),
	CONSTRAINT "game_lists_name_not_blank" CHECK (length(trim("game_lists"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "game_list_entries" ADD CONSTRAINT "game_list_entries_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_list_entries" ADD CONSTRAINT "game_list_entries_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;