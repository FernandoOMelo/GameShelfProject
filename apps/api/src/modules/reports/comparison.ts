import type { ComparisonReport, Game, Playthrough, Session } from '@gameshelf/contracts';
import type { AchievementUnlock } from '../game-platforms/achievement-repository.js';
import { buildPlaytimeReport } from './playtime.js';

type Period = { from: string; to: string };
type Input = {
  games: Game[]; sessions: Session[]; playthroughs: Playthrough[];
  /** Sem o espelho de conquistas, a métrica de conquistas some do resultado. */
  unlocks?: AchievementUnlock[];
  a: Period; b: Period; timezoneOffsetMinutes?: number;
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Comparativo entre dois períodos (ADR-041). Cada métrica usa a definição do relatório
 * de origem: tempo e sessões pelo dia local de início, zerados pela data de conclusão,
 * jornadas iniciadas pela data de início da jornada e conquistas pelo dia local do desbloqueio.
 */
export function buildComparisonReport({ games, sessions, playthroughs, unlocks, a, b, timezoneOffsetMinutes = 0 }: Input): ComparisonReport {
  const inRange = (day: string | null, period: Period) => day !== null && day >= period.from && day <= period.to;
  const measure = (period: Period) => {
    const playtime = buildPlaytimeReport({ games, sessions, platforms: [], genres: [], from: period.from, to: period.to, timezoneOffsetMinutes });
    return {
      playtime,
      completed: games.filter((game) => game.status === 'COMPLETED' && inRange(game.completedAt, period)).length,
      journeys: playthroughs.filter((journey) => journey.status !== 'PLANNED' && inRange(journey.startedAt, period)).length,
      achievements: (unlocks ?? []).filter((unlock) => inRange(new Date(unlock.unlockedAt.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10), period)).length,
    };
  };
  const first = measure(a);
  const second = measure(b);

  const metric = (key: ComparisonReport['metrics'][number]['key'], valueA: number, valueB: number) => ({
    key, a: valueA, b: valueB, differencePercent: valueA === 0 ? null : round(((valueB - valueA) / valueA) * 100),
  });
  return {
    metrics: [
      metric('TOTAL_MINUTES', first.playtime.totalMinutes, second.playtime.totalMinutes),
      metric('SESSIONS', first.playtime.sessionCount, second.playtime.sessionCount),
      metric('ACTIVE_DAYS', first.playtime.activeDays, second.playtime.activeDays),
      metric('AVERAGE_SESSION_MINUTES', first.playtime.averageSessionMinutes, second.playtime.averageSessionMinutes),
      metric('GAMES_COMPLETED', first.completed, second.completed),
      metric('JOURNEYS_STARTED', first.journeys, second.journeys),
      ...(unlocks === undefined ? [] : [metric('ACHIEVEMENTS', first.achievements, second.achievements)]),
    ],
    topGame: { a: first.playtime.topGames[0]?.name ?? null, b: second.playtime.topGames[0]?.name ?? null },
  };
}
