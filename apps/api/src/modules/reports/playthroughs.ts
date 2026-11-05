import type { Game, Playthrough, PlaythroughsReport, Session } from '@gameshelf/contracts';

type Input = { games: Game[]; playthroughs: Playthrough[]; sessions: Session[]; platforms: Array<{ id: string; name: string }>; from?: string; to?: string };

const DAY_MS = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const round = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * Relatório de jornadas e replays (ADR-041). Usa as jornadas (playthroughs), não o
 * status atual do jogo, então conclusões antigas de um jogo rejogado continuam
 * contadas. Com período, entram só jornadas iniciadas nele. Horas de uma jornada =
 * sessões encerradas vinculadas a ela.
 */
export function buildPlaythroughsReport({ games, playthroughs, sessions, platforms, from, to }: Input): PlaythroughsReport {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const platformName = new Map(platforms.map((platform) => [platform.id, platform.name]));
  const minutesByJourney = new Map<string, number>();
  for (const session of sessions) {
    if (session.playthroughId && session.durationMinutes) minutesByJourney.set(session.playthroughId, (minutesByJourney.get(session.playthroughId) ?? 0) + session.durationMinutes);
  }

  const started = playthroughs.filter((journey) => journey.status !== 'PLANNED' && gameById.has(journey.gameId)
    && (!from || (journey.startedAt !== null && journey.startedAt >= from)) && (!to || (journey.startedAt !== null && journey.startedAt <= to)));
  const byGame = new Map<string, Playthrough[]>();
  for (const journey of started) byGame.set(journey.gameId, [...(byGame.get(journey.gameId) ?? []), journey].sort((a, b) => a.sequence - b.sequence));

  const hoursOf = (journey: Playthrough) => round((minutesByJourney.get(journey.id) ?? 0) / 60);
  const completed = started.filter((journey) => journey.status === 'COMPLETED');
  const gaps: number[] = [];
  for (const list of byGame.values()) {
    for (let i = 1; i < list.length; i += 1) {
      const previous = list[i - 1]!.completedAt;
      const next = list[i]!.startedAt;
      if (previous && next && next >= previous) gaps.push(days(previous, next));
    }
  }
  const timed = completed.filter((journey) => hoursOf(journey) > 0);
  const platformCounts = new Map<string, number>();
  for (const journey of started) {
    const name = journey.primaryPlatformId ? platformName.get(journey.primaryPlatformId) ?? 'Plataforma removida' : 'Sem plataforma';
    platformCounts.set(name, (platformCounts.get(name) ?? 0) + 1);
  }
  const count = (list: Playthrough[], status: Playthrough['status']) => list.filter((journey) => journey.status === status).length;
  const title = (gameId: string) => gameById.get(gameId)!.title;

  return {
    totals: {
      gamesWithJourneys: byGame.size, journeysStarted: started.length, journeysCompleted: completed.length,
      journeysAbandoned: count(started, 'ABANDONED'), replaysStarted: started.filter((journey) => journey.isReplay).length,
      averageJourneysPerGame: byGame.size === 0 ? 0 : round(started.length / byGame.size),
      completionRate: started.length === 0 ? 0 : round((completed.length / started.length) * 100),
      averageDaysToComplete: average(completed.filter((journey) => journey.startedAt && journey.completedAt).map((journey) => days(journey.startedAt!, journey.completedAt!)).filter((value) => value >= 0)),
      averageDaysBetweenReplays: average(gaps),
    },
    firstVsLater: {
      firstAverageHours: average(timed.filter((journey) => !journey.isReplay).map(hoursOf)),
      laterAverageHours: average(timed.filter((journey) => journey.isReplay).map(hoursOf)),
      firstCount: timed.filter((journey) => !journey.isReplay).length, laterCount: timed.filter((journey) => journey.isReplay).length,
    },
    byPlatform: [...platformCounts].map(([name, journeys]) => ({ name, journeys })).sort((a, b) => b.journeys - a.journeys || a.name.localeCompare(b.name, 'pt-BR')),
    mostReplayed: [...byGame].filter(([, list]) => list.length > 1)
      .sort(([a, la], [b, lb]) => lb.length - la.length || title(a).localeCompare(title(b), 'pt-BR')).slice(0, 10)
      .map(([gameId, list]) => ({
        gameId, title: title(gameId), journeys: list.length, completed: count(list, 'COMPLETED'), abandoned: count(list, 'ABANDONED'),
        history: list.map((journey) => ({
          id: journey.id, sequence: journey.sequence, label: journey.label, status: journey.status,
          platformName: journey.primaryPlatformId ? platformName.get(journey.primaryPlatformId) ?? null : null,
          startedAt: journey.startedAt, completedAt: journey.completedAt,
          days: journey.startedAt && journey.completedAt ? days(journey.startedAt, journey.completedAt) : null, hours: hoursOf(journey),
        })),
      })),
    mostAbandoned: [...byGame].map(([gameId, list]) => ({ gameId, title: title(gameId), abandoned: count(list, 'ABANDONED'), journeys: list.length }))
      .filter((entry) => entry.abandoned > 0).sort((a, b) => b.abandoned - a.abandoned || a.title.localeCompare(b.title, 'pt-BR')).slice(0, 10),
  };
}
