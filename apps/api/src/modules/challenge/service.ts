import type { MainChallenge } from '@gameshelf/contracts';
import type { ChallengeCompletionInput } from './repository.js';

// O desafio acompanha uma lista pessoal: progresso = jogos zerados / jogos da lista.
export function buildChallengeProgress(
  challenge: { title: string; listId: string },
  list: { name: string; gameIds: string[] },
  statusById: Map<string, string>,
): MainChallenge {
  const totalGames = list.gameIds.length;
  const completedGames = list.gameIds.filter((id) => statusById.get(id) === 'COMPLETED').length;
  return {
    title: challenge.title, listId: challenge.listId, listName: list.name, totalGames, completedGames,
    percent: totalGames === 0 ? 0 : Math.round((completedGames / totalGames) * 1000) / 10,
  };
}

export function detectChallengeCompletion(
  challenge: { title: string; listId: string },
  gameIds: string[],
  gamesById: Map<string, { status: string; completedAt: string | null }>,
): ChallengeCompletionInput | null {
  if (gameIds.length === 0) return null;
  const dates: string[] = [];
  for (const gameId of gameIds) {
    const game = gamesById.get(gameId);
    if (!game || game.status !== 'COMPLETED' || !game.completedAt) return null;
    dates.push(game.completedAt);
  }
  const completedAt = dates.reduce((latest, date) => (date > latest ? date : latest));
  return {
    title: challenge.title,
    listId: challenge.listId,
    gamesCount: gameIds.length,
    completedAt: new Date(`${completedAt}T00:00:00.000Z`),
  };
}
