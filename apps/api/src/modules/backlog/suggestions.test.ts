import { describe, expect, it } from 'vitest';
import type { Game, QueueItem, Session } from '@gameshelf/contracts';
import { buildSuggestions } from './suggestions.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base: Game = {
  id: id(1), title: 'Base', description: null, coverUrl: null, backgroundUrl: null,
  releaseYear: null, developer: null, publisher: null, franchiseId: null, platformId: null, genreIds: [], status: 'BACKLOG',
  rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false,
  owned: true, archived: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: 40,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null,
  createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z',
};
const make = (n: number, values: Partial<Game> = {}): Game => ({ ...base, id: id(n), title: `Jogo ${n}`, ...values });
const queueOf = (...games: Game[]): QueueItem[] => games.map((game, position) => ({ position, addedAt: '2026-03-01T00:00:00.000Z', game }));
const today = '2026-03-10';

describe('next game suggestions', () => {
  it('only suggests owned, non-archived games that are in the backlog or paused', () => {
    const games = [make(1), make(2, { status: 'PLAYING' }), make(3, { status: 'COMPLETED' }), make(4, { owned: false }), make(5, { archived: true }), make(6, { status: 'PAUSED' }), make(7, { status: 'DESIRED' })];
    expect(buildSuggestions({ games, sessions: [], queue: [], today, limit: 10 }).map((entry) => entry.game.id).sort()).toEqual([id(1), id(6)]);
  });

  it('skips games the user asked not to be suggested', () => {
    const games = [make(1), make(2, { excludedFromSuggestions: true }), make(3, { status: 'PAUSED', excludedFromSuggestions: true })];
    expect(buildSuggestions({ games, sessions: [], queue: [], today, limit: 10 }).map((entry) => entry.game.id)).toEqual([id(1)]);
  });

  it('keeps ignoring a game even when it is first in the queue', () => {
    const ignored = make(2, { excludedFromSuggestions: true, priority: 'HIGH' });
    const result = buildSuggestions({ games: [make(1), ignored], sessions: [], queue: queueOf(ignored), today, limit: 10 });
    expect(result.map((entry) => entry.game.id)).toEqual([id(1)]);
  });

  it('ranks the first in the queue above high priority outside the queue', () => {
    const queued = make(1);
    const high = make(2, { priority: 'HIGH' });
    const result = buildSuggestions({ games: [high, queued], sessions: [], queue: queueOf(queued), today });
    expect(result.map((entry) => entry.game.id)).toEqual([id(1), id(2)]);
    expect(result[0]!.reasons).toContain('Primeiro da fila');
    expect(result[1]!.reasons).toContain('Prioridade alta');
  });

  it('loses queue points with each position, bottoming out after the eighth', () => {
    const games = Array.from({ length: 12 }, (_, index) => make(index + 1));
    const result = buildSuggestions({ games, sessions: [], queue: queueOf(...games), today, limit: 12 });
    expect(result.map((entry) => entry.score)).toEqual([55, 52, 49, 46, 43, 40, 37, 34, 31, 31, 31, 31]);
  });

  it('favours short games and discounts hours already played', () => {
    const short = make(1, { estimatedMainHours: 4 });
    const mediumDone = make(2, { estimatedMainHours: 30, retroactivePlayedHours: 20 });
    const long = make(3, { estimatedMainHours: 60 });
    const result = buildSuggestions({ games: [long, mediumDone, short], sessions: [], queue: [], today });
    expect(result.map((entry) => entry.game.id)).toEqual([id(1), id(2), id(3)]);
    expect(result[0]!.reasons[0]).toBe('Curto: faltam 4 h');
    expect(result[1]!.reasons[0]).toBe('Cabe em pouco tempo: faltam 10 h');
  });

  it('adds a bonus for paused games and for time waiting since the last session', () => {
    const paused = make(1, { status: 'PAUSED', estimatedMainHours: null });
    const session: Session = { id: id(900), gameId: id(1), startedAt: '2025-12-10T10:00:00.000Z', endedAt: '2025-12-10T11:00:00.000Z', durationMinutes: 60, progress: null, location: null, notes: null, keyDecisions: null, tips: null, createdAt: '2025-12-10T11:00:00.000Z', updatedAt: '2025-12-10T11:00:00.000Z' };
    const [result] = buildSuggestions({ games: [paused], sessions: [session], queue: [], today });
    // NORMAL 15 + pausado 8 + 90 dias (3 × 2) = 29
    expect(result!.score).toBe(29);
    expect(result!.reasons).toEqual(['Pausado: dá para retomar de onde parou', 'Esperando há 90 dias']);
  });

  it('breaks ties by title and respects the limit', () => {
    const games = [make(2, { title: 'B' }), make(1, { title: 'A' }), make(3, { title: 'C' })];
    expect(buildSuggestions({ games, sessions: [], queue: [], today, limit: 2 }).map((entry) => entry.game.title)).toEqual(['A', 'B']);
  });
});
