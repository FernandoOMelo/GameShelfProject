import type { MainChallenge } from '@gameshelf/contracts';

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
