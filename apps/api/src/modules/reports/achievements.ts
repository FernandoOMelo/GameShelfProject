import type { AchievementsReport, Game } from '@gameshelf/contracts';
import type { AchievementUnlock } from '../game-platforms/achievement-repository.js';

type Input = {
  games: Game[];
  unlocks: AchievementUnlock[];
  platforms: Array<{ id: string; name: string }>;
  /** Associações jogo/plataforma e seus totais de conquistas. */
  counts: Array<{ gameId: string; total: number; unlocked: number }>;
  from?: string; to?: string; timezoneOffsetMinutes?: number;
};

const DAY_MS = 86_400_000;
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Relatório de conquistas (ADR-041). Os desbloqueios respeitam o período, pelo dia
 * local; o progresso por jogo (perto de 100%, completos) é o estado atual. Os totais
 * de um jogo somam as suas plataformas, então um jogo em duas plataformas com as
 * mesmas conquistas tem os dois conjuntos contados.
 */
export function buildAchievementsReport({ games, unlocks, platforms, counts, from, to, timezoneOffsetMinutes = 0 }: Input): AchievementsReport {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const platformName = new Map(platforms.map((platform) => [platform.id, platform.name]));
  const rows = unlocks.flatMap((unlock) => {
    const day = new Date(unlock.unlockedAt.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    if ((from && day < from) || (to && day > to) || !gameById.has(unlock.gameId)) return [];
    return [{ unlock, day }];
  });

  const months = new Map<string, number>();
  const platformCounts = new Map<string, number>();
  const gameCounts = new Map<string, { count: number; first: number; last: number }>();
  for (const { unlock, day } of rows) {
    months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1);
    const platform = unlock.platformId ? platformName.get(unlock.platformId) ?? 'Plataforma removida' : 'Sem plataforma';
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    const at = unlock.unlockedAt.getTime();
    const entry = gameCounts.get(unlock.gameId) ?? { count: 0, first: at, last: at };
    entry.count += 1; entry.first = Math.min(entry.first, at); entry.last = Math.max(entry.last, at); gameCounts.set(unlock.gameId, entry);
  }

  const progress = new Map<string, { total: number; unlocked: number }>();
  for (const count of counts) {
    if (!gameById.has(count.gameId) || count.total === 0) continue;
    const entry = progress.get(count.gameId) ?? { total: 0, unlocked: 0 };
    entry.total += count.total; entry.unlocked += count.unlocked; progress.set(count.gameId, entry);
  }
  const hunts = [...progress].map(([gameId, entry]) => ({
    gameId, title: gameById.get(gameId)!.title, unlocked: entry.unlocked, total: entry.total,
    remaining: entry.total - entry.unlocked, percent: round((entry.unlocked / entry.total) * 100),
  }));
  const totalAchievements = hunts.reduce((sum, hunt) => sum + hunt.total, 0);
  const unlockedAchievements = hunts.reduce((sum, hunt) => sum + hunt.unlocked, 0);
  const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, 'pt-BR');
  const perfect = hunts.filter((hunt) => hunt.remaining === 0);

  return {
    totals: {
      unlockedInRange: rows.length,
      pointsInRange: rows.reduce((sum, { unlock }) => sum + (unlock.points ?? 0), 0),
      activeDays: new Set(rows.map(({ day }) => day)).size,
      totalAchievements, unlockedAchievements,
      completionPercent: totalAchievements === 0 ? 0 : round((unlockedAchievements / totalAchievements) * 100),
      gamesWithAchievements: hunts.length, gamesPerfect: perfect.length,
    },
    byMonth: [...months].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    byPlatform: [...platformCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')),
    topGames: [...gameCounts].map(([gameId, entry]) => ({ gameId, title: gameById.get(gameId)!.title, count: entry.count }))
      .sort((a, b) => b.count - a.count || byTitle(a, b)).slice(0, 10),
    rarest: rows.flatMap(({ unlock }) => unlock.rarityPercent === null || unlock.rarityPercent === undefined ? [] : [{
      gameId: unlock.gameId, gameTitle: gameById.get(unlock.gameId)!.title, name: unlock.name ?? 'Conquista',
      rarityPercent: unlock.rarityPercent, unlockedAt: unlock.unlockedAt.toISOString(),
    }])
      .sort((a, b) => a.rarityPercent - b.rarityPercent || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10),
    longestHunts: [...gameCounts].filter(([, entry]) => entry.count > 1)
      .map(([gameId, entry]) => ({ gameId, title: gameById.get(gameId)!.title, days: Math.floor((entry.last - entry.first) / DAY_MS), count: entry.count }))
      .sort((a, b) => b.days - a.days || byTitle(a, b)).slice(0, 5),
    closeToPerfect: hunts.filter((hunt) => hunt.remaining > 0 && hunt.percent >= 50)
      .sort((a, b) => a.remaining - b.remaining || byTitle(a, b)).slice(0, 10),
    perfect: perfect.sort((a, b) => b.total - a.total || byTitle(a, b)).slice(0, 10),
  };
}
