-- Catálogo de plataformas em dois níveis (ADR-025). Aditiva: nenhuma plataforma
-- existente muda de nome ou de id, e todas começam como grupo (`parent_id` nulo),
-- que é exatamente o comportamento de hoje. Associações, sessões e jornadas
-- continuam apontando para a mesma plataforma de antes.
ALTER TABLE "platforms" ADD COLUMN "parent_id" uuid;
--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_parent_id_platforms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_parent_not_self" CHECK ("platforms"."parent_id" IS NULL OR "platforms"."parent_id" <> "platforms"."id");
--> statement-breakpoint
CREATE INDEX "platforms_parent_idx" ON "platforms" USING btree ("parent_id");
