import { describe, expect, it } from 'vitest';
import type { Game, QueueItem, Session } from '@gameshelf/contracts';
import { buildDashboard, estimateRemainingHours } from './service.js';

const game: Game = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null, coverUrl: null,
  backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null, franchiseId: null,
  platformId: null, genreIds: [], status: 'PLAYING', rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, owned: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: 20,
  estimatedCompletionistHours: null, personalEstimatedHours: 18, retroactivePlayedHours: 0, notes: null, archived: false,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const session: Session = {
  id: '00000000-0000-4000-8000-000000000002', gameId: game.id,
  startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T12:00:00.000Z',
  durationMinutes: 120, progress: 45, location: 'Elysium', notes: null,
  createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
};

describe('dashboard calculations', () => {
  it('uses the personal estimate first and never reports negative remaining time', () => {
    expect(estimateRemainingHours(game, 8)).toBe(10);
    expect(estimateRemainingHours(game, 20)).toBe(0);
    expect(estimateRemainingHours({ ...game, personalEstimatedHours: null }, 5)).toBe(15);
    expect(estimateRemainingHours({ ...game, personalEstimatedHours: null, estimatedMainHours: null }, 5)).toBeNull();
  });

  it('aggregates played time, current progress and queue forecast', () => {
    const queueItem: QueueItem = { position: 0, addedAt: '2026-01-02T00:00:00.000Z', game: { ...game, status: 'BACKLOG', owned: true } };
    const dashboard = buildDashboard({ games: [game], sessions: [session], queue: [queueItem], weeklyMinutes: 360 });
    expect(dashboard).toMatchObject({
      gameCount: 1, playingCount: 1, totalPlayedHours: 2, weeklyHours: 6, archivedCount: 0,
      currentGame: { playedHours: 2, progress: 45, estimatedHours: 18, remainingHours: 16 },
      queueRemainingHours: 16, estimatedQueueWeeks: 2.67,
    });
  });

  it('does not calculate a queue forecast when the weekly goal is zero', () => {
    const dashboard = buildDashboard({ games: [game], sessions: [], queue: [], weeklyMinutes: 0 });
    expect(dashboard.estimatedQueueWeeks).toBeNull();
  });

  it('counts retroactive hours in totals and per-game progress', () => {
    const dashboard = buildDashboard({ games: [{ ...game, retroactivePlayedHours: 40 }], sessions: [], queue: [], weeklyMinutes: 0 });
    expect(dashboard.totalPlayedHours).toBe(40);
    expect(dashboard.currentGame?.playedHours).toBe(40);
  });

  it('spreads retroactive hours of completed games without sessions across their period', () => {
    const completed = { ...game, status: 'COMPLETED' as const, retroactivePlayedHours: 30, startedAt: '2025-01-01', completedAt: '2025-03-31' };
    const january = buildDashboard({ games: [completed], sessions: [], queue: [], weeklyMinutes: 0, range: { from: '2025-01-01', to: '2025-01-31' } });
    expect(january.periodStats.playedHours).toBe(10.33);
    expect(january.periodStats.gamesPlayed).toBe(1);
    const outside = buildDashboard({ games: [completed], sessions: [], queue: [], weeklyMinutes: 0, range: { from: '2026-01-01', to: '2026-01-31' } });
    expect(outside.periodStats.playedHours).toBe(0);
    const all = buildDashboard({ games: [completed], sessions: [], queue: [], weeklyMinutes: 0 });
    expect(all.periodStats.playedHours).toBe(30);
  });

  it('counts each game once in its completion year and month', () => {
    const completed = {
      ...game,
      status: 'COMPLETED' as const,
      startedAt: '2025-01-01', completedAt: '2025-02-10',
    };
    const other = { ...completed, id: '00000000-0000-4000-8000-000000000003' };
    const dashboard = buildDashboard({ games: [completed, other], sessions: [], queue: [], weeklyMinutes: 0 });
    expect(dashboard.completedCount).toBe(2);
    expect(dashboard.completionByYear).toEqual([{ year: 2025, gameCount: 2 }]);
    expect(dashboard.completionByMonth).toEqual([{ year: 2025, month: 2, gameCount: 2 }]);
  });

  it('clips sessions to the selected period and reports all playing games', () => {
    const second = { ...game, id: '00000000-0000-4000-8000-000000000004', title: 'Celeste' };
    const crossingSession = { ...session, startedAt: '2025-12-31T23:00:00.000Z', endedAt: '2026-01-01T01:00:00.000Z', durationMinutes: 120 };
    const dashboard = buildDashboard({ games: [game, second], sessions: [crossingSession], queue: [], weeklyMinutes: 0, range: { from: '2026-01-01', to: '2026-01-01' } });
    expect(dashboard.playingGames).toHaveLength(2);
    expect(dashboard.periodStats).toEqual({ playedHours: 1, sessions: 0, gamesPlayed: 1, gamesCompleted: 0 });
  });

  it('counts a completion by date even if the game later returns to playing', () => {
    const replay = { ...game, status: 'PLAYING' as const, completedAt: '2025-02-10' };
    const dashboard = buildDashboard({ games: [replay], sessions: [], queue: [], weeklyMinutes: 0, range: { from: '2025-02-01', to: '2025-02-28' } });
    expect(dashboard.periodStats.gamesCompleted).toBe(1);
    expect(dashboard.completionByYear).toEqual([{ year: 2025, gameCount: 1 }]);
  });
});
