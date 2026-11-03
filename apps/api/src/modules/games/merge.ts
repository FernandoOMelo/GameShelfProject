import type { DuplicateGameGroup } from '@gameshelf/contracts';
import type { GameRecord } from './repository.js';

/**
 * Chave de comparação de títulos: sem acento, caixa, pontuação nem marcas
 * ("™", "®"). Dois cadastros com a mesma chave são candidatos a duplicata —
 * nunca são mesclados automaticamente.
 */
export function duplicateKey(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findDuplicateGroups(games: Array<Pick<GameRecord, 'id' | 'title'>>): DuplicateGameGroup[] {
  const byKey = new Map<string, string[]>();
  for (const game of games) {
    const key = duplicateKey(game.title);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), game.id]);
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, gameIds]) => ({ key, gameIds }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// Quanto mais adiantado o jogo, mais ele diz sobre a história real do usuário.
const statusRank: Record<GameRecord['status'], number> = {
  DESIRED: 0, BACKLOG: 1, QUEUED: 1, PAUSED: 2, ABANDONED: 3, PLAYING: 4, COMPLETED: 5,
};

export type MergedGameFields = {
  description: string | null; coverUrl: string | null; backgroundUrl: string | null;
  releaseYear: number | null; developer: string | null; publisher: string | null;
  franchiseId: string | null; platformId: string | null;
  status: GameRecord['status']; archived: boolean; owned: boolean; favorite: boolean; gameOfYear: boolean;
  startedAt: string | null; completedAt: string | null;
  estimatedMainHours: string | number | null; estimatedCompletionistHours: string | number | null; personalEstimatedHours: string | number | null;
  retroactivePlayedHours: number; rating: number | null; difficulty: GameRecord['difficulty'];
  gameType: string | null; completionCondition: string | null; notes: string | null;
};

const firstFilled = <T>(preferred: T | null, fallback: T | null): T | null => (preferred !== null && preferred !== '' ? preferred : fallback);

/**
 * Campos do jogo resultante. O cadastro que permanece (`target`) vence em
 * conflito de texto e metadados; lacunas são preenchidas pelo absorvido. O
 * estado de progresso vem do cadastro mais adiantado, e as horas lançadas sem
 * sessão somam, porque cada cadastro guardava tempo diferente.
 */
export function mergeGameFields(target: GameRecord, source: GameRecord): MergedGameFields {
  const winner = statusRank[source.status] > statusRank[target.status] ? source : target;
  const loser = winner === target ? source : target;
  const status = winner.status;
  const starts = [target.startedAt, source.startedAt].filter((value): value is string => value !== null).sort();
  const completedAt = winner.completedAt ?? (status === 'COMPLETED' ? loser.completedAt : null);
  let startedAt = starts[0] ?? null;
  if (startedAt && completedAt && completedAt < startedAt) startedAt = completedAt;
  const notes = target.notes && source.notes && target.notes.trim() !== source.notes.trim()
    ? `${target.notes.trim()}\n\n---\n${source.notes.trim()}`
    : firstFilled(target.notes, source.notes);
  return {
    description: firstFilled(target.description, source.description),
    coverUrl: firstFilled(target.coverUrl, source.coverUrl),
    backgroundUrl: firstFilled(target.backgroundUrl, source.backgroundUrl),
    releaseYear: firstFilled(target.releaseYear, source.releaseYear),
    developer: firstFilled(target.developer, source.developer),
    publisher: firstFilled(target.publisher, source.publisher),
    franchiseId: firstFilled(target.franchiseId, source.franchiseId),
    platformId: firstFilled(target.platformId, source.platformId),
    status,
    archived: target.archived && source.archived,
    owned: target.owned || source.owned,
    favorite: target.favorite || source.favorite,
    gameOfYear: completedAt !== null && (target.gameOfYear || source.gameOfYear),
    startedAt,
    completedAt,
    estimatedMainHours: firstFilled(target.estimatedMainHours, source.estimatedMainHours),
    estimatedCompletionistHours: firstFilled(target.estimatedCompletionistHours, source.estimatedCompletionistHours),
    personalEstimatedHours: firstFilled(target.personalEstimatedHours, source.personalEstimatedHours),
    retroactivePlayedHours: Math.round((Number(target.retroactivePlayedHours) + Number(source.retroactivePlayedHours)) * 100) / 100,
    rating: firstFilled(winner.rating, loser.rating),
    difficulty: firstFilled(target.difficulty, source.difficulty),
    gameType: firstFilled(target.gameType, source.gameType),
    completionCondition: firstFilled(target.completionCondition, source.completionCondition),
    notes,
  };
}

export interface GameMergeRepository {
  /** Mescla `sourceId` em `targetId` numa única transação; `false` se algum não existir. */
  merge(targetId: string, sourceId: string): Promise<boolean>;
}
