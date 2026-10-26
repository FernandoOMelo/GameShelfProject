-- Catálogo inicial idempotente. Não altera nomes, grupos ou vínculos existentes;
-- só adiciona as plataformas ausentes para que o cadastro comece com opções úteis.
INSERT INTO "platforms" ("name", "catalog_key", "icon_key") VALUES
  ('PlayStation', 'playstation', 'playstation'),
  ('PlayStation 5', 'ps5', 'playstation'),
  ('PlayStation 4', 'ps4', 'playstation'),
  ('Xbox', 'xbox', 'xbox'),
  ('Xbox Series', 'xbox-series', 'xbox'),
  ('Nintendo', 'nintendo', 'nintendo'),
  ('Nintendo Switch', 'switch', 'nintendo'),
  ('PC', 'pc', 'pc'),
  ('Steam', 'steam', 'steam'),
  ('Epic Games', 'epic', 'epic'),
  ('GOG', 'gog', 'gog'),
  ('Microsoft Store', 'microsoft-store', 'pc'),
  ('RetroAchievements', 'retroachievements', 'retro'),
  ('Mobile', 'mobile', 'mobile')
ON CONFLICT ("name") DO NOTHING;
