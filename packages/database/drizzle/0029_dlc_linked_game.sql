-- DLC vinculada a um jogo cadastrado (ADR-038). Coluna nova e nullable: as DLCs
-- existentes continuam independentes. Apagar o jogo vinculado só solta o vínculo.
ALTER TABLE "dlcs" ADD COLUMN "linked_game_id" uuid;--> statement-breakpoint
ALTER TABLE "dlcs" ADD CONSTRAINT "dlcs_linked_game_id_games_id_fk" FOREIGN KEY ("linked_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dlcs" ADD CONSTRAINT "dlcs_linked_game_not_base" CHECK ("dlcs"."linked_game_id" IS NULL OR "dlcs"."linked_game_id" <> "dlcs"."game_id");--> statement-breakpoint
CREATE INDEX "dlcs_linked_game_idx" ON "dlcs" USING btree ("linked_game_id");
