import { describe, expect, it } from 'vitest';
import { buildPlaytimeReport } from './playtime.js';
import { id, makeGame, makeSession } from './fixtures.js';

const rpg = { id: id(100), name: 'RPG' };
const action = { id: id(101), name: 'Ação' };
const pc = { id: id(200), name: 'PC' };
const ps5 = { id: id(201), name: 'PS5' };
const games = [makeGame(1, { genreIds: [rpg.id], developer: 'Estúdio A' }), makeGame(2, { genreIds: [rpg.id, action.id], developer: 'Estúdio A' }), makeGame(3)];
const common = { games, platforms: [pc, ps5], genres: [rpg, action] };

describe('buildPlaytimeReport', () => {
  const sessions = [
    makeSession(id(1), '2026-02-07T21:00:00.000Z', 120, pc.id), // sábado, 21h
    makeSession(id(1), '2026-02-14T22:00:00.000Z', 60, pc.id), // sábado
    makeSession(id(2), '2026-05-04T10:00:00.000Z', 20, ps5.id), // segunda
    makeSession(id(3), '2025-12-31T23:30:00.000Z', 300),
    makeSession(id(2), '2026-05-05T10:00:00.000Z', null, ps5.id), // aberta: ignorada
  ];

  it('totaliza só sessões encerradas e resume os hábitos', () => {
    const report = buildPlaytimeReport({ ...common, sessions });
    expect(report).toMatchObject({ totalMinutes: 500, sessionCount: 4, averageSessionMinutes: 125, activeDays: 4, availableYears: [2025, 2026] });
    expect(report.highlights).toMatchObject({ busiestWeekday: 3, busiestMonth: '2025-12', peakHour: 23 });
    expect(report.byMonth.map((m) => m.month)).toEqual(['2025-12', '2026-02', '2026-05']);
    expect(report.byYear).toEqual([{ year: 2025, minutes: 300, sessions: 1 }, { year: 2026, minutes: 200, sessions: 3 }]);
    expect(report.byWeekday).toHaveLength(7);
    expect(report.byHour).toHaveLength(24);
    expect(report.sessionLengths).toEqual([
      { key: 'UP_TO_30', sessions: 1 }, { key: 'UP_TO_60', sessions: 1 }, { key: 'UP_TO_120', sessions: 1 }, { key: 'UP_TO_240', sessions: 0 }, { key: 'OVER_240', sessions: 1 },
    ]);
  });

  it('filtra por período usando o dia local de início', () => {
    const report = buildPlaytimeReport({ ...common, sessions, from: '2026-01-01', to: '2026-12-31' });
    expect(report.totalMinutes).toBe(200);
    // A sessão de 31/12 23:30Z ainda é 2025 em UTC-2 e já é 2026 em UTC+2.
    expect(buildPlaytimeReport({ ...common, sessions, from: '2026-01-01', timezoneOffsetMinutes: -120 }).totalMinutes).toBe(500);
    expect(buildPlaytimeReport({ ...common, sessions, from: '2026-01-01', timezoneOffsetMinutes: 180 }).totalMinutes).toBe(200);
  });

  it('filtra por plataforma e gênero e ranqueia com participação', () => {
    expect(buildPlaytimeReport({ ...common, sessions, platformId: pc.id }).totalMinutes).toBe(180);
    expect(buildPlaytimeReport({ ...common, sessions, genreId: action.id }).totalMinutes).toBe(20);

    const full = buildPlaytimeReport({ ...common, sessions });
    expect(full.byPlatform.map((p) => [p.name, p.minutes])).toEqual([['Sem plataforma', 300], ['PC', 180], ['PS5', 20]]);
    expect(full.byGenre.map((g) => [g.name, g.minutes])).toEqual([['RPG', 200], ['Ação', 20]]);
    expect(full.byDeveloper).toEqual([expect.objectContaining({ name: 'Estúdio A', minutes: 200, share: 40 })]);
    expect(full.topGames[0]).toMatchObject({ id: id(3), minutes: 300, share: 60 });
  });

  it('devolve zeros sem sessões', () => {
    const report = buildPlaytimeReport({ ...common, sessions: [] });
    expect(report).toMatchObject({ totalMinutes: 0, sessionCount: 0, averageSessionMinutes: 0, activeDays: 0 });
    expect(report.highlights).toEqual({ busiestWeekday: null, busiestMonth: null, peakHour: null, averageMonthlyMinutes: 0 });
  });
});
