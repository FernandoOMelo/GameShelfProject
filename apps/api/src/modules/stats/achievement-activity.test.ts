import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { achievementDays, achievementTimelineEvents, assignUnlocksToSessions } from './achievement-activity.js';
import { buildActivity } from './activity.js';
import { buildTimeline } from './timeline.js';

const gameId = '00000000-0000-4000-8000-000000000001';
const game = { id: gameId, title: 'Cyberpunk 2077', coverUrl: null, createdAt: '2026-01-01T00:00:00.000Z', startedAt: null, completedAt: null } as unknown as Game;
const unlocks = [
  { gameId, unlockedAt: new Date('2026-03-10T12:00:00.000Z') },
  { gameId, unlockedAt: new Date('2026-03-10T20:30:00.000Z') },
  { gameId, unlockedAt: new Date('2026-03-12T09:00:00.000Z') },
  { gameId: '00000000-0000-4000-8000-0000000000ff', unlockedAt: new Date('2026-03-12T09:00:00.000Z') },
];

describe('atividade de conquistas', () => {
  it('agrupa os desbloqueios por jogo e dia local', () => {
    const events = achievementTimelineEvents(unlocks, [game], 0);
    expect(events).toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'ACHIEVEMENTS_UNLOCKED', date: '2026-03-10', count: 2, at: '2026-03-10T20:30:00.000Z' }));
    expect(events).toContainEqual(expect.objectContaining({ date: '2026-03-12', count: 1 }));
  });

  it('respeita o fuso ao decidir o dia', () => {
    // 01:00 UTC em UTC-3 ainda é o dia anterior.
    const days = achievementDays([{ gameId, unlockedAt: new Date('2026-03-11T01:00:00.000Z') }], 180);
    expect(days).toEqual([{ date: '2026-03-10', count: 1 }]);
  });

  it('entra na linha do tempo e no mapa de atividade sem virar sessão', () => {
    const timeline = buildTimeline({ games: [game], sessions: [], completions: [], unlocks, limit: 10 });
    expect(timeline.events.filter((event) => event.type === 'ACHIEVEMENTS_UNLOCKED')).toHaveLength(2);

    const activity = buildActivity({ sessions: [] as Session[], year: 2026, today: '2026-03-20', unlocks });
    expect(activity.achievementDays).toEqual([{ date: '2026-03-10', count: 2 }, { date: '2026-03-12', count: 2 }]);
    expect(activity.activeDays).toBe(0);
    expect(activity.totalMinutes).toBe(0);
  });

  const session = (id: string, startedAt: string, endedAt: string, overrides: Partial<Session> = {}): Session => ({
    id, gameId, startedAt, endedAt, durationMinutes: 60, progress: null, location: null, notes: null, keyDecisions: null, tips: null,
    playthroughId: null, platformId: '00000000-0000-4000-8000-0000000000aa', createdAt: startedAt, updatedAt: startedAt, ...overrides,
  }) as Session;
  const named = (iso: string, name: string) => ({ gameId, unlockedAt: new Date(iso), platformId: '00000000-0000-4000-8000-0000000000aa', name, description: 'desc', iconUrl: 'https://img/x.png' });

  it('liga a conquista à sessão cuja janela a contém e mostra o resto como conquista solta', () => {
    const s1 = session('00000000-0000-4000-8000-0000000000b1', '2026-03-10T20:00:00.000Z', '2026-03-10T21:10:00.000Z');
    const timeline = buildTimeline({
      games: [game], sessions: [s1], completions: [], limit: 20,
      unlocks: [named('2026-03-10T20:30:00.000Z', 'Dentro'), named('2026-03-10T21:30:00.000Z', 'Folga'), named('2026-03-20T10:00:00.000Z', 'Outro dia')],
    });
    const sessionEvent = timeline.events.find((event) => event.type === 'SESSION');
    expect(sessionEvent).toMatchObject({ platformId: '00000000-0000-4000-8000-0000000000aa' });
    expect(sessionEvent && 'achievements' in sessionEvent ? sessionEvent.achievements.map((item) => item.name) : []).toEqual(['Dentro', 'Folga']);
    const loose = timeline.events.filter((event) => event.type === 'ACHIEVEMENTS_UNLOCKED');
    expect(loose).toHaveLength(1);
    expect(loose[0]).toMatchObject({ date: '2026-03-20', count: 1 });
  });

  it('usa o mesmo dia só quando há uma única sessão; com duas, a conquista fica solta', () => {
    const early = session('00000000-0000-4000-8000-0000000000b1', '2026-03-10T08:00:00.000Z', '2026-03-10T09:00:00.000Z');
    const late = session('00000000-0000-4000-8000-0000000000b2', '2026-03-10T22:00:00.000Z', '2026-03-10T23:00:00.000Z');
    const unlock = named('2026-03-10T15:00:00.000Z', 'Tarde');
    expect(assignUnlocksToSessions([unlock], [early], 0).bySession.get(early.id)).toHaveLength(1);
    const both = assignUnlocksToSessions([unlock], [early, late], 0);
    expect(both.bySession.size).toBe(0);
    expect(both.loose).toHaveLength(1);
  });
});
