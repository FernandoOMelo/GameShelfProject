import type { GameRepository } from '../games/repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { ChallengeCompletionRepository, MainChallengeRepository } from './repository.js';
import { detectChallengeCompletion } from './service.js';

export type ChallengeTracking = { lists: GameListRepository; challenge: MainChallengeRepository; completions: ChallengeCompletionRepository };

/**
 * Depois que um jogo é zerado, registra as missões baseadas em lista que isso
 * completou. Compartilhado pela edição do jogo e pelo comando de zerar.
 */
export async function recordChallengeCompletion(
  tracking: ChallengeTracking | undefined,
  games: GameRepository,
  updated: { id: string; status: string; completedAt: string | null },
) {
  if (!tracking) return;
  // Toda missão baseada em lista pode ser concluída, não só a principal.
  const challenges = await tracking.challenge.listAll?.() ?? [await tracking.challenge.get()];
  const stored = await games.list();
  const gamesById = new Map<string, { status: string; completedAt: string | null }>(
    stored.map((game) => [game.id, { status: game.status, completedAt: game.completedAt }]),
  );
  gamesById.set(updated.id, { status: updated.status, completedAt: updated.completedAt });
  for (const challenge of challenges) {
    if (!challenge) continue;
    const list = await tracking.lists.find(challenge.listId);
    if (!list) continue;
    const completion = detectChallengeCompletion(challenge, list.gameIds, gamesById);
    if (completion) await tracking.completions.record(completion);
  }
}
