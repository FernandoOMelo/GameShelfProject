import { describe, expect, it } from 'vitest';
import { buildBacklogReport } from './backlog.js';
import { id, makeGame, makeSession } from './fixtures.js';

const rpg = { id: id(100), name: 'RPG' };
const pc = { id: id(200), name: 'PC' };
const now = new Date('2026-06-01T00:00:00.000Z');
const games = [
  makeGame(1, { status: 'BACKLOG', createdAt: '2026-05-20T00:00:00.000Z', genreIds: [rpg.id], platformIds: [pc.id], estimatedMainHours: 10, releaseYear: 2020 }),
  makeGame(2, { status: 'BACKLOG', createdAt: '2025-01-01T00:00:00.000Z', personalEstimatedHours: 5, estimatedMainHours: 30, releaseYear: 2020 }),
  makeGame(3, { status: 'BACKLOG', createdAt: '2026-02-01T00:00:00.000Z', startedAt: '2026-03-01' }),
  makeGame(4, { status: 'BACKLOG', createdAt: '2026-04-01T00:00:00.000Z', archived: true }),
  makeGame(5, { status: 'DESIRED', owned: false }),
  makeGame(6, { status: 'PLAYING', owned: true }),
];
const sessions = [makeSession(id(1), '2026-05-25T10:00:00.000Z', 30)];

describe('buildBacklogReport', () => {
  const report = buildBacklogReport({ games, sessions, platforms: [pc], genres: [rpg], now });

  it('resume o backlog ignorando arquivados', () => {
    expect(report.totals).toEqual({
      backlogCount: 3, neverStarted: 1, averageAgeDays: 216, estimatedRemainingHours: 15, withoutEstimate: 1, desiredCount: 1, ownedCount: 4,
    });
  });

  it('distribui o envelhecimento e os jogos mais antigos', () => {
    expect(report.aging.map((entry) => [entry.key, entry.games])).toEqual([
      ['UP_TO_30', 1], ['UP_TO_90', 0], ['UP_TO_180', 1], ['UP_TO_365', 0], ['OVER_365', 1],
    ]);
    expect(report.oldest[0]).toMatchObject({ title: 'Jogo 2', ageDays: 516, estimatedHours: 5 });
  });

  it('agrupa por ano, gênero e plataforma com as horas que faltam', () => {
    expect(report.byReleaseYear).toEqual([{ year: 2020, games: 2 }]);
    expect(report.byGenre).toEqual([{ id: null, name: 'Sem gênero', games: 2, estimatedHours: 5 }, { id: rpg.id, name: 'RPG', games: 1, estimatedHours: 10 }]);
    expect(report.byPlatform.find((entry) => entry.id === pc.id)).toMatchObject({ name: 'PC', games: 1, estimatedHours: 10 });
  });

  it('funciona com a biblioteca vazia', () => {
    const empty = buildBacklogReport({ games: [], sessions: [], platforms: [], genres: [], now });
    expect(empty.totals).toMatchObject({ backlogCount: 0, averageAgeDays: null, estimatedRemainingHours: 0 });
  });
});
