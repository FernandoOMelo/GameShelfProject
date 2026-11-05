import { describe, expect, it } from 'vitest';
import type { Playthrough } from '@gameshelf/contracts';
import { buildPlaythroughsReport } from './playthroughs.js';
import { id, makeGame, makeSession } from './fixtures.js';

const journey = (n: number, gameId: string, sequence: number, values: Partial<Playthrough> = {}): Playthrough => ({
  id: id(500 + n), gameId, sequence, label: null, status: 'COMPLETED', primaryPlatformId: null, startedAt: null, completedAt: null,
  notes: null, isReplay: sequence > 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...values,
});
const pc = { id: id(200), name: 'PC' };
const games = [makeGame(1, { status: 'PLAYING' }), makeGame(2)];
const playthroughs = [
  journey(1, id(1), 1, { startedAt: '2022-01-01', completedAt: '2022-02-01', primaryPlatformId: pc.id }),
  journey(2, id(1), 2, { startedAt: '2024-02-01', completedAt: '2024-02-21' }),
  journey(3, id(1), 3, { startedAt: '2026-01-01', status: 'ABANDONED' }),
  journey(4, id(2), 1, { startedAt: '2025-01-01', status: 'ABANDONED' }),
  journey(5, id(2), 2, { status: 'PLANNED' }),
];
const sessions = [
  makeSession(id(1), '2022-01-05T10:00:00.000Z', 42 * 60), makeSession(id(1), '2024-02-05T10:00:00.000Z', 31 * 60),
].map((session, index) => ({ ...session, playthroughId: id(501 + index) }));

describe('buildPlaythroughsReport', () => {
  const report = buildPlaythroughsReport({ games, playthroughs, sessions, platforms: [pc] });

  it('conta jornadas iniciadas, ignorando as planejadas, mesmo com o jogo em andamento', () => {
    expect(report.totals).toMatchObject({
      gamesWithJourneys: 2, journeysStarted: 4, journeysCompleted: 2, journeysAbandoned: 2, replaysStarted: 2,
      averageJourneysPerGame: 2, completionRate: 50, averageDaysToComplete: 25.5,
    });
    expect(report.totals.averageDaysBetweenReplays).toBeGreaterThan(0);
  });

  it('compara a primeira jornada com as seguintes e monta o histórico', () => {
    expect(report.firstVsLater).toEqual({ firstAverageHours: 42, laterAverageHours: 31, firstCount: 1, laterCount: 1 });
    expect(report.mostReplayed).toHaveLength(1);
    expect(report.mostReplayed[0]).toMatchObject({ title: 'Jogo 1', journeys: 3, completed: 2, abandoned: 1 });
    expect(report.mostReplayed[0]!.history.map((item) => [item.sequence, item.hours, item.days])).toEqual([[1, 42, 31], [2, 31, 20], [3, 0, null]]);
    expect(report.mostAbandoned.map((entry) => [entry.title, entry.abandoned])).toEqual([['Jogo 1', 1], ['Jogo 2', 1]]);
    expect(report.byPlatform).toEqual([{ name: 'Sem plataforma', journeys: 3 }, { name: 'PC', journeys: 1 }]);
  });

  it('filtra pelas jornadas iniciadas no período', () => {
    const ranged = buildPlaythroughsReport({ games, playthroughs, sessions, platforms: [pc], from: '2024-01-01', to: '2025-12-31' });
    expect(ranged.totals.journeysStarted).toBe(2);
    expect(ranged.mostReplayed).toEqual([]);
  });
});
