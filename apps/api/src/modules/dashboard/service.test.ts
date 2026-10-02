import { describe, expect, it } from 'vitest';
import type { Game, QueueItem, Session } from '@gameshelf/contracts';
import { buildDashboard, estimateRemainingHours } from './service.js';

const game: Game = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null, coverUrl: null,
  backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null, franchiseId: null,
  platformIds: [], genreIds: [], status: 'PLAYING', priority: 'NORMAL', estimatedMainHours: 20,
  estimatedCompletionistHours: null, personalEstimatedHours: 18, notes: null,
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
    const queueItem: QueueItem = { position: 0, addedAt: '2026-01-02T00:00:00.000Z', game: { ...game, status: 'QUEUED' } };
    const dashboard = buildDashboard({ games: [game], sessions: [session], queue: [queueItem], weeklyMinutes: 360 });
    expect(dashboard).toMatchObject({
      gameCount: 1, playingCount: 1, totalPlayedHours: 2, weeklyHours: 6,
      currentGame: { playedHours: 2, progress: 45, estimatedHours: 18, remainingHours: 16 },
      queueRemainingHours: 16, estimatedQueueWeeks: 2.67,
    });
  });

  it('does not calculate a queue forecast when the weekly goal is zero', () => {
    const dashboard = buildDashboard({ games: [game], sessions: [], queue: [], weeklyMinutes: 0 });
    expect(dashboard.estimatedQueueWeeks).toBeNull();
  });
});
