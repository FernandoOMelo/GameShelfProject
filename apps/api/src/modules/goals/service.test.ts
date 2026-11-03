import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { buildGoalProgress } from './service.js';
import type { GoalRecord } from './repository.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base: Game = {
  id: id(1), title: 'Base', description: null, coverUrl: null, backgroundUrl: null,
  releaseYear: null, developer: null, publisher: null, franchiseId: null, platformId: null, platformIds: [], genreIds: [], status: 'COMPLETED',
  rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false,
  owned: true, archived: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const make = (n: number, values: Partial<Game> = {}): Game => ({ ...base, id: id(n), title: `Jogo ${n}`, ...values });
const session = (gameId: string, startedAt: string, minutes: number): Session => ({
  id: id(900), gameId, startedAt, endedAt: new Date(Date.parse(startedAt) + minutes * 60_000).toISOString(), durationMinutes: minutes,
  progress: null, location: null, notes: null, keyDecisions: null, tips: null, playthroughId: null, platformId: null, createdAt: startedAt, updatedAt: startedAt,
});
const goal = (values: Partial<GoalRecord> = {}): GoalRecord => ({
  id: id(500), kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: 0, target: 10,
  title: null, description: null, listId: null, dueDate: null, done: false, createdAt: new Date('2026-01-01T00:00:00.000Z'), ...values,
});

describe('goal progress', () => {
  it('counts completions in the year, including archived games, and ignores other years', () => {
    const games = [make(1, { completedAt: '2026-02-01' }), make(2, { completedAt: '2026-11-01', archived: true }), make(3, { completedAt: '2025-12-31' }), make(4, { status: 'PLAYING' })];
    const [result] = buildGoalProgress({ goals: [goal({ target: 4 })], games, sessions: [], today: '2026-07-01' });
    expect(result).toMatchObject({ current: 2, percent: 50, month: null, achieved: false });
  });

  it('counts completions in a single month using its real length', () => {
    const games = [make(1, { completedAt: '2026-02-28' }), make(2, { completedAt: '2026-03-01' })];
    const [result] = buildGoalProgress({ goals: [goal({ period: 'MONTH', month: 2, target: 1 })], games, sessions: [], today: '2026-02-28' });
    expect(result).toMatchObject({ current: 1, month: 2, achieved: true, percent: 100, elapsedPercent: 100 });
  });

  it('sums session hours inside the period using the local day', () => {
    const games = [make(1, { status: 'PLAYING' })];
    const sessions = [session(id(1), '2026-03-10T10:00:00.000Z', 120), session(id(1), '2026-04-10T10:00:00.000Z', 60)];
    const [result] = buildGoalProgress({ goals: [goal({ kind: 'PLAYED_HOURS', period: 'MONTH', month: 3, target: 4 })], games, sessions, today: '2026-03-20' });
    expect(result).toMatchObject({ current: 2, percent: 50 });
  });

  it('flags whether progress keeps up with the elapsed time of the period', () => {
    const games = [make(1, { completedAt: '2026-01-10' })];
    // 1/10 = 10%; em 2026-07-02 passaram 183 de 365 dias.
    expect(buildGoalProgress({ goals: [goal()], games, sessions: [], today: '2026-07-02' })[0]).toMatchObject({ percent: 10, elapsedPercent: 50.1, onTrack: false });
    expect(buildGoalProgress({ goals: [goal()], games, sessions: [], today: '2026-01-20' })[0]).toMatchObject({ onTrack: true });
    expect(buildGoalProgress({ goals: [goal({ year: 2027 })], games, sessions: [], today: '2026-07-02' })[0]).toMatchObject({ elapsedPercent: 0, onTrack: true });
  });

  it('keeps an achieved goal on track and caps the percent at 100', () => {
    const games = [make(1, { completedAt: '2026-01-10' }), make(2, { completedAt: '2026-01-11' })];
    expect(buildGoalProgress({ goals: [goal({ target: 1 })], games, sessions: [], today: '2026-12-31' })[0]).toMatchObject({ current: 2, percent: 100, achieved: true, onTrack: true });
  });

  it('orders goals from the most recent period', () => {
    const goals = [goal({ id: id(1), year: 2025 }), goal({ id: id(2), period: 'MONTH', month: 3 }), goal({ id: id(3), period: 'MONTH', month: 5 })];
    expect(buildGoalProgress({ goals, games: [], sessions: [], today: '2026-06-01' }).map((item) => item.id)).toEqual([id(3), id(2), id(1)]);
  });

  describe('metas flexíveis', () => {
    const created = new Date('2026-03-01T00:00:00.000Z');

    it('zerar uma lista conta os jogos zerados da lista', () => {
      const games = [make(1), make(2, { status: 'PLAYING' }), make(3)];
      const [result] = buildGoalProgress({
        goals: [goal({ kind: 'COMPLETE_LIST', listId: id(70), target: 1, createdAt: created })], games, sessions: [],
        lists: [{ id: id(70), name: 'Clássicos', gameIds: [id(1), id(2), id(3)] }], today: '2026-03-10',
      });
      expect(result).toMatchObject({ kind: 'COMPLETE_LIST', listName: 'Clássicos', current: 2, target: 3, achieved: false, onTrack: true });
    });

    it('horas seguidas usam a maior sessão dentro da janela, não a soma', () => {
      const sessions = [session(id(1), '2026-03-05T10:00:00.000Z', 120), session(id(1), '2026-03-06T10:00:00.000Z', 150), session(id(1), '2026-02-01T10:00:00.000Z', 600)];
      const [result] = buildGoalProgress({ goals: [goal({ kind: 'SESSION_HOURS', target: 4, createdAt: created })], games: [make(1)], sessions, today: '2026-03-10' });
      expect(result).toMatchObject({ current: 2.5, percent: 62.5, achieved: false });
    });

    it('texto livre só avança pela marcação manual, e a data limite define o ritmo', () => {
      const open = buildGoalProgress({ goals: [goal({ kind: 'CUSTOM', title: 'Platinar um jogo', dueDate: '2026-03-11', createdAt: created })], games: [], sessions: [], today: '2026-03-10' })[0];
      expect(open).toMatchObject({ title: 'Platinar um jogo', current: 0, achieved: false, onTrack: false });
      const done = buildGoalProgress({ goals: [goal({ kind: 'CUSTOM', title: 'Platinar um jogo', done: true, createdAt: created })], games: [], sessions: [], today: '2026-03-10' })[0];
      expect(done).toMatchObject({ achieved: true, percent: 100 });
    });
  });
});
