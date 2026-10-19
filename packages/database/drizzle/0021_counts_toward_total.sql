-- Marca por associação se o tempo informado pela plataforma entra no total
-- consolidado da biblioteca (ADR-027). Aditiva e desligada por padrão: nenhum
-- número existente muda, e ligar é decisão do usuário, uma plataforma por vez.
ALTER TABLE "game_platforms" ADD COLUMN "counts_toward_total" boolean DEFAULT false NOT NULL;
