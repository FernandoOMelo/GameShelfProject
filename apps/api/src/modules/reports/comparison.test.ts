import { describe, expect, it } from 'vitest';
import type { Playthrough } from '@gameshelf/contracts';
import { buildComparisonReport } from './comparison.js';
import { id, makeGame, makeSession } from './fixtures.js';

const games = [
  makeGame(1, { status: 'COMPLETED', completedAt: '2025-03-01' }),
  makeGame(2, { status: 'COMPLETED', completedAt: '2026-03-01' }),
  makeGame(3, { status: 'COMPLETED', completedAt: '2026-04-01' }),
];
const sessions = [
  makeSession(id(1), '2025-02-01T10:00:00.000Z', 60), makeSession(id(1), '2025-02-02T10:00:00.000Z', 60),
  makeSession(id(2), '2026-02-01T10:00:00.000Z', 180), makeSession(id(3), '2026-02-02T10:00:00.000Z', 60),
];
const journey = (n: number, startedAt: string | null, status: Playthrough['status'] = 'PLAYING'): Playthrough => ({
  id: id(500 + n), gameId: id(1), sequence: n, label: null, status, primaryPlatformId: null, startedAt, completedAt: null,
  notes: null, isReplay: n > 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});
const a = { from: '2025-01-01', to: '2025-12-31' };
const b = { from: '2026-01-01', to: '2026-12-31' };
const unlocks = [{ gameId: id(2), unlockedAt: new Date('2026-02-01T12:00:00.000Z'), platformId: id(200), name: 'X', description: null, iconUrl: null }];

describe('buildComparisonReport', () => {
  const report = buildComparisonReport({
    games, sessions, a, b, unlocks,
    playthroughs: [journey(1, '2025-05-01'), journey(2, '2026-05-01'), journey(3, '2026-06-01'), journey(4, null, 'PLANNED')],
  });
  const value = (key: string) => report.metrics.find((metric) => metric.key === key)!;

  it('compara tempo, sessões e médias entre os períodos', () => {
    expect(value('TOTAL_MINUTES')).toEqual({ key: 'TOTAL_MINUTES', a: 120, b: 240, differencePercent: 100 });
    expect(value('SESSIONS')).toMatchObject({ a: 2, b: 2, differencePercent: 0 });
    expect(value('AVERAGE_SESSION_MINUTES')).toMatchObject({ a: 60, b: 120 });
    expect(report.topGame).toEqual({ a: 'Jogo 1', b: 'Jogo 2' });
  });

  it('compara conclusões, jornadas iniciadas e conquistas', () => {
    expect(value('GAMES_COMPLETED')).toMatchObject({ a: 1, b: 2, differencePercent: 100 });
    expect(value('JOURNEYS_STARTED')).toMatchObject({ a: 1, b: 2 });
    expect(value('ACHIEVEMENTS')).toMatchObject({ a: 0, b: 1, differencePercent: null });
  });

  it('omite conquistas sem o espelho e não divide por zero', () => {
    const without = buildComparisonReport({ games: [], sessions: [], playthroughs: [], a, b });
    expect(without.metrics.map((metric) => metric.key)).not.toContain('ACHIEVEMENTS');
    expect(without.metrics.every((metric) => metric.differencePercent === null)).toBe(true);
    expect(without.topGame).toEqual({ a: null, b: null });
  });
});
