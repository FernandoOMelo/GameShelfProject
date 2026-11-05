import type { BacklogReport, Game, Session } from '@gameshelf/contracts';

type Named = { id: string; name: string };
type Input = { games: Game[]; sessions: Session[]; platforms: Named[]; genres: Named[]; now?: Date };

const DAY_MS = 86_400_000;
const AGING = [['UP_TO_30', 30], ['UP_TO_90', 90], ['UP_TO_180', 180], ['UP_TO_365', 365]] as const;
const round = (value: number) => Math.round(value * 10) / 10;

/** Horas que faltam para um jogo do backlog: estimativa pessoal, senão a da história principal. */
const remainingHours = (game: Game) => game.personalEstimatedHours ?? game.estimatedMainHours;

/**
 * Relatório de biblioteca e backlog (ADR-041). É um retrato do estado atual: a idade
 * de um jogo é o tempo desde que foi cadastrado, e "nunca iniciado" é um jogo do
 * backlog sem data de início, sessões nem horas retroativas.
 */
export function buildBacklogReport({ games, sessions, platforms, genres, now = new Date() }: Input): BacklogReport {
  const played = new Set(sessions.map((session) => session.gameId));
  const backlog = games.filter((game) => game.status === 'BACKLOG' && !game.archived);
  const aged = backlog.map((game) => ({ game, ageDays: Math.max(0, Math.floor((now.getTime() - Date.parse(game.createdAt)) / DAY_MS)) }));

  const aging = [...AGING.map(([key]) => key), 'OVER_365' as const].map((key) => ({
    key,
    games: aged.filter(({ ageDays }) => (AGING.find(([, limit]) => ageDays <= limit)?.[0] ?? 'OVER_365') === key).length,
  }));

  const years = new Map<number, number>();
  for (const game of backlog) if (game.releaseYear !== null) years.set(game.releaseYear, (years.get(game.releaseYear) ?? 0) + 1);

  const group = (keysOf: (game: Game) => Array<string | null>, nameOf: (id: string | null) => string) => {
    const totals = new Map<string | null, { games: number; estimatedHours: number }>();
    for (const game of backlog) {
      for (const key of keysOf(game)) {
        const entry = totals.get(key) ?? { games: 0, estimatedHours: 0 };
        entry.games += 1; entry.estimatedHours += remainingHours(game) ?? 0; totals.set(key, entry);
      }
    }
    return [...totals].map(([id, entry]) => ({ id, name: nameOf(id), games: entry.games, estimatedHours: round(entry.estimatedHours) }))
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 10);
  };
  const genreName = new Map(genres.map((genre) => [genre.id, genre.name]));
  const platformName = new Map(platforms.map((platform) => [platform.id, platform.name]));
  const orNull = (ids: string[]) => ids.length === 0 ? [null] : ids;

  return {
    totals: {
      backlogCount: backlog.length,
      neverStarted: backlog.filter((game) => !game.startedAt && !played.has(game.id) && game.retroactivePlayedHours === 0).length,
      averageAgeDays: aged.length === 0 ? null : round(aged.reduce((sum, { ageDays }) => sum + ageDays, 0) / aged.length),
      estimatedRemainingHours: round(backlog.reduce((sum, game) => sum + (remainingHours(game) ?? 0), 0)),
      withoutEstimate: backlog.filter((game) => remainingHours(game) === null).length,
      desiredCount: games.filter((game) => game.status === 'DESIRED' && !game.archived).length,
      ownedCount: games.filter((game) => game.status !== 'DESIRED' && game.owned && !game.archived).length,
    },
    aging,
    byReleaseYear: [...years].map(([year, count]) => ({ year, games: count })).sort((a, b) => a.year - b.year),
    byGenre: group((game) => orNull(game.genreIds), (id) => id === null ? 'Sem gênero' : genreName.get(id) ?? 'Gênero removido'),
    byPlatform: group((game) => orNull(game.platformIds), (id) => id === null ? 'Sem plataforma' : platformName.get(id) ?? 'Plataforma removida'),
    oldest: [...aged].sort((a, b) => b.ageDays - a.ageDays || a.game.title.localeCompare(b.game.title, 'pt-BR')).slice(0, 10)
      .map(({ game, ageDays }) => ({ gameId: game.id, title: game.title, addedAt: game.createdAt, ageDays, estimatedHours: remainingHours(game) })),
  };
}
