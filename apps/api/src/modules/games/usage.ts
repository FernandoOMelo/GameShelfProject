import type { GameUsage } from '@gameshelf/contracts';
import { externalContribution } from '../stats/service.js';

type UsageSession = { gameId: string; platformId: string | null; durationMinutes: number | null };
type UsageLink = {
  id: string; gameId: string; platformId: string; countsTowardTotal: boolean;
  externalPlaytimeMinutes: number | null; externalPlaytimeImportedMinutes: number;
};

/**
 * Tempo consolidado (ADR-027: sessões + horas retroativas + tempo externo das
 * plataformas marcadas, sem contar duas vezes) e conquistas somadas das
 * associações, por jogo.
 */
export function buildGameUsage(input: {
  games: Array<{ id: string; retroactivePlayedHours: number | string }>;
  sessions: UsageSession[];
  links: UsageLink[];
  counts: Map<string, { total: number; unlocked: number }>;
}): GameUsage[] {
  const minutesByGame = new Map<string, number>();
  const minutesByGamePlatform = new Map<string, number>();
  for (const session of input.sessions) {
    if (session.durationMinutes === null) continue;
    minutesByGame.set(session.gameId, (minutesByGame.get(session.gameId) ?? 0) + session.durationMinutes);
    if (session.platformId) {
      const key = `${session.gameId}|${session.platformId}`;
      minutesByGamePlatform.set(key, (minutesByGamePlatform.get(key) ?? 0) + session.durationMinutes);
    }
  }
  const externalMinutes = new Map<string, number>();
  const achievements = new Map<string, { total: number; unlocked: number }>();
  for (const link of input.links) {
    if (link.countsTowardTotal) {
      externalMinutes.set(link.gameId, (externalMinutes.get(link.gameId) ?? 0) + externalContribution(link as never, minutesByGamePlatform));
    }
    const count = input.counts.get(link.id);
    if (count) {
      const current = achievements.get(link.gameId) ?? { total: 0, unlocked: 0 };
      achievements.set(link.gameId, { total: current.total + count.total, unlocked: current.unlocked + count.unlocked });
    }
  }
  return input.games.map((game) => ({
    gameId: game.id,
    playedHours: Math.round((((minutesByGame.get(game.id) ?? 0) + (externalMinutes.get(game.id) ?? 0)) / 60 + Number(game.retroactivePlayedHours)) * 100) / 100,
    achievementsUnlocked: achievements.get(game.id)?.unlocked ?? 0,
    achievementsTotal: achievements.get(game.id)?.total ?? 0,
  }));
}
