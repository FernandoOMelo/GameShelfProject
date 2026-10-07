import type { DashboardResponse, Game, QueueItem, Session } from '@gameshelf/contracts';

type DateRange = { from?: string; to?: string; timezoneOffsetMinutes?: number };
type GameSummaryInput = Pick<Game, 'status' | 'personalEstimatedHours' | 'estimatedMainHours'>;

export function estimateRemainingHours(game: GameSummaryInput, playedHours: number): number | null {
  const estimate = game.personalEstimatedHours ?? game.estimatedMainHours;
  return estimate === null ? null : Math.max(estimate - playedHours, 0);
}

export function buildDashboard(input: {
  games: Game[];
  sessions: Session[];
  queue: QueueItem[];
  weeklyMinutes: number;
  range?: DateRange;
}): DashboardResponse {
  const playedByGame = new Map<string, number>();
  const latestSessionByGame = new Map<string, Session>();
  let totalPlayedMinutes = 0;
  for (const session of input.sessions) {
    if (session.durationMinutes !== null) {
      totalPlayedMinutes += session.durationMinutes;
      playedByGame.set(session.gameId, (playedByGame.get(session.gameId) ?? 0) + session.durationMinutes);
    }
    const latest = latestSessionByGame.get(session.gameId);
    if (!latest || Date.parse(session.startedAt) > Date.parse(latest.startedAt)) latestSessionByGame.set(session.gameId, session);
  }

  const hoursFor = (game: Game) => (playedByGame.get(game.id) ?? 0) / 60 + game.retroactivePlayedHours;
  const retroactiveTotal = input.games.reduce((sum, game) => sum + game.retroactivePlayedHours, 0);
  const nonArchived = input.games.filter((game) => !game.archived);
  const currentGames = nonArchived.filter((game) => game.status === 'PLAYING')
    .sort((left, right) => Date.parse(latestSessionByGame.get(right.id)?.startedAt ?? right.updatedAt)
      - Date.parse(latestSessionByGame.get(left.id)?.startedAt ?? left.updatedAt));
  const playingGames = currentGames.map((game) => {
    const gameSessions = input.sessions.filter((session) => session.gameId === game.id);
    const lastSession = latestSessionByGame.get(game.id) ?? null;
    const progress = gameSessions.filter((session) => session.progress !== null)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0]?.progress ?? null;
    const estimatedHours = game.personalEstimatedHours ?? game.estimatedMainHours;
    return {
      game,
      playedHours: roundHours(hoursFor(game)),
      progress,
      lastSession,
      activeSession: gameSessions.find((session) => session.endedAt === null) ?? null,
      estimatedHours,
      remainingHours: estimateRemainingHours(game, hoursFor(game)),
    };
  });
  const currentGame = playingGames[0] ?? null;
  const remaining = (game: Game) => estimateRemainingHours(game, hoursFor(game));
  const backlogRemainingHours = nonArchived
    .filter((game) => game.owned && game.status !== 'COMPLETED' && game.status !== 'ABANDONED')
    .reduce((sum, game) => sum + (remaining(game) ?? 0), 0);
  const queueRemainingHours = input.queue.reduce((sum, item) => sum + (remaining(item.game) ?? 0), 0);
  const weeklyHours = input.weeklyMinutes / 60;
  const completionByYear = new Map<number, Set<string>>();
  const completionByMonth = new Map<string, Set<string>>();
  for (const game of input.games) {
    if (game.completedAt) {
      const year = Number(game.completedAt.slice(0, 4));
      const month = Number(game.completedAt.slice(5, 7));
      const yearGames = completionByYear.get(year) ?? new Set<string>();
      yearGames.add(game.id);
      completionByYear.set(year, yearGames);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthGames = completionByMonth.get(monthKey) ?? new Set<string>();
      monthGames.add(game.id);
      completionByMonth.set(monthKey, monthGames);
    }
  }

  const offsetMs = (input.range?.timezoneOffsetMinutes ?? 0) * 60_000;
  const start = input.range?.from ? Date.parse(`${input.range.from}T00:00:00.000Z`) + offsetMs : Number.NEGATIVE_INFINITY;
  const end = input.range?.to ? Date.parse(`${addDays(input.range.to, 1)}T00:00:00.000Z`) + offsetMs : Number.POSITIVE_INFINITY;
  const periodSessions = input.sessions.filter((session) => Date.parse(session.startedAt) < end
    && (session.endedAt === null || Date.parse(session.endedAt) > start));
  const periodMinutes = periodSessions.filter((session) => session.endedAt !== null).reduce((sum, session) => {
    const duration = Math.max(0, Math.min(Date.parse(session.endedAt!), end) - Math.max(Date.parse(session.startedAt), start));
    return sum + duration / 60_000;
  }, 0);
  const periodGameIds = new Set(periodSessions.map((session) => session.gameId));
  let periodRetroactiveHours = 0;
  for (const game of input.games) {
    if (playedByGame.has(game.id) || latestSessionByGame.has(game.id)) continue;
    const hours = retroactiveHoursInPeriod(game, input.range);
    if (hours > 0) {
      periodRetroactiveHours += hours;
      periodGameIds.add(game.id);
    }
  }
  const periodCompletions = input.games.filter((game) => game.completedAt
    && (!input.range?.from || game.completedAt >= input.range.from)
    && (!input.range?.to || game.completedAt <= input.range.to));

  return {
    gameCount: nonArchived.length,
    desiredCount: nonArchived.filter((game) => game.status === 'DESIRED').length,
    backlogCount: nonArchived.filter((game) => game.status === 'BACKLOG').length,
    completedCount: nonArchived.filter((game) => game.status === 'COMPLETED').length,
    playingCount: currentGames.length,
    pausedCount: nonArchived.filter((game) => game.status === 'PAUSED').length,
    abandonedCount: nonArchived.filter((game) => game.status === 'ABANDONED').length,
    archivedCount: input.games.length - nonArchived.length,
    completionByYear: [...completionByYear].map(([year, games]) => ({ year, gameCount: games.size })).sort((a, b) => b.year - a.year),
    completionByMonth: [...completionByMonth].map(([key, games]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), gameCount: games.size })).sort((a, b) => b.year - a.year || b.month - a.month),
    totalPlayedHours: roundHours(totalPlayedMinutes / 60 + retroactiveTotal),
    backlogRemainingHours: roundHours(backlogRemainingHours),
    weeklyHours: roundHours(weeklyHours),
    queueRemainingHours: roundHours(queueRemainingHours),
    estimatedQueueWeeks: weeklyHours > 0 ? roundHours(queueRemainingHours / weeklyHours) : null,
    currentGame,
    playingGames,
    period: { from: input.range?.from ?? null, to: input.range?.to ?? null },
    periodStats: {
      playedHours: roundHours(periodMinutes / 60 + periodRetroactiveHours),
      sessions: periodSessions.filter((session) => Date.parse(session.startedAt) >= start && Date.parse(session.startedAt) < end).length,
      gamesPlayed: periodGameIds.size,
      gamesCompleted: periodCompletions.length,
    },
    queuePreview: input.queue.slice(0, 5),
  };
}

// Games without sessions spread their retroactive hours evenly (per day, i.e. a monthly average)
// across the startedAt..completedAt interval; only the part overlapping the period is counted.
function retroactiveHoursInPeriod(game: Game, range?: DateRange): number {
  if (game.retroactivePlayedHours <= 0 || !game.startedAt || !game.completedAt) return 0;
  const dayMs = 86_400_000;
  const gameStart = Date.parse(`${game.startedAt.slice(0, 10)}T00:00:00.000Z`);
  const gameEnd = Math.max(Date.parse(`${game.completedAt.slice(0, 10)}T00:00:00.000Z`), gameStart);
  const from = range?.from ? Date.parse(`${range.from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
  const to = range?.to ? Date.parse(`${range.to}T00:00:00.000Z`) : Number.POSITIVE_INFINITY;
  const overlapDays = Math.max(0, (Math.min(gameEnd, to) - Math.max(gameStart, from)) / dayMs + 1);
  const totalDays = (gameEnd - gameStart) / dayMs + 1;
  return game.retroactivePlayedHours * Math.min(overlapDays / totalDays, 1);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
