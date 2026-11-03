import { describe, expect, it } from 'vitest';
import type { ExternalAchievement, RawgAchievement } from '@gameshelf/contracts';
import { buildAchievementsResponse, classifyAchievement, mergeAchievements, rarityTier } from './achievement-merge.js';

const rawg = (overrides: Partial<RawgAchievement>): RawgAchievement => ({
  id: crypto.randomUUID(), rawgId: 1, name: 'Troféu', description: 'Descrição', imageUrl: 'https://x/icon.png', percent: 50, ...overrides,
});
const external = (overrides: Partial<ExternalAchievement>): ExternalAchievement => ({
  id: crypto.randomUUID(), externalId: '1', name: 'Troféu', description: 'Descrição', iconUrl: null, points: null,
  rarityPercent: null, unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', syncedAt: '2026-10-28T00:00:00.000Z', ...overrides,
});

const psId = '00000000-0000-4000-8000-0000000000a1';
const pcId = '00000000-0000-4000-8000-0000000000a2';

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
  it('sem dados do Achievist usa a RAWG e nada é secreto', () => {
    const [merged] = mergeAchievements([rawg({ name: 'Condecoração presidencial', description: 'Conclua o Capítulo 4.' })], []);
    expect(merged).toMatchObject({ name: 'Condecoração presidencial', unlocked: false, secret: false });
  });

  it('com Achievist, ele é a lista e a RAWG completa ícone e raridade pelo nome', () => {
    const items = mergeAchievements(
      [rawg({ name: 'Não conheça seus heróis', imageUrl: 'https://x/rawg.png', percent: 85.9 })],
      [external({ name: 'não conheça seus heróis', iconUrl: null, rarityPercent: null, unlockedAt: '2026-10-09T12:21:00.000Z' }), external({ name: 'Só no PSN' })],
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ iconUrl: 'https://x/rawg.png', rarityPercent: 85.9, unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', secret: false });
  });

  it('marca como secreta a conquista bloqueada sem descrição e mascara nome e descrição', () => {
    const [item] = mergeAchievements([], [external({ name: 'Troféu oculto', description: null, unlocked: false, unlockedAt: null })]);
    expect(item).toMatchObject({ name: null, description: null, secret: true });
  });

  it('não esconde a conquista sem descrição quando já foi desbloqueada', () => {
    const [item] = mergeAchievements([], [external({ name: 'Oculto', description: null })]);
    expect(item).toMatchObject({ name: 'Oculto', secret: false });
  });

  it('distingue platina, jogo concluído e conquistas especiais', () => {
    expect(classifyAchievement('Platinum Trophy', 'Obtained all trophies')).toBe('PLATINUM');
    expect(classifyAchievement('Esperança do planeta', 'Conquiste todos os troféus de Final Fantasy VII Rebirth.')).toBe('PLATINUM');
    expect(classifyAchievement('Hardboiled Writer', 'You completed the game on Normal difficulty.')).toBe('COMPLETION');
    expect(classifyAchievement('Fim de jogo', 'Conclua a história principal.')).toBe('COMPLETION');
    expect(classifyAchievement('Pesadelo', 'Finish the game on Nightmare difficulty.')).toBe('COMPLETION');
    expect(classifyAchievement('Todos os finais', 'Veja todos os finais.')).toBe('SPECIAL');
    expect(classifyAchievement('Atolados', 'Conclua o Capítulo 2.')).toBeNull();
  });

  it('marca só o jogo concluído como isCompletionTrophy', () => {
    const items = mergeAchievements([
      rawg({ name: 'Platinum Trophy', description: 'Obtained all trophies' }),
      rawg({ name: 'Hardboiled Writer', description: 'You completed the game on Normal difficulty.' }),
    ], []);
    expect(items.map((item) => [item.specialKind, item.isCompletionTrophy])).toEqual([['PLATINUM', false], ['COMPLETION', true]]);
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
      [{ id: 'gp-1', platformId: psId, name: 'PlayStation 5', items: [external({ name: 'capítulo 1', unlocked: true, rarityPercent: null }), external({ name: 'Platina', description: 'Conquiste todas as conquistas.', unlocked: false, unlockedAt: null, rarityPercent: null })] }],
    );
    expect(response.catalogAvailable).toBe(true);
    expect(response.total).toBe(2);
    expect(response.unlockedCount).toBe(1);
    expect(response.percent).toBe(50);
    expect(response.platinumTrophyId).toBe(response.achievements[1]!.id);
    expect(response.completionTrophyId).toBeNull();
    expect(response.rarityBreakdown).toEqual({ common: 1, uncommon: 0, rare: 0, ultraRare: 1 });
    expect(response.groups).toHaveLength(1);
    expect(response.groups[0]).toMatchObject({ id: 'gp-1', platformId: psId, name: 'PlayStation 5', total: 2, unlockedCount: 1 });
  });

  it('mantém um grupo por plataforma: o mesmo troféu em duas plataformas não se funde', () => {
    const response = buildAchievementsResponse(null, [], [
      { id: 'gp-ps', platformId: psId, name: 'PlayStation 5', items: [external({ name: 'Primeiro passo', unlocked: true }), external({ name: 'Platina', unlocked: false, unlockedAt: null })] },
      { id: 'gp-pc', platformId: pcId, name: 'PC', items: [external({ name: 'Primeiro passo', unlocked: false, unlockedAt: null })] },
    ]);
    expect(response.groups.map((group) => [group.name, group.total, group.unlockedCount])).toEqual([['PlayStation 5', 2, 1], ['PC', 1, 0]]);
    expect(response.groups.every((group) => group.refreshable === false)).toBe(true);
    expect(response.total).toBe(3);
    expect(response.unlockedCount).toBe(1);
    expect(response.achievements).toHaveLength(3);
  });

  it('mantém a aba de uma associação com fonte externa ainda sem conquistas espelhadas', () => {
    const response = buildAchievementsResponse(null, [], [
      { id: 'gp-ps5', platformId: psId, name: 'PlayStation 5', items: [external({ name: 'A' })], refreshable: true },
      { id: 'gp-ps4', platformId: pcId, name: 'PlayStation 4', items: [], refreshable: true },
    ]);
    expect(response.groups.map((group) => [group.name, group.total, group.refreshable])).toEqual([['PlayStation 5', 1, true], ['PlayStation 4', 0, true]]);
  });

  it('sem fonte pessoal, o catálogo RAWG forma um único grupo', () => {
    const response = buildAchievementsResponse({ id: 1, slug: 'x', name: 'X', released: null, backgroundImage: null }, [rawg({ name: 'A' }), rawg({ name: 'B' })], [
      { id: 'gp-ps', platformId: psId, name: 'PlayStation 5', items: [] },
    ]);
    expect(response.groups).toMatchObject([{ id: 'catalog', platformId: null, total: 2 }]);
  });
});
