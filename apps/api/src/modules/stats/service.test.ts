import { describe, expect, it } from 'vitest';
import type { Game, Session } from '@gameshelf/contracts';
import { buildStats } from './service.js';
import { buildChallengeProgress } from '../challenge/service.js';

const base: Game = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Base', description: null, coverUrl: null, backgroundUrl: null,
  releaseYear: null, developer: null, publisher: null, franchiseId: null, platformId: null, platformIds: [], genreIds: [], status: 'COMPLETED',
  rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false,
  owned: true, archived: false, startedAt: null, completedAt: '2025-03-01', priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null,
  createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const make = (n: number, values: Partial<Game>): Game => ({ ...base, id: id(n), title: `Jogo ${n}`, ...values });
const rpg = { id: id(100), name: 'RPG' };
const action = { id: id(101), name: 'Ação' };
const switchPlatform = { id: id(200), name: 'Switch' };

describe('stats', () => {
  it('summarises completed games with longest, shortest and average duration', () => {
    const games = [make(1, { retroactivePlayedHours: 10 }), make(2, { retroactivePlayedHours: 30 }), make(3, { status: 'PLAYING', retroactivePlayedHours: 99 })];
    const session: Session = { id: id(50), gameId: id(1), startedAt: '2025-02-01T10:00:00.000Z', endedAt: '2025-02-01T12:00:00.000Z', durationMinutes: 120, progress: null, location: null, notes: null, keyDecisions: null, tips: null, playthroughId: null, platformId: null, createdAt: '2025-02-01T12:00:00.000Z', updatedAt: '2025-02-01T12:00:00.000Z' };
    const { totals } = buildStats({ games, sessions: [session], platforms: [], genres: [], today: '2025-03-11' });
    expect(totals).toMatchObject({ completedCount: 2, completedHours: 42, averageCompletedHours: 21, journeyStart: '2025-02-01', journeyDays: 38 });
    expect(totals.longestGame).toMatchObject({ title: 'Jogo 2', hours: 30 });
    expect(totals.shortestGame).toMatchObject({ title: 'Jogo 1', hours: 12 });
  });

  it('has no duration highlights without played time', () => {
    const { totals } = buildStats({ games: [make(1, {})], sessions: [], platforms: [], genres: [] });
    expect(totals).toMatchObject({ longestGame: null, shortestGame: null, averageCompletedHours: null });
  });

  it('distributes ratings from 11 down to 1 and difficulty only for completed games', () => {
    const games = [make(1, { rating: 11, difficulty: 'A' }), make(2, { rating: 11, difficulty: 'A' }), make(3, { rating: 8, difficulty: 'C' }), make(4, { status: 'ABANDONED', rating: 3, difficulty: 'AAA' })];
    const stats = buildStats({ games, sessions: [], platforms: [], genres: [] });
    expect(stats.ratingDistribution).toHaveLength(11);
    expect(stats.ratingDistribution[0]).toEqual({ rating: 11, count: 2 });
    expect(stats.ratingDistribution.find((entry) => entry.rating === 3)?.count).toBe(1);
    expect(stats.difficultyDistribution).toEqual([
      { difficulty: 'AAA', count: 0 }, { difficulty: 'AA', count: 0 }, { difficulty: 'A', count: 2 }, { difficulty: 'B', count: 0 }, { difficulty: 'C', count: 1 },
    ]);
  });

  it('groups completed games by genre, type and platform with hours and average rating', () => {
    const games = [
      make(1, { genreIds: [rpg.id, action.id], gameType: 'Action RPG', platformId: switchPlatform.id, rating: 10, retroactivePlayedHours: 20 }),
      make(2, { genreIds: [rpg.id], gameType: 'action rpg', platformId: switchPlatform.id, rating: 8, retroactivePlayedHours: 10 }),
      make(3, { genreIds: [action.id], status: 'PLAYING', retroactivePlayedHours: 5 }),
    ];
    const stats = buildStats({ games, sessions: [], platforms: [switchPlatform], genres: [rpg, action] });
    expect(stats.byGenre.map((entry) => [entry.name, entry.completedCount, entry.hours, entry.averageRating])).toEqual([['RPG', 2, 30, 9], ['Ação', 1, 20, 10]]);
    expect(stats.byType).toEqual([{ key: 'action rpg', name: 'Action RPG', completedCount: 2, hours: 30, averageRating: 9 }]);
    expect(stats.byPlatform).toMatchObject([{ name: 'Switch', completedCount: 2, hours: 30 }]);
    expect(stats.topGenres.map((entry) => entry.name)).toEqual(['Ação', 'RPG']);
  });

  it('builds the yearly timeline with the game of the year and ranks favourites by rating', () => {
    const games = [
      make(1, { completedAt: '2024-05-01', retroactivePlayedHours: 10, gameOfYear: true, favorite: true, rating: 9 }),
      make(2, { completedAt: '2024-06-01', retroactivePlayedHours: 5 }),
      make(3, { completedAt: '2025-01-10', retroactivePlayedHours: 7, favorite: true, rating: 11 }),
    ];
    const stats = buildStats({ games, sessions: [], platforms: [], genres: [] });
    expect(stats.byYear).toMatchObject([
      { year: 2025, completedCount: 1, hours: 7, gameOfYear: null },
      { year: 2024, completedCount: 2, hours: 15, gameOfYear: { title: 'Jogo 1' } },
    ]);
    expect(stats.favorites.map((entry) => entry.title)).toEqual(['Jogo 3', 'Jogo 1']);
  });
});

describe('main challenge progress', () => {
  it('counts completed games of the linked list', () => {
    const statuses = new Map([[id(1), 'COMPLETED'], [id(2), 'PLAYING'], [id(3), 'COMPLETED'], [id(4), 'BACKLOG']]);
    const progress = buildChallengeProgress({ title: 'Zerar tudo', listId: id(9) }, { name: 'Clássicos', gameIds: [id(1), id(2), id(3), id(4)] }, statuses);
    expect(progress).toMatchObject({ totalGames: 4, completedGames: 2, percent: 50, listName: 'Clássicos' });
    expect(buildChallengeProgress({ title: 'x', listId: id(9) }, { name: 'Vazia', gameIds: [] }, statuses).percent).toBe(0);
  });
});

// Agregação por grupo de plataforma (ADR-025).
describe('estatísticas por grupo de plataforma', () => {
  const PC = '00000000-0000-4000-8000-000000000f01';
  const STEAM = '00000000-0000-4000-8000-000000000f02';
  const PS5 = '00000000-0000-4000-8000-000000000f03';
  const platforms = [
    { id: PC, name: 'PC', parentId: null },
    { id: STEAM, name: 'Steam', parentId: PC },
    { id: PS5, name: 'PlayStation 5', parentId: null },
  ];
  const link = (gameId: string, platformId: string, minutes: number | null) => ({
    id: `${gameId}-${platformId}`, gameId, platformId, edition: null, format: null, owned: true, isPrimary: false,
    externalSource: 'achievist', externalId: '1', externalAccountLabel: null, externalPlaytimeMinutes: minutes,
    externalLastPlayedAt: null, externalSyncedAt: null, externalPlaytimeImportedMinutes: 0, countsTowardTotal: false, notes: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('soma no grupo as horas dos jogos zerados em um subgrupo', () => {
    const games = [
      { ...base, id: '00000000-0000-4000-8000-000000000a01', platformId: STEAM },
      { ...base, id: '00000000-0000-4000-8000-000000000a02', platformId: PC },
      { ...base, id: '00000000-0000-4000-8000-000000000a03', platformId: PS5 },
    ];
    const result = buildStats({ games, sessions: [], platforms, genres: [], today: '2026-01-01' });
    const names = result.byPlatform.map((entry) => `${entry.name}:${entry.completedCount}`).sort();
    expect(names).toEqual(['PC:2', 'PlayStation 5:1']);
  });

  it('soma no grupo o tempo informado por plataforma, sem duplicar', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01' }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [
        link(games[0]!.id, STEAM, 120),
        link(games[0]!.id, PC, 60),
        link(games[0]!.id, PS5, 30),
      ],
    });
    expect(result.library.externalPlaytimeHours).toBe(3.5);
    expect(result.library.externalPlaytimeByPlatform).toEqual([
      { key: PC, name: 'PC', hours: 3 },
      { key: PS5, name: 'PlayStation 5', hours: 0.5 },
    ]);
  });

  it('só soma no consolidado as plataformas marcadas como fonte do total', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 1 }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [
        { ...link(games[0]!.id, STEAM, 120), countsTowardTotal: true },
        { ...link(games[0]!.id, PS5, 60), countsTowardTotal: false },
      ],
    });
    expect(result.library).toMatchObject({
      localPlayedHours: 1,
      externalPlaytimeHours: 3,
      externalCountedHours: 2,
      consolidatedPlayedHours: 3,
    });
  });

  it('não conta no consolidado o tempo externo que já virou hora retroativa', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 2 }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [
        // 120 min informados, 120 já lançados como retroativos: nada a somar.
        { ...link(games[0]!.id, STEAM, 120), externalPlaytimeImportedMinutes: 120, countsTowardTotal: true },
      ],
    });
    expect(result.library).toMatchObject({ externalCountedHours: 0, consolidatedPlayedHours: 2 });
  });

  it('conta só a diferença quando parte do tempo externo já foi lançada', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 1 }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [
        { ...link(games[0]!.id, STEAM, 180), externalPlaytimeImportedMinutes: 60, countsTowardTotal: true },
      ],
    });
    expect(result.library).toMatchObject({ externalCountedHours: 2, consolidatedPlayedHours: 3 });
  });

  it('sem nenhuma plataforma marcada, o consolidado é igual ao tempo local', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 5 }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [link(games[0]!.id, STEAM, 600)],
    });
    expect(result.library).toMatchObject({ consolidatedPlayedHours: 5, externalCountedHours: 0 });
  });

  // O cenário do Portal: importa com 10 h da Steam, joga 1 h aqui, sincroniza e
  // a Steam passa a informar 11 h. O total tem de continuar 11 h, não 12 h.
  it('não conta duas vezes a hora jogada aqui depois de sincronizar', () => {
    const game = { ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 0 };
    const sessionOnSteam = {
      id: '00000000-0000-4000-8000-000000000b01', gameId: game.id, playthroughId: null, platformId: STEAM,
      startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T11:00:00.000Z', durationMinutes: 60,
      progress: null, location: null, notes: null, keyDecisions: null, tips: null,
      createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T11:00:00.000Z',
    };
    const result = buildStats({
      games: [game], sessions: [sessionOnSteam], platforms, genres: [], today: '2026-02-01',
      // A Steam já reporta as 11 h: as 10 anteriores mais a hora jogada aqui.
      gamePlatforms: [{ ...link(game.id, STEAM, 660), countsTowardTotal: true }],
    });

    expect(result.library).toMatchObject({
      localPlayedHours: 1,
      externalCountedHours: 10,
      consolidatedPlayedHours: 11,
    });
  });

  it('não desconta sessões de outra plataforma do mesmo jogo', () => {
    const game = { ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 0 };
    const sessionOnPs5 = {
      id: '00000000-0000-4000-8000-000000000b02', gameId: game.id, playthroughId: null, platformId: PS5,
      startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T11:00:00.000Z', durationMinutes: 60,
      progress: null, location: null, notes: null, keyDecisions: null, tips: null,
      createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T11:00:00.000Z',
    };
    const result = buildStats({
      games: [game], sessions: [sessionOnPs5], platforms, genres: [], today: '2026-02-01',
      gamePlatforms: [{ ...link(game.id, STEAM, 600), countsTowardTotal: true }],
    });

    expect(result.library).toMatchObject({ externalCountedHours: 10, consolidatedPlayedHours: 11 });
  });

  it('não desconta sessão sem plataforma informada', () => {
    const game = { ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 0 };
    const sessionWithoutPlatform = {
      id: '00000000-0000-4000-8000-000000000b03', gameId: game.id, playthroughId: null, platformId: null,
      startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T11:00:00.000Z', durationMinutes: 60,
      progress: null, location: null, notes: null, keyDecisions: null, tips: null,
      createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T11:00:00.000Z',
    };
    const result = buildStats({
      games: [game], sessions: [sessionWithoutPlatform], platforms, genres: [], today: '2026-02-01',
      gamePlatforms: [{ ...link(game.id, STEAM, 660), countsTowardTotal: true }],
    });

    // Sem saber a plataforma da sessão, o desconto não acontece: o total fica
    // inflado, e é por isso que a tela avisa.
    expect(result.library).toMatchObject({ externalCountedHours: 11, consolidatedPlayedHours: 12 });
  });

  it('nunca deixa a contribuição externa ficar negativa', () => {
    const game = { ...base, id: '00000000-0000-4000-8000-000000000a01', retroactivePlayedHours: 0 };
    const longSession = {
      id: '00000000-0000-4000-8000-000000000b04', gameId: game.id, playthroughId: null, platformId: STEAM,
      startedAt: '2026-01-02T00:00:00.000Z', endedAt: '2026-01-03T00:00:00.000Z', durationMinutes: 1440,
      progress: null, location: null, notes: null, keyDecisions: null, tips: null,
      createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z',
    };
    const result = buildStats({
      games: [game], sessions: [longSession], platforms, genres: [], today: '2026-02-01',
      gamePlatforms: [{ ...link(game.id, STEAM, 60), countsTowardTotal: true }],
    });

    expect(result.library).toMatchObject({ externalCountedHours: 0, consolidatedPlayedHours: 24 });
  });

  it('ignora o tempo não informado em vez de tratá-lo como zero', () => {
    const games = [{ ...base, id: '00000000-0000-4000-8000-000000000a01' }];
    const result = buildStats({
      games, sessions: [], platforms, genres: [], today: '2026-01-01',
      gamePlatforms: [link(games[0]!.id, STEAM, null)],
    });
    expect(result.library.externalPlaytimeHours).toBe(0);
    expect(result.library.externalPlaytimeByPlatform).toEqual([]);
  });
});
