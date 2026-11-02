DROP TABLE "dlcs";
--> statement-breakpoint
ALTER TABLE "franchises" DROP CONSTRAINT "franchises_igdb_franchise_id_unique";
--> statement-breakpoint
ALTER TABLE "franchises" DROP COLUMN "igdb_franchise_id";
--> statement-breakpoint
DROP TYPE "public"."dlc_status";
