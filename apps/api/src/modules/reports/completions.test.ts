import { describe, expect, it } from 'vitest';
import { buildCompletionsReport } from './completions.js';
import { id, makeGame, makeSession } from './fixtures.js';

const games = [
  makeGame(1, { status: 'COMPLETED', startedAt: '2026-01-01', completedAt: '2026-01-11', estimatedMainHours: 20 }),
  makeGame(2, { status: 'COMPLETED', startedAt: '2026-02-01', completedAt: '2026-03-03', estimatedMainHours: 10, retroactivePlayedHours: 5 }),
  makeGame(3, { status: 'COMPLETED', completedAt: '2025-06-01' }),
  makeGame(4, { status: 'ABANDONED' }),
  makeGame(5, { status: 'PAUSED', updatedAt: '2026-01-01T00:00:00.000Z' }),
  makeGame(6, { status: 'BACKLOG' }),
];
const sessions = [
  makeSession(id(1), '2026-01-02T10:00:00.000Z', 24 * 60), // 24 h contra 20 h estimadas
  makeSession(id(2), '2026-02-02T10:00:00.000Z', 3 * 60), // 3 h + 5 h retroativas contra 10 h
  makeSession(id(5), '2026-03-01T10:00:00.000Z', 60),
];
const now = new Date('2026-03-11T10:00:00.000Z');

describe('buildCompletionsReport', () => {
  it('monta o funil sobre os jogos iniciados, ignorando o backlog', () => {
    const { funnel } = buildCompletionsReport({ games, sessions, now });
    expect(funnel).toEqual({ started: 5, completed: 3, paused: 1, abandoned: 1, completionRate: 60, abandonmentRate: 20 });
  });

  it('conta conclusões e tempo para zerar dentro do período', () => {
    const all = buildCompletionsReport({ games, sessions, now });
    expect(all.byYear).toEqual([{ year: 2025, count: 1 }, { year: 2026, count: 2 }]);
    expect(all.byMonth.map((m) => m.month)).toEqual(['2025-06', '2026-01', '2026-03']);
    expect(all.averageDaysToComplete).toBe(20);

    const range = buildCompletionsReport({ games, sessions, from: '2026-01-01', to: '2026-01-31', now });
    expect(range.completedInRange).toBe(1);
    expect(range.averageDaysToComplete).toBe(10);
  });

  it('compara estimativa e realidade com a referência escolhida', () => {
    const { estimates } = buildCompletionsReport({ games, sessions, now });
    expect(estimates).toMatchObject({ reference: 'MAIN', compared: 2, total: 2, overCount: 1, underCount: 1, averageDifferencePercent: 0 });
    expect(estimates.rows).toEqual([
      expect.objectContaining({ title: 'Jogo 1', estimatedHours: 20, playedHours: 24, differencePercent: 20 }),
      expect.objectContaining({ title: 'Jogo 2', estimatedHours: 10, playedHours: 8, differencePercent: -20 }),
    ]);
    expect(buildCompletionsReport({ games, sessions, reference: 'PERSONAL', now }).estimates.compared).toBe(0);
  });

  it('ordena e pagina a tabela de estimativas', () => {
    const asc = buildCompletionsReport({ games, sessions, sort: 'DIFFERENCE_ASC', page: 1, pageSize: 1, now }).estimates;
    expect(asc.rows.map((row) => row.title)).toEqual(['Jogo 2']);
    expect(asc.total).toBe(2);
    expect(buildCompletionsReport({ games, sessions, sort: 'DIFFERENCE_ASC', page: 2, pageSize: 1, now }).estimates.rows.map((row) => row.title)).toEqual(['Jogo 1']);
  });

  it('lista jogos pausados há mais tempo pela última atividade', () => {
    const { stalled } = buildCompletionsReport({ games, sessions, now });
    expect(stalled).toEqual([{ gameId: id(5), title: 'Jogo 5', lastActivityAt: '2026-03-01T10:00:00.000Z', daysIdle: 10 }]);
  });
});
