import type { Game, ReplayResponse, Session } from '@gameshelf/contracts';

type Catalog = { id: string; name: string };
type Input = { games: Game[]; sessions: Session[]; genres: Catalog[]; year: number; timezoneOffsetMinutes?: number };

// Resumo de um ano: só sessões encerradas com início no ano (dia local) entram nas horas.
// "Jogo do ano" e zerados seguem a data de conclusão do jogo.
export function buildReplay({ games, sessions, genres, year, timezoneOffsetMinutes = 0 }: Input): ReplayResponse {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  const minutesByGame = new Map<string, number>();
  const minutesByGenre = new Map<string, number>();
  const minutesByMonth = new Map<number, number>();
  const days = new Set<string>();
  let totalMinutes = 0;
  let sessionCount = 0;
  let longest: { gameId: string; date: string; minutes: number } | null = null;

  for (const session of sessions) {
    if (session.durationMinutes === null || session.durationMinutes <= 0) continue;
    const date = new Date(Date.parse(session.startedAt) - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    if (!date.startsWith(`${year}-`)) continue;
    const game = gamesById.get(session.gameId);
    if (!game) continue;
    const minutes = session.durationMinutes;
    totalMinutes += minutes;
    sessionCount += 1;
    days.add(date);
    minutesByGame.set(game.id, (minutesByGame.get(game.id) ?? 0) + minutes);
    for (const genreId of game.genreIds) if (genreNames.has(genreId)) minutesByGenre.set(genreId, (minutesByGenre.get(genreId) ?? 0) + minutes);
    const month = Number(date.slice(5, 7));
    minutesByMonth.set(month, (minutesByMonth.get(month) ?? 0) + minutes);
    if (!longest || minutes > longest.minutes) longest = { gameId: game.id, date, minutes };
  }

  const topGame = best(minutesByGame, (id) => gamesById.get(id)!.title);
  const topGenre = best(minutesByGenre, (id) => genreNames.get(id)!);
  const topMonth = [...minutesByMonth].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const winner = games.find((game) => game.gameOfYear && game.completedAt?.startsWith(`${year}-`));
  const playedMinutes = (game: Game) => minutesByGame.get(game.id) ?? 0;

  return {
    year, totalMinutes, sessionCount, activeDays: days.size,
    completedCount: games.filter((game) => game.status === 'COMPLETED' && game.completedAt?.startsWith(`${year}-`)).length,
    mostPlayedGame: topGame ? { id: topGame[0], title: gamesById.get(topGame[0])!.title, coverUrl: gamesById.get(topGame[0])!.coverUrl, minutes: topGame[1] } : null,
    topGenre: topGenre ? { name: genreNames.get(topGenre[0])!, minutes: topGenre[1] } : null,
    longestSession: longest ? { gameId: longest.gameId, title: gamesById.get(longest.gameId)!.title, date: longest.date, minutes: longest.minutes } : null,
    busiestMonth: topMonth ? { month: topMonth[0], minutes: topMonth[1] } : null,
    gameOfYear: winner ? { id: winner.id, title: winner.title, coverUrl: winner.coverUrl, hours: Math.round(playedMinutes(winner) / 6) / 10 } : null,
  };
}

// Maior total; empate decidido pelo nome para o resultado ser estável.
function best(totals: Map<string, number>, nameOf: (id: string) => string): [string, number] | undefined {
  return [...totals].sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]), 'pt-BR'))[0];
}
