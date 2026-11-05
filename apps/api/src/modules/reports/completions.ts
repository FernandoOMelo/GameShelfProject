import type { CompletionsReport, Game, Session } from '@gameshelf/contracts';

type Reference = 'MAIN' | 'COMPLETIONIST' | 'PERSONAL';
type Sort = 'TITLE' | 'DIFFERENCE_DESC' | 'DIFFERENCE_ASC' | 'PLAYED_DESC';
type Input = {
  games: Game[]; sessions: Session[]; from?: string; to?: string;
  reference?: Reference; sort?: Sort; page?: number; pageSize?: number; now?: Date;
};
type Row = CompletionsReport['estimates']['rows'][number];

const DAY_MS = 86_400_000;
const STARTED = new Set<Game['status']>(['PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED']);
const estimateOf: Record<Reference, (game: Game) => number | null> = {
  MAIN: (game) => game.estimatedMainHours,
  COMPLETIONIST: (game) => game.estimatedCompletionistHours,
  PERSONAL: (game) => game.personalEstimatedHours,
};
const order: Record<Sort, (a: Row, b: Row) => number> = {
  TITLE: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
  DIFFERENCE_DESC: (a, b) => b.differencePercent - a.differencePercent,
  DIFFERENCE_ASC: (a, b) => a.differencePercent - b.differencePercent,
  PLAYED_DESC: (a, b) => b.playedHours - a.playedHours,
};

/**
 * Relatório de conclusões (ADR-041). O funil é um retrato do estado atual da
 * biblioteca; período, séries mensais, tempo para zerar e estimativas olham só os
 * jogos zerados dentro do período (pela data de conclusão). As horas jogadas são
 * as sessões encerradas mais as horas retroativas do jogo.
 */
export function buildCompletionsReport({ games, sessions, from, to, reference = 'MAIN', sort = 'DIFFERENCE_DESC', page = 1, pageSize = 20, now = new Date() }: Input): CompletionsReport {
  const minutesByGame = new Map<string, number>();
  const lastSessionByGame = new Map<string, number>();
  for (const session of sessions) {
    if (session.durationMinutes !== null) minutesByGame.set(session.gameId, (minutesByGame.get(session.gameId) ?? 0) + session.durationMinutes);
    lastSessionByGame.set(session.gameId, Math.max(lastSessionByGame.get(session.gameId) ?? 0, Date.parse(session.startedAt)));
  }

  const count = (status: Game['status']) => games.filter((game) => game.status === status).length;
  const started = games.filter((game) => STARTED.has(game.status)).length;
  const completed = count('COMPLETED');
  const percent = (part: number) => started === 0 ? 0 : round((part / started) * 100);

  const inRange = games.filter((game) => game.status === 'COMPLETED' && game.completedAt !== null
    && (!from || game.completedAt >= from) && (!to || game.completedAt <= to));

  const months = new Map<string, number>();
  const years = new Map<number, number>();
  for (const game of inRange) {
    const month = game.completedAt!.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    const year = Number(month.slice(0, 4));
    years.set(year, (years.get(year) ?? 0) + 1);
  }

  const spans = inRange.filter((game) => game.startedAt !== null)
    .map((game) => (Date.parse(game.completedAt!) - Date.parse(game.startedAt!)) / DAY_MS).filter((days) => days >= 0);

  const compared: Row[] = inRange.flatMap((game) => {
    const estimated = estimateOf[reference](game);
    const played = (minutesByGame.get(game.id) ?? 0) / 60 + game.retroactivePlayedHours;
    if (estimated === null || estimated <= 0 || played <= 0) return [];
    return [{
      gameId: game.id, title: game.title, completedAt: game.completedAt!,
      estimatedHours: round(estimated), playedHours: round(played),
      differencePercent: round(((played - estimated) / estimated) * 100),
    }];
  });
  const sorted = [...compared].sort((a, b) => order[sort](a, b) || a.title.localeCompare(b.title, 'pt-BR'));

  const stalled = games.filter((game) => game.status === 'PAUSED').map((game) => {
    const last = Math.max(lastSessionByGame.get(game.id) ?? 0, Date.parse(game.updatedAt));
    return { gameId: game.id, title: game.title, lastActivityAt: new Date(last).toISOString(), daysIdle: Math.max(0, Math.floor((now.getTime() - last) / DAY_MS)) };
  }).sort((a, b) => b.daysIdle - a.daysIdle).slice(0, 10);

  return {
    funnel: { started, completed, paused: count('PAUSED'), abandoned: count('ABANDONED'), completionRate: percent(completed), abandonmentRate: percent(count('ABANDONED')) },
    completedInRange: inRange.length,
    averageDaysToComplete: spans.length === 0 ? null : round(spans.reduce((sum, days) => sum + days, 0) / spans.length),
    byMonth: [...months].map(([month, total]) => ({ month, count: total })).sort((a, b) => a.month.localeCompare(b.month)),
    byYear: [...years].map(([year, total]) => ({ year, count: total })).sort((a, b) => a.year - b.year),
    estimates: {
      reference, compared: compared.length,
      overCount: compared.filter((row) => row.differencePercent > 0).length,
      underCount: compared.filter((row) => row.differencePercent < 0).length,
      averageDifferencePercent: compared.length === 0 ? null : round(compared.reduce((sum, row) => sum + row.differencePercent, 0) / compared.length),
      page, pageSize, total: sorted.length,
      rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    },
    stalled,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
