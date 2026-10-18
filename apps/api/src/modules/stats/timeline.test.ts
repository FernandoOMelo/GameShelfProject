import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { buildTimeline } from './timeline.js';

const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

function makeGame(overrides: Partial<Game> & Pick<Game, 'id' | 'title'>): Game {
  return {
    description: null, coverUrl: null, backgroundUrl: null, releaseYear: null, developer: null, publisher: null,
    franchiseId: null, platformId: null, platformIds: [], genreIds: [], rating: null, owned: true, archived: false,
    startedAt: null, completedAt: null, status: 'BACKLOG', priority: 'NORMAL',
    estimatedMainHours: null, estimatedCompletionistHours: null, personalEstimatedHours: null,
    retroactivePlayedHours: 0, difficulty: null, gameType: null, completionCondition: null,
    favorite: false, gameOfYear: false, excludedFromSuggestions: false, notes: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Game;
}

function makeSession(overrides: Partial<Session> & Pick<Session, 'id' | 'gameId' | 'startedAt'>): Session {
  return {
    endedAt: '2026-03-01T12:00:00.000Z', durationMinutes: 60, progress: null, location: null, notes: null,
    createdAt: '2026-03-01T12:00:00.000Z', updatedAt: '2026-03-01T12:00:00.000Z',
    ...overrides,
  } as Session;
}

describe('buildTimeline', () => {
  it('orders every event source newest first', () => {
    const game = makeGame({ id: id(1), title: 'Hollow Knight', createdAt: '2026-10-06T10:00:00.000Z', startedAt: '2026-10-12', completedAt: '2026-10-09' });
    const result = buildTimeline({
      games: [game],
      sessions: [makeSession({ id: id(20), gameId: id(1), startedAt: '2026-10-07T20:00:00.000Z', endedAt: '2026-10-07T21:30:00.000Z', durationMinutes: 90 })],
      completions: [{ title: 'Zerar os clássicos', gamesCount: 3, completedAt: '2026-10-11T00:00:00.000Z' }],
      limit: 50,
    });

    expect(result.events.map((event) => [event.type, event.date])).toEqual([
      ['GAME_STARTED', '2026-10-12'],
      ['CHALLENGE_COMPLETED', '2026-10-11'],
      ['GAME_COMPLETED', '2026-10-09'],
      ['SESSION', '2026-10-07'],
      ['GAME_ADDED', '2026-10-06'],
    ]);
    expect(result.nextBefore).toBeNull();
  });

  it('carries the session fields shown in the game details', () => {
    const result = buildTimeline({
      games: [makeGame({ id: id(1), title: 'Hades', coverUrl: '/media/hades.jpg' })],
      sessions: [makeSession({ id: id(20), gameId: id(1), startedAt: '2026-03-01T11:00:00.000Z', durationMinutes: 60, progress: 40, location: 'Elysium', notes: 'Boa run' })],
      completions: [],
      limit: 50,
    });

    expect(result.events.find((event) => event.type === 'SESSION')).toMatchObject({
      gameTitle: 'Hades', coverUrl: '/media/hades.jpg', durationMinutes: 60, progress: 40, location: 'Elysium', notes: 'Boa run',
    });
  });

  it('ignores open sessions and sessions without a known game', () => {
    const result = buildTimeline({
      games: [makeGame({ id: id(1), title: 'Hades' })],
      sessions: [
        makeSession({ id: id(20), gameId: id(1), startedAt: '2026-03-02T11:00:00.000Z', endedAt: null, durationMinutes: null }),
        makeSession({ id: id(21), gameId: id(99), startedAt: '2026-03-03T11:00:00.000Z' }),
      ],
      completions: [],
      limit: 50,
    });

    expect(result.events.filter((event) => event.type === 'SESSION')).toEqual([]);
  });

  it('paginates with nextBefore and keeps the cursor exclusive', () => {
    const games = [
      makeGame({ id: id(1), title: 'Um', createdAt: '2026-05-03T00:00:00.000Z' }),
      makeGame({ id: id(2), title: 'Dois', createdAt: '2026-05-02T00:00:00.000Z' }),
      makeGame({ id: id(3), title: 'Três', createdAt: '2026-05-01T00:00:00.000Z' }),
    ];
    const first = buildTimeline({ games, sessions: [], completions: [], limit: 2 });
    expect(first.events.map((event) => event.date)).toEqual(['2026-05-03', '2026-05-02']);
    expect(first.nextBefore).toBe('2026-05-02T00:00:00.000Z');

    const second = buildTimeline({ games, sessions: [], completions: [], limit: 2, before: first.nextBefore! });
    expect(second.events.map((event) => event.date)).toEqual(['2026-05-01']);
    expect(second.nextBefore).toBeNull();
  });

  it('assigns session days using the local timezone offset', () => {
    const result = buildTimeline({
      games: [makeGame({ id: id(1), title: 'Hades' })],
      sessions: [makeSession({ id: id(20), gameId: id(1), startedAt: '2026-03-02T02:00:00.000Z', endedAt: '2026-03-02T03:00:00.000Z' })],
      completions: [],
      limit: 50,
      timezoneOffsetMinutes: 180,
    });

    expect(result.events.find((event) => event.type === 'SESSION')?.date).toBe('2026-03-01');
  });

  it('returns nothing when there is no history', () => {
    expect(buildTimeline({ games: [], sessions: [], completions: [], limit: 50 })).toEqual({ events: [], nextBefore: null });
  });
});
