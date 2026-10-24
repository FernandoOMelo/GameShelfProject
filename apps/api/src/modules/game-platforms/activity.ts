import type { GameRepository } from '../games/repository.js';
import type { GamePlatformRecord } from './repository.js';

/**
 * Primeiro desbloqueio conhecido entre as plataformas do jogo. A data de início
 * do jogo é derivada disso apenas quando está vazia: uma data declarada pelo
 * usuário nunca é sobrescrita.
 */
export function earliestActivityStart(
  links: ReadonlyArray<Pick<GamePlatformRecord, 'externalActivityStartedAt'>>,
): Date | null {
  let earliest: Date | null = null;
  for (const link of links) {
    const value = link.externalActivityStartedAt;
    if (value && (!earliest || value < earliest)) earliest = value;
  }
  return earliest;
}

export async function setGameStartIfMissing(
  games: Pick<GameRepository, 'find' | 'update'>,
  gameId: string,
  startedAt: Date | null,
): Promise<boolean> {
  if (!startedAt) return false;
  const game = await games.find(gameId);
  if (!game || game.startedAt) return false;
  const updated = await games.update(gameId, { startedAt: startedAt.toISOString().slice(0, 10) });
  return Boolean(updated);
}
