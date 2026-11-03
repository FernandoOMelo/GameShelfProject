import { describe, expect, it } from 'vitest';
import { buildGameUsage } from './usage.js';

const link = (overrides: Partial<Parameters<typeof buildGameUsage>[0]['links'][number]>) => ({
  id: 'l1', gameId: 'g1', platformId: 'ps5', countsTowardTotal: false, externalPlaytimeMinutes: null, externalPlaytimeImportedMinutes: 0, ...overrides,
});

describe('buildGameUsage', () => {
  it('soma sessões e horas retroativas, e ignora tempo externo que não conta no total', () => {
    const [usage] = buildGameUsage({
      games: [{ id: 'g1', retroactivePlayedHours: 2.5 }],
      sessions: [{ gameId: 'g1', platformId: 'ps5', durationMinutes: 90 }, { gameId: 'g1', platformId: null, durationMinutes: null }],
      links: [link({ externalPlaytimeMinutes: 600 })],
      counts: new Map(),
    });
    expect(usage).toMatchObject({ gameId: 'g1', playedHours: 4, achievementsUnlocked: 0, achievementsTotal: 0 });
  });

  it('inclui o tempo externo marcado, sem contar duas vezes o que já virou sessão ou retroativa', () => {
    const [usage] = buildGameUsage({
      games: [{ id: 'g1', retroactivePlayedHours: 1 }],
      sessions: [{ gameId: 'g1', platformId: 'ps5', durationMinutes: 60 }],
      links: [link({ countsTowardTotal: true, externalPlaytimeMinutes: 300, externalPlaytimeImportedMinutes: 60 })],
      counts: new Map(),
    });
    // local: 1 h de sessão + 1 h retroativa; externo: 300 − 60 − 60 = 180 min
    expect(usage?.playedHours).toBe(5);
  });

  it('soma as conquistas de todas as plataformas do jogo', () => {
    const [usage] = buildGameUsage({
      games: [{ id: 'g1', retroactivePlayedHours: 0 }],
      sessions: [],
      links: [link({ id: 'l1' }), link({ id: 'l2', platformId: 'ps4' })],
      counts: new Map([['l1', { total: 60, unlocked: 30 }], ['l2', { total: 50, unlocked: 4 }]]),
    });
    expect(usage).toMatchObject({ achievementsTotal: 110, achievementsUnlocked: 34 });
  });
});
