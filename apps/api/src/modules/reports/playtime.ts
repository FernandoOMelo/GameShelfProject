import type { Game, PlaytimeReport, Session } from '@gameshelf/contracts';

type Named = { id: string; name: string };
type Input = {
  games: Game[]; sessions: Session[]; platforms: Named[]; genres: Named[];
  from?: string; to?: string; platformId?: string; genreId?: string; timezoneOffsetMinutes?: number;
};
type Bucket = { minutes: number; sessions: number };

const TOP_LIMIT = 10;
const LENGTHS = [['UP_TO_30', 30], ['UP_TO_60', 60], ['UP_TO_120', 120], ['UP_TO_240', 240]] as const;

/**
 * Relatório de tempo de jogo (ADR-041). Considera só sessões encerradas e atribui
 * cada uma ao dia local de início, a mesma regra do heatmap de atividade. Um jogo
 * com vários gêneros soma o tempo em cada um, então as partes por gênero podem
 * passar de 100%.
 */
export function buildPlaytimeReport({ games, sessions, platforms, genres, from, to, platformId, genreId, timezoneOffsetMinutes = 0 }: Input): PlaytimeReport {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const closed = sessions
    .filter((session) => session.durationMinutes !== null && session.durationMinutes > 0)
    .map((session) => ({ session, minutes: session.durationMinutes!, local: new Date(Date.parse(session.startedAt) - timezoneOffsetMinutes * 60_000) }));

  const availableYears = [...new Set(closed.map(({ local }) => local.getUTCFullYear()))].sort((a, b) => a - b);

  const rows = closed.filter(({ session, local }) => {
    const day = local.toISOString().slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (platformId && session.platformId !== platformId) return false;
    if (genreId && !gameById.get(session.gameId)?.genreIds.includes(genreId)) return false;
    return true;
  });

  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const add = <K>(map: Map<K, Bucket>, key: K, minutes: number) => {
    const bucket = map.get(key) ?? { minutes: 0, sessions: 0 };
    bucket.minutes += minutes; bucket.sessions += 1; map.set(key, bucket);
  };

  const months = new Map<string, Bucket>();
  const years = new Map<number, Bucket>();
  const weekdays = new Map<number, Bucket>();
  const hours = new Map<number, Bucket>();
  const platformTotals = new Map<string | null, Bucket>();
  const genreTotals = new Map<string, Bucket>();
  const developerTotals = new Map<string, Bucket>();
  const gameTotals = new Map<string, Bucket>();
  const days = new Set<string>();
  const lengths = new Map<string, number>();

  for (const { session, minutes, local } of rows) {
    days.add(local.toISOString().slice(0, 10));
    add(months, local.toISOString().slice(0, 7), minutes);
    add(years, local.getUTCFullYear(), minutes);
    add(weekdays, local.getUTCDay(), minutes);
    add(hours, local.getUTCHours(), minutes);
    add(platformTotals, session.platformId, minutes);
    add(gameTotals, session.gameId, minutes);
    const game = gameById.get(session.gameId);
    for (const id of game?.genreIds ?? []) add(genreTotals, id, minutes);
    if (game?.developer) add(developerTotals, game.developer, minutes);
    const key = LENGTHS.find(([, limit]) => minutes <= limit)?.[0] ?? 'OVER_240';
    lengths.set(key, (lengths.get(key) ?? 0) + 1);
  }

  const share = (minutes: number) => totalMinutes === 0 ? 0 : Math.round((minutes / totalMinutes) * 1000) / 10;
  const rank = <K>(map: Map<K, Bucket>, describe: (key: K) => { id: string | null; name: string }, limit = TOP_LIMIT) =>
    [...map].map(([key, bucket]) => ({ ...describe(key), ...bucket, share: share(bucket.minutes) }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'pt-BR')).slice(0, limit);
  const platformName = new Map(platforms.map((platform) => [platform.id, platform.name]));
  const genreName = new Map(genres.map((genre) => [genre.id, genre.name]));

  const byMonth = [...months].map(([month, bucket]) => ({ month, ...bucket })).sort((a, b) => a.month.localeCompare(b.month));
  const busiest = <T extends Bucket>(entries: T[]) => entries.reduce<T | null>((best, entry) => !best || entry.minutes > best.minutes ? entry : best, null);
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, ...(weekdays.get(weekday) ?? { minutes: 0, sessions: 0 }) }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, ...(hours.get(hour) ?? { minutes: 0, sessions: 0 }) }));
  const bestWeekday = busiest(byWeekday);
  const bestHour = busiest(byHour);

  return {
    totalMinutes, sessionCount: rows.length,
    averageSessionMinutes: rows.length === 0 ? 0 : Math.round(totalMinutes / rows.length),
    activeDays: days.size, availableYears,
    byMonth,
    byYear: [...years].map(([year, bucket]) => ({ year, ...bucket })).sort((a, b) => a.year - b.year),
    byWeekday, byHour,
    sessionLengths: [...LENGTHS.map(([key]) => key), 'OVER_240' as const].map((key) => ({ key, sessions: lengths.get(key) ?? 0 })),
    byPlatform: rank(platformTotals, (id) => ({ id, name: id === null ? 'Sem plataforma' : platformName.get(id) ?? 'Plataforma removida' })),
    byGenre: rank(genreTotals, (id) => ({ id, name: genreName.get(id) ?? 'Gênero removido' })),
    byDeveloper: rank(developerTotals, (name) => ({ id: null, name })),
    topGames: rank(gameTotals, (id) => ({ id, name: gameById.get(id)?.title ?? 'Jogo removido' }), 15),
    highlights: {
      busiestWeekday: bestWeekday && bestWeekday.minutes > 0 ? bestWeekday.weekday : null,
      busiestMonth: busiest(byMonth)?.month ?? null,
      peakHour: bestHour && bestHour.minutes > 0 ? bestHour.hour : null,
      averageMonthlyMinutes: byMonth.length === 0 ? 0 : Math.round(totalMinutes / byMonth.length),
    },
  };
}
