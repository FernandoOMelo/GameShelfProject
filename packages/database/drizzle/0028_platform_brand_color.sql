-- Cor da marca da plataforma (identidade visual). Opcional e só de apresentação:
-- não participa de nenhuma regra de associação (ADR-031). As plataformas já
-- cadastradas recebem a cor oficial do ícone que já têm.
ALTER TABLE "platforms" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_color_hex" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
UPDATE "platforms" SET "color" = v."color"
FROM (VALUES
  ('playstation', '#0070D1'),
  ('xbox', '#107C10'),
  ('nintendo', '#E60012'),
  ('steam', '#2A6FA8'),
  ('epic', '#313131'),
  ('gog', '#86328A'),
  ('pc', '#5B6573'),
  ('retro', '#C69A00'),
  ('mobile', '#3DDC84')
) AS v("icon_key", "color")
WHERE "platforms"."icon_key" = v."icon_key" AND "platforms"."color" IS NULL;
