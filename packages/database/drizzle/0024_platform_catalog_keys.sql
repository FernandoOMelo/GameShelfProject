-- Chaves de apresentação para o catálogo inicial (ADR-031). Nomes e vínculos
-- existentes ficam intactos; colunas nulas preservam plataformas personalizadas.
ALTER TABLE "platforms" ADD COLUMN "catalog_key" text;
--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "icon_key" text;
--> statement-breakpoint
UPDATE "platforms" SET "catalog_key" = CASE lower("name")
  WHEN 'playstation'      THEN 'playstation'
  WHEN 'playstation 5'    THEN 'ps5'
  WHEN 'playstation 4'    THEN 'ps4'
  WHEN 'playstation 3'    THEN 'ps3'
  WHEN 'playstation 2'    THEN 'ps2'
  WHEN 'ps vita'          THEN 'ps-vita'
  WHEN 'xbox'             THEN 'xbox'
  WHEN 'xbox series'      THEN 'xbox-series'
  WHEN 'xbox one'         THEN 'xbox-one'
  WHEN 'nintendo switch'  THEN 'switch'
  WHEN 'nintendo'         THEN 'nintendo'
  WHEN 'pc'               THEN 'pc'
  WHEN 'steam'            THEN 'steam'
  WHEN 'epic games'       THEN 'epic'
  WHEN 'gog'              THEN 'gog'
  WHEN 'microsoft store'  THEN 'microsoft-store'
  WHEN 'retroachievements' THEN 'retroachievements'
  WHEN 'mobile'           THEN 'mobile'
  ELSE NULL END;
--> statement-breakpoint
UPDATE "platforms" SET "icon_key" = CASE lower("name")
  WHEN 'playstation'      THEN 'playstation'
  WHEN 'playstation 5'    THEN 'playstation'
  WHEN 'playstation 4'    THEN 'playstation'
  WHEN 'playstation 3'    THEN 'playstation'
  WHEN 'playstation 2'    THEN 'playstation'
  WHEN 'ps vita'          THEN 'playstation'
  WHEN 'xbox'             THEN 'xbox'
  WHEN 'xbox series'      THEN 'xbox'
  WHEN 'xbox one'         THEN 'xbox'
  WHEN 'nintendo switch'  THEN 'nintendo'
  WHEN 'nintendo'         THEN 'nintendo'
  WHEN 'pc'               THEN 'pc'
  WHEN 'steam'            THEN 'steam'
  WHEN 'epic games'       THEN 'epic'
  WHEN 'gog'              THEN 'gog'
  WHEN 'microsoft store'  THEN 'pc'
  WHEN 'retroachievements' THEN 'retro'
  WHEN 'mobile'           THEN 'mobile'
  ELSE NULL END;
