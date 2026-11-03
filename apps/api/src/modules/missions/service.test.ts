import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { buildMissionProgress } from './service.js';
import type { MissionRecord } from './repository.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const game = (n: number, values: Partial<Game> = {}) => ({ id: id(n), title: `J${n}`, status: 'COMPLETED', completedAt: null, ...values }) as Game;
const session = (startedAt: string, minutes: number) => ({ id: id(900), gameId: id(1), startedAt, endedAt: startedAt, durationMinutes: minutes }) as Session;
const mission = (values: Partial<MissionRecord>): MissionRecord => ({
  id: id(500), title: 'Missão', description: null, kind: 'CUSTOM', listId: null, target: null, startsOn: '2026-03-01', dueDate: null,
  done: false, isPrimary: false, createdAt: new Date(), updatedAt: new Date(), ...values,
});

describe('buildMissionProgress', () => {
  it('lista: jogos zerados da lista', () => {
    const [result] = buildMissionProgress([mission({ kind: 'LIST', listId: id(70), isPrimary: true })], [game(1), game(2, { status: 'PLAYING' })], [], [{ id: id(70), name: 'Backlog', gameIds: [id(1), id(2)] }]);
    expect(result).toMatchObject({ target: 2, current: 1, percent: 50, listName: 'Backlog', isPrimary: true, achieved: false });
  });

  it('zerar N jogos conta só os concluídos dentro da janela', () => {
    const games = [game(1, { completedAt: '2026-03-05' }), game(2, { completedAt: '2026-02-20' }), game(3, { completedAt: '2026-05-01' })];
    const [result] = buildMissionProgress([mission({ kind: 'GAMES_COUNT', target: 3, dueDate: '2026-04-30' })], games, [], []);
    expect(result).toMatchObject({ current: 1, target: 3 });
  });

  it('horas somam as sessões da janela e texto livre usa a marcação manual', () => {
    const sessions = [session('2026-03-02T10:00:00.000Z', 90), session('2026-01-02T10:00:00.000Z', 600)];
    const [hours, custom] = buildMissionProgress([mission({ kind: 'HOURS', target: 3 }), mission({ id: id(501), kind: 'CUSTOM', done: true })], [], sessions, []);
    expect(hours).toMatchObject({ current: 1.5, percent: 50 });
    expect(custom).toMatchObject({ done: true, achieved: true });
  });
});
