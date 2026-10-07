import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { buildReplay } from './replay.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base: Game = {
  id: id(1), title: 'Base', description: null, coverUrl: null, backgroundUrl: null,
  releaseYear: null, developer: null, publisher: null, franchiseId: null, platformId: null, genreIds: [], status: 'PLAYING',
  rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false,
  owned: true, archived: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const make = (n: number, values: Partial<Game> = {}): Game => ({ ...base, id: id(n), title: `Jogo ${n}`, ...values });
const session = (gameId: string, startedAt: string, durationMinutes: number | null): Session => ({
  id: id(900), gameId, startedAt, endedAt: durationMinutes === null ? null : startedAt, durationMinutes,
  progress: null, location: null, notes: null, createdAt: startedAt, updatedAt: startedAt,
});
const rpg = { id: id(100), name: 'RPG' };
const action = { id: id(101), name: 'Ação' };

describe('replay', () => {
  it('summarises the year from sessions, ignoring open sessions and other years', () => {
    const games = [make(1, { genreIds: [rpg.id] }), make(2, { genreIds: [rpg.id, action.id] })];
    const sessions = [
      session(id(1), '2026-02-01T10:00:00.000Z', 60), session(id(1), '2026-02-02T10:00:00.000Z', 120),
      session(id(2), '2026-05-01T10:00:00.000Z', 90), session(id(2), '2026-05-02T10:00:00.000Z', null), session(id(2), '2025-05-01T10:00:00.000Z', 500),
    ];
    const replay = buildReplay({ games, sessions, genres: [rpg, action], year: 2026 });
    expect(replay).toMatchObject({ totalMinutes: 270, sessionCount: 3, activeDays: 3 });
    expect(replay.mostPlayedGame).toMatchObject({ id: id(1), minutes: 180 });
    expect(replay.topGenre).toEqual({ name: 'RPG', minutes: 270 });
    expect(replay.longestSession).toEqual({ gameId: id(1), title: 'Jogo 1', date: '2026-02-02', minutes: 120 });
    expect(replay.busiestMonth).toEqual({ month: 2, minutes: 180 });
  });

  it('counts completions and game of the year by completion date', () => {
    const games = [
      make(1, { status: 'COMPLETED', completedAt: '2026-03-01', gameOfYear: true }),
      make(2, { status: 'COMPLETED', completedAt: '2026-04-01' }),
      make(3, { status: 'COMPLETED', completedAt: '2025-04-01', gameOfYear: true }),
    ];
    const replay = buildReplay({ games, sessions: [session(id(1), '2026-03-01T10:00:00.000Z', 90)], genres: [], year: 2026 });
    expect(replay.completedCount).toBe(2);
    expect(replay.gameOfYear).toMatchObject({ id: id(1), hours: 1.5 });
  });

  it('uses the local day for year boundaries', () => {
    // 01:00 UTC de 01/01/2026 em UTC-3 ainda é 2025.
    const games = [make(1)];
    const sessions = [session(id(1), '2026-01-01T01:00:00.000Z', 30)];
    expect(buildReplay({ games, sessions, genres: [], year: 2026, timezoneOffsetMinutes: 180 }).totalMinutes).toBe(0);
    expect(buildReplay({ games, sessions, genres: [], year: 2025, timezoneOffsetMinutes: 180 }).totalMinutes).toBe(30);
  });

  it('is empty for a year without data', () => {
    expect(buildReplay({ games: [], sessions: [], genres: [], year: 2026 })).toEqual({
      year: 2026, totalMinutes: 0, sessionCount: 0, activeDays: 0, completedCount: 0,
      mostPlayedGame: null, topGenre: null, longestSession: null, busiestMonth: null, gameOfYear: null,
    });
  });
});
