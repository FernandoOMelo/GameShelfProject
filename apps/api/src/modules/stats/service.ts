import type { Game, Session, StatsGroup, StatsResponse } from '@gameshelf/contracts';

type Catalog = { id: string; name: string };
type Input = { games: Game[]; sessions: Session[]; platforms: Catalog[]; genres: Catalog[]; today?: string };
type Key = [key: string, name: string];

const DIFFICULTIES = ['AAA', 'AA', 'A', 'B', 'C'] as const;

// Estatísticas históricas: consideram jogos zerados (inclusive arquivados) e atribuem as horas
// de cada jogo ao ano da sua conclusão.
export function buildStats({ games, sessions, platforms, genres, today = new Date().toISOString().slice(0, 10) }: Input): StatsResponse {
  const minutesByGame = new Map<string, number>();
  for (const session of sessions) {
    if (session.durationMinutes !== null) minutesByGame.set(session.gameId, (minutesByGame.get(session.gameId) ?? 0) + session.durationMinutes);
  }
  const hoursOf = (game: Game) => round((minutesByGame.get(game.id) ?? 0) / 60 + game.retroactivePlayedHours);
  const ref = (game: Game) => ({ id: game.id, title: game.title, coverUrl: game.coverUrl, hours: hoursOf(game) });

  const completed = games.filter((game) => game.status === 'COMPLETED');
  const withHours = completed.filter((game) => hoursOf(game) > 0);
  const longest = [...withHours].sort((a, b) => hoursOf(b) - hoursOf(a))[0];
  const shortest = [...withHours].sort((a, b) => hoursOf(a) - hoursOf(b))[0];

  const dates = [
    ...games.flatMap((game) => [game.startedAt, game.completedAt]),
    ...sessions.map((session) => session.startedAt.slice(0, 10)),
  ].filter((value): value is string => Boolean(value)).sort();
  const journeyStart = dates[0] ?? null;
  const journeyDays = journeyStart
    ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${journeyStart}T00:00:00Z`)) / 86_400_000))
    : 0;

  const ratingCounts = new Map<number, number>();
  for (const game of games) if (game.rating !== null) ratingCounts.set(game.rating, (ratingCounts.get(game.rating) ?? 0) + 1);
  const difficultyCounts = new Map<string, number>();
  for (const game of completed) if (game.difficulty) difficultyCounts.set(game.difficulty, (difficultyCounts.get(game.difficulty) ?? 0) + 1);

  const genreNames = new Map(genres.map((item) => [item.id, item.name]));
  const platformNames = new Map(platforms.map((item) => [item.id, item.name]));
  const byGenre = group(completed, (game) => game.genreIds.filter((id) => genreNames.has(id)).map((id): Key => [id, genreNames.get(id)!]), hoursOf);
  const byType = group(completed, (game) => game.gameType ? [[game.gameType.toLocaleLowerCase(), game.gameType]] : [], hoursOf);
  const byPlatform = group(completed, (game) => game.platformId && platformNames.has(game.platformId) ? [[game.platformId, platformNames.get(game.platformId)!]] : [], hoursOf);

  const years = new Map<number, Game[]>();
  for (const game of completed) {
    if (!game.completedAt) continue;
    const year = Number(game.completedAt.slice(0, 4));
    years.set(year, [...(years.get(year) ?? []), game]);
  }
  const gameOfYearByYear = new Map<number, Game>();
  for (const game of games) if (game.gameOfYear && game.completedAt) gameOfYearByYear.set(Number(game.completedAt.slice(0, 4)), game);
  const byYear = [...new Set([...years.keys(), ...gameOfYearByYear.keys()])].sort((a, b) => b - a).map((year) => {
    const yearGames = years.get(year) ?? [];
    const winner = gameOfYearByYear.get(year);
    return { year, completedCount: yearGames.length, hours: round(yearGames.reduce((sum, game) => sum + hoursOf(game), 0)), gameOfYear: winner ? ref(winner) : null };
  });

  const favorites = games.filter((game) => game.favorite)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title, 'pt-BR'))
    .slice(0, 10).map((game) => ({ ...ref(game), rating: game.rating }));

  return {
    totals: {
      completedCount: completed.length,
      completedHours: round(completed.reduce((sum, game) => sum + hoursOf(game), 0)),
      averageCompletedHours: withHours.length ? round(withHours.reduce((sum, game) => sum + hoursOf(game), 0) / withHours.length) : null,
      longestGame: longest ? ref(longest) : null,
      shortestGame: shortest ? ref(shortest) : null,
      journeyStart,
      journeyDays,
    },
    ratingDistribution: Array.from({ length: 11 }, (_, index) => 11 - index).map((rating) => ({ rating, count: ratingCounts.get(rating) ?? 0 })),
    difficultyDistribution: DIFFICULTIES.map((difficulty) => ({ difficulty, count: difficultyCounts.get(difficulty) ?? 0 })),
    byGenre, byType, byPlatform, byYear, favorites,
    topGenres: topByRating(byGenre, 5),
    topTypes: topByRating(byType, 10),
  };
}

function group(games: Game[], keysOf: (game: Game) => Key[], hoursOf: (game: Game) => number): StatsGroup[] {
  const groups = new Map<string, { name: string; games: Game[] }>();
  for (const game of games) {
    for (const [key, name] of keysOf(game)) {
      const entry = groups.get(key) ?? { name, games: [] };
      entry.games.push(game);
      groups.set(key, entry);
    }
  }
  return [...groups].map(([key, entry]) => {
    const rated = entry.games.filter((game) => game.rating !== null);
    return {
      key, name: entry.name, completedCount: entry.games.length,
      hours: round(entry.games.reduce((sum, game) => sum + hoursOf(game), 0)),
      averageRating: rated.length ? round(rated.reduce((sum, game) => sum + game.rating!, 0) / rated.length) : null,
    };
  }).sort((a, b) => b.completedCount - a.completedCount || a.name.localeCompare(b.name, 'pt-BR'));
}

// Ranking de preferência: média das notas; empate decidido pela quantidade de jogos zerados.
function topByRating(groups: StatsGroup[], limit: number): StatsGroup[] {
  return groups.filter((entry) => entry.averageRating !== null)
    .sort((a, b) => b.averageRating! - a.averageRating! || b.completedCount - a.completedCount || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
