import type { DashboardResponse, Game, QueueItem, Session } from '@gameshelf/contracts';

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

  const hoursFor = (game: Game) => (playedByGame.get(game.id) ?? 0) / 60;
  const currentGame = input.games.filter((game) => game.status === 'PLAYING')
    .sort((left, right) => Date.parse(latestSessionByGame.get(right.id)?.startedAt ?? right.updatedAt)
      - Date.parse(latestSessionByGame.get(left.id)?.startedAt ?? left.updatedAt))[0];
  const currentLastSession = currentGame ? latestSessionByGame.get(currentGame.id) ?? null : null;
  const currentPlayedHours = currentGame ? hoursFor(currentGame) : 0;
  const currentEstimatedHours = currentGame
    ? currentGame.personalEstimatedHours ?? currentGame.estimatedMainHours
    : null;
  const currentProgress = currentGame
    ? input.sessions.filter((session) => session.gameId === currentGame.id && session.progress !== null)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0]?.progress ?? null
    : null;
  const remaining = (game: Game) => estimateRemainingHours(game, hoursFor(game));
  const backlogRemainingHours = input.games
    .filter((game) => game.status !== 'COMPLETED' && game.status !== 'ABANDONED')
    .reduce((sum, game) => sum + (remaining(game) ?? 0), 0);
  const queueRemainingHours = input.queue.reduce((sum, item) => sum + (remaining(item.game) ?? 0), 0);
  const weeklyHours = input.weeklyMinutes / 60;

  return {
    gameCount: input.games.length,
    completedCount: input.games.filter((game) => game.status === 'COMPLETED').length,
    playingCount: input.games.filter((game) => game.status === 'PLAYING').length,
    abandonedCount: input.games.filter((game) => game.status === 'ABANDONED').length,
    totalPlayedHours: roundHours(totalPlayedMinutes / 60),
    backlogRemainingHours: roundHours(backlogRemainingHours),
    weeklyHours: roundHours(weeklyHours),
    queueRemainingHours: roundHours(queueRemainingHours),
    estimatedQueueWeeks: weeklyHours > 0 ? roundHours(queueRemainingHours / weeklyHours) : null,
    currentGame: currentGame ? {
      game: currentGame,
      playedHours: roundHours(currentPlayedHours),
      progress: currentProgress,
      lastSession: currentLastSession,
      estimatedHours: currentEstimatedHours,
      remainingHours: remaining(currentGame),
    } : null,
    queuePreview: input.queue.slice(0, 5),
  };
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
