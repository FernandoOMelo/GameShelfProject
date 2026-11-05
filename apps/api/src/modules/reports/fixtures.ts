import type { Game, Session } from '@gameshelf/contracts';

export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const base: Game = {
  id: id(1), title: 'Base', description: null, coverUrl: null, backgroundUrl: null,
  releaseYear: null, developer: null, publisher: null, franchiseId: null, platformId: null, platformIds: [], genreIds: [], status: 'PLAYING',
  rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false,
  owned: true, archived: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
export const makeGame = (n: number, values: Partial<Game> = {}): Game => ({ ...base, id: id(n), title: `Jogo ${n}`, ...values });

export const makeSession = (gameId: string, startedAt: string, durationMinutes: number | null, platformId: string | null = null): Session => ({
  id: id(900), gameId, startedAt, endedAt: durationMinutes === null ? null : startedAt, durationMinutes,
  progress: null, location: null, notes: null, keyDecisions: null, tips: null, playthroughId: null, platformId, createdAt: startedAt, updatedAt: startedAt,
});
