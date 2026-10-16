import { describe, expect, it } from 'vitest';
import type { Session } from '@gameshelf/contracts';
import { buildActivity } from './activity.js';

const id = '00000000-0000-4000-8000-000000000001';
const session = (startedAt: string, durationMinutes: number | null): Session => ({
  id, gameId: id, startedAt, endedAt: durationMinutes === null ? null : startedAt, durationMinutes,
  progress: null, location: null, notes: null, keyDecisions: null, tips: null, createdAt: startedAt, updatedAt: startedAt,
});

describe('activity', () => {
  it('sums minutes per day and ignores open sessions and other years', () => {
    const result = buildActivity({
      sessions: [session('2026-03-01T10:00:00.000Z', 60), session('2026-03-01T20:00:00.000Z', 30), session('2026-03-02T10:00:00.000Z', null), session('2025-12-31T10:00:00.000Z', 45)],
      year: 2026, today: '2026-06-01',
    });
    expect(result.days).toEqual([{ date: '2026-03-01', minutes: 90 }]);
    expect(result).toMatchObject({ activeDays: 1, totalMinutes: 90, maxDayMinutes: 90 });
  });

  it('assigns sessions to the local day using the timezone offset', () => {
    // 01:00 UTC em UTC-3 (offset 180) ainda é o dia anterior.
    const result = buildActivity({ sessions: [session('2026-03-02T01:00:00.000Z', 30)], year: 2026, today: '2026-06-01', timezoneOffsetMinutes: 180 });
    expect(result.days).toEqual([{ date: '2026-03-01', minutes: 30 }]);
  });

  it('computes the longest streak across years and the current streak ending today', () => {
    const sessions = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-03', '2026-01-09', '2026-01-10'].map((day) => session(`${day}T12:00:00.000Z`, 20));
    const result = buildActivity({ sessions, year: 2026, today: '2026-01-10' });
    expect(result.longestStreak).toBe(3);
    expect(result.currentStreak).toBe(2);
  });

  it('keeps the current streak alive when the last session was yesterday, and resets it after a gap', () => {
    const sessions = [session('2026-01-08T12:00:00.000Z', 20), session('2026-01-09T12:00:00.000Z', 20)];
    expect(buildActivity({ sessions, year: 2026, today: '2026-01-10' }).currentStreak).toBe(2);
    expect(buildActivity({ sessions, year: 2026, today: '2026-01-11' }).currentStreak).toBe(0);
  });

  it('is empty without sessions', () => {
    expect(buildActivity({ sessions: [], year: 2026, today: '2026-01-10' })).toEqual({ year: 2026, days: [], activeDays: 0, totalMinutes: 0, maxDayMinutes: 0, currentStreak: 0, longestStreak: 0 });
  });
});
