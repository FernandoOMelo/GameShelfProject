ALTER TABLE "platforms" DROP CONSTRAINT IF EXISTS "platforms_color_hex";--> statement-breakpoint
ALTER TABLE "platforms" DROP COLUMN IF EXISTS "color";
