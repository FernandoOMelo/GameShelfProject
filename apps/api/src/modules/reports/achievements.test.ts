import { describe, expect, it } from 'vitest';
import { buildAchievementsReport } from './achievements.js';
import { id, makeGame } from './fixtures.js';

const pc = { id: id(200), name: 'PC' };
const games = [makeGame(1), makeGame(2), makeGame(3)];
const unlock = (gameId: string, at: string, values: { points?: number; rarityPercent?: number | null; name?: string } = {}) => ({
  gameId, platformId: pc.id, unlockedAt: new Date(at), name: values.name ?? 'Conquista', description: null, iconUrl: null,
  points: values.points ?? 10, rarityPercent: values.rarityPercent === undefined ? 50 : values.rarityPercent,
});
const unlocks = [
  unlock(id(1), '2026-01-01T12:00:00.000Z', { rarityPercent: 2, name: 'Rara' }),
  unlock(id(1), '2026-01-11T12:00:00.000Z', { points: 20 }),
  unlock(id(2), '2026-02-05T12:00:00.000Z', { rarityPercent: null }),
  unlock(id(3), '2025-06-01T12:00:00.000Z'),
];
const counts = [{ gameId: id(1), total: 10, unlocked: 9 }, { gameId: id(2), total: 4, unlocked: 4 }, { gameId: id(3), total: 10, unlocked: 2 }];

describe('buildAchievementsReport', () => {
  const report = buildAchievementsReport({ games, unlocks, platforms: [pc], counts });

  it('totaliza desbloqueios e progresso', () => {
    expect(report.totals).toEqual({
      unlockedInRange: 4, pointsInRange: 50, activeDays: 4, totalAchievements: 24, unlockedAchievements: 15,
      completionPercent: 62.5, gamesWithAchievements: 3, gamesPerfect: 1,
    });
    expect(report.byMonth.map((entry) => entry.month)).toEqual(['2025-06', '2026-01', '2026-02']);
    expect(report.byPlatform).toEqual([{ name: 'PC', count: 4 }]);
  });

  it('lista raras, caças longas e jogos perto de 100%', () => {
    expect(report.rarest.map((entry) => [entry.name, entry.rarityPercent])).toEqual([['Rara', 2], ['Conquista', 50], ['Conquista', 50]]);
    expect(report.longestHunts).toEqual([{ gameId: id(1), title: 'Jogo 1', days: 10, count: 2 }]);
    expect(report.closeToPerfect).toEqual([expect.objectContaining({ title: 'Jogo 1', remaining: 1, percent: 90 })]);
    expect(report.perfect).toEqual([expect.objectContaining({ title: 'Jogo 2', total: 4 })]);
  });

  it('filtra os desbloqueios pelo período sem mudar o progresso', () => {
    const ranged = buildAchievementsReport({ games, unlocks, platforms: [pc], counts, from: '2026-01-01', to: '2026-01-31' });
    expect(ranged.totals).toMatchObject({ unlockedInRange: 2, pointsInRange: 30, unlockedAchievements: 15 });
    expect(ranged.topGames).toEqual([{ gameId: id(1), title: 'Jogo 1', count: 2 }]);
  });
});
