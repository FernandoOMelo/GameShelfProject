import { describe, expect, it } from 'vitest';
import type { ExternalAchievement, RawgAchievement } from '@gameshelf/contracts';
import { buildAchievementsResponse, mergeAchievements, rarityTier } from './achievement-merge.js';

const rawg = (overrides: Partial<RawgAchievement>): RawgAchievement => ({
  id: crypto.randomUUID(), rawgId: 1, name: 'Troféu', description: 'Descrição', imageUrl: 'https://x/icon.png', percent: 50, ...overrides,
});
const external = (overrides: Partial<ExternalAchievement>): ExternalAchievement => ({
  id: crypto.randomUUID(), externalId: '1', name: 'Troféu', description: 'Descrição', iconUrl: null, points: null,
  rarityPercent: null, unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', syncedAt: '2026-10-28T00:00:00.000Z', ...overrides,
});

describe('rarityTier', () => {
  it('classifica pelas faixas de percentual', () => {
    expect(rarityTier(null)).toBe('COMMON');
    expect(rarityTier(60)).toBe('COMMON');
    expect(rarityTier(30)).toBe('UNCOMMON');
    expect(rarityTier(10)).toBe('RARE');
    expect(rarityTier(2)).toBe('ULTRA_RARE');
  });
});

describe('mergeAchievements', () => {
  it('cruza por nome normalizado e marca como desbloqueada', () => {
    const [merged] = mergeAchievements([rawg({ name: 'Não conheça seus heróis' })], [external({ name: 'não conheça seus heróis', unlockedAt: '2026-10-09T12:21:00.000Z' })]);
    expect(merged).toMatchObject({ name: 'Não conheça seus heróis', unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', secret: false });
  });

  it('trata como secreta uma conquista bloqueada sem correspondência no Achievist', () => {
    const [merged] = mergeAchievements([rawg({ name: 'Condecoração presidencial', description: 'Conclua o Capítulo 4.' })], []);
    expect(merged).toMatchObject({ name: null, description: null, unlocked: false, secret: true });
  });

  it('não cruza conquistas com nomes diferentes: cada uma segue sua própria regra de desbloqueio/segredo', () => {
    const [merged] = mergeAchievements([rawg({ name: 'Alguma conquista' })], [external({ name: 'Outra conquista completamente diferente', unlocked: true })]);
    expect(merged.unlocked).toBe(false);
    expect(merged.secret).toBe(true);
  });

  it('detecta a conquista de conclusão por heurística de texto', () => {
    const items = mergeAchievements([
      rawg({ name: 'Esperança do planeta', description: 'Conquiste todos os troféus de Final Fantasy VII Rebirth.' }),
      rawg({ name: 'Atolados', description: 'Conclua o Capítulo 2.' }),
    ], []);
    expect(items.find((item) => item.isCompletionTrophy)?.id).toBe(items[0]!.id);
    expect(items[1]!.isCompletionTrophy).toBe(false);
  });
});

describe('buildAchievementsResponse', () => {
  it('resume contagens, raridade e a conquista de conclusão', () => {
    const response = buildAchievementsResponse(
      { id: 1, slug: 'ff7r', name: 'FF7R', released: '2024-02-29', backgroundImage: null },
      [
        rawg({ name: 'Platina', description: 'Conquiste todas as conquistas.', percent: 2.3 }),
        rawg({ name: 'Capítulo 1', percent: 85.9 }),
      ],
      [external({ name: 'capítulo 1', unlocked: true })],
    );
    expect(response.catalogAvailable).toBe(true);
    expect(response.total).toBe(2);
    expect(response.unlockedCount).toBe(1);
    expect(response.percent).toBe(50);
    expect(response.completionTrophyId).toBe(response.achievements[0]!.id);
    expect(response.rarityBreakdown).toEqual({ common: 1, uncommon: 0, rare: 0, ultraRare: 1 });
  });
});
