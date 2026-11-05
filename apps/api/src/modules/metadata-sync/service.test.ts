import { describe, expect, it, vi } from 'vitest';
import type { GameMetadataCandidate, GameUpdate } from '@gameshelf/contracts';
import type { GameRecord } from '../games/repository.js';
import type { MetadataSyncRecord } from './repository.js';
import { MetadataSyncService, needsMetadata } from './service.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-05-01T12:00:00.000Z');

function baseGame(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: id(1), title: 'Hades', description: null, coverUrl: null, backgroundUrl: null, releaseYear: null, developer: null, publisher: null,
    franchiseId: null, platformId: null, platformIds: [], genreIds: [], status: 'BACKLOG', archived: false, priority: 'NORMAL', rating: null,
    difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: true,
    startedAt: null, completedAt: null, estimatedMainHours: null, estimatedCompletionistHours: null, personalEstimatedHours: null,
    retroactivePlayedHours: 0, notes: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

const hades: GameMetadataCandidate = {
  providerId: 'igdb-1', title: 'Hades', description: 'Roguelike', coverUrl: 'https://img/cover.jpg', releaseYear: 2020,
  developer: 'Supergiant', publisher: 'Supergiant', franchise: 'Hades', franchiseIgdbId: 7, genres: ['Roguelike', 'Action'],
};

function setup(game: GameRecord, search: () => Promise<GameMetadataCandidate[]>, record?: MetadataSyncRecord, timeEstimates?: { search: () => Promise<never[]> }) {
  const games = [game];
  const rows = new Map<string, MetadataSyncRecord>(record ? [[record.gameId, record]] : []);
  const genres = [{ id: id(100), name: 'Action' }];
  const franchises: Array<{ id: string; name: string }> = [];
  const update = vi.fn(async (gameId: string, input: GameUpdate) => { const target = games.find((item) => item.id === gameId); return target ? Object.assign(target, input) : undefined; });
  const service = new MetadataSyncService({
    games: { list: async () => games, find: async (gameId) => games.find((item) => item.id === gameId), create: async () => game, update, delete: async () => true },
    genres: { list: async () => genres, create: async (name) => { const genre = { id: id(101 + genres.length), name }; genres.push(genre); return genre; } },
    franchises: {
      list: async () => franchises as never, find: async () => undefined,
      create: async (name) => { const franchise = { id: id(300), name }; franchises.push(franchise); return franchise as never; },
      setIgdbFranchiseId: async () => undefined,
    },
    provider: { id: 'igdb', search },
    store: { get: async (gameId) => rows.get(gameId), listAll: async () => [...rows.values()], upsert: async (row) => { rows.set(row.gameId, row); } },
    ...(timeEstimates ? { timeEstimates: { id: 'hltb', ...timeEstimates } } : {}),
    now: () => now, sleep: async () => undefined,
  });
  return { service, game, rows, update, genres, franchises };
}

describe('MetadataSyncService.syncGame', () => {
  it('aplica sozinho com título exato, mapeia gêneros e franquia e registra o que preencheu', async () => {
    const { service, game, rows, genres, franchises } = setup(baseGame(), async () => [hades]);
    expect(await service.syncGame(id(1))).toBe('APPLIED_AUTO');
    expect(game).toMatchObject({ description: 'Roguelike', releaseYear: 2020, developer: 'Supergiant', coverUrl: 'https://img/cover.jpg' });
    expect(game.genreIds).toHaveLength(2);
    expect(game.genreIds).toEqual(expect.arrayContaining([id(100), genres.find((genre) => genre.name === 'Roguelike')!.id]));
    expect(franchises).toHaveLength(1);
    expect(rows.get(id(1))).toMatchObject({ status: 'APPLIED_AUTO', providerId: 'igdb-1' });
    expect(rows.get(id(1))!.appliedFields).toEqual(expect.arrayContaining(['description', 'releaseYear', 'coverUrl', 'genreIds', 'franchiseId']));
  });

  it('nunca sobrescreve um campo já preenchido', async () => {
    const { service, game } = setup(baseGame({ description: 'Minha descrição', developer: 'Eu' }), async () => [hades]);
    await service.syncGame(id(1));
    expect(game.description).toBe('Minha descrição');
    expect(game.developer).toBe('Eu');
    expect(game.releaseYear).toBe(2020);
  });

  it('manda para revisão quando só há títulos parecidos e guarda os candidatos', async () => {
    const { service, game, rows } = setup(baseGame(), async () => [{ ...hades, providerId: 'igdb-2', title: 'Hades II' }]);
    expect(await service.syncGame(id(1))).toBe('NEEDS_REVIEW');
    expect(game.description).toBeNull();
    expect(rows.get(id(1))!.candidates).toHaveLength(1);
  });

  it('marca não encontrado e só tenta de novo depois de 30 dias ou se o título mudar', async () => {
    const search = vi.fn(async () => []);
    const { service, game, rows } = setup(baseGame(), search);
    expect(await service.syncGame(id(1))).toBe('NOT_FOUND');
    expect(await service.syncGame(id(1))).toBe('SKIPPED');
    game.title = 'Hades 2';
    expect(await service.syncGame(id(1))).toBe('NOT_FOUND');
    rows.set(id(1), { ...rows.get(id(1))!, checkedAt: new Date(now.getTime() - 31 * 86_400_000) });
    expect(await service.syncGame(id(1))).toBe('NOT_FOUND');
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('não grava nada quando o provedor falha, para tentar de novo depois', async () => {
    const { service, rows } = setup(baseGame(), async () => { throw new Error('HTTP 500'); });
    expect(await service.syncGame(id(1))).toBe('FAILED');
    expect(rows.size).toBe(0);
  });

  it('preenche os tempos do HowLongToBeat só com título exato e campos vazios', async () => {
    const times = { search: async () => [{ providerId: 'h', title: 'Hades', releaseYear: 2020, mainHours: 22, mainExtraHours: 30, completionistHours: 95 }] as never[] };
    const { service, game, rows } = setup(baseGame({ estimatedCompletionistHours: 80 }), async () => [hades], undefined, times);
    await service.syncGame(id(1));
    expect(game.estimatedMainHours).toBe(22);
    expect(game.estimatedCompletionistHours).toBe(80);
    expect(rows.get(id(1))!.appliedFields).toContain('estimatedMainHours');
  });

  it('não consulta jogos que já têm todos os metadados', async () => {
    const complete = baseGame({ description: 'x', coverUrl: '/media/a.jpg', releaseYear: 2020, developer: 'y', genreIds: [id(100)] });
    expect(needsMetadata(complete)).toBe(false);
    const search = vi.fn(async () => [hades]);
    expect(await setup(complete, search).service.syncGame(id(1))).toBe('SKIPPED');
    expect(search).not.toHaveBeenCalled();
  });
});

describe('MetadataSyncService revisão', () => {
  it('lista, confirma, desfaz e permite escolher outro candidato', async () => {
    const { service, game, rows } = setup(baseGame(), async () => [hades]);
    await service.syncGame(id(1));
    expect((await service.review()).count).toBe(1);

    expect(await service.undo(id(1))).toBe(true);
    expect(game).toMatchObject({ description: null, releaseYear: null, genreIds: [], franchiseId: null });
    expect(rows.get(id(1))!.status).toBe('NEEDS_REVIEW');

    expect(await service.useCandidate(id(1), 'igdb-1')).toBe('OK');
    expect(game.description).toBe('Roguelike');
    expect(rows.get(id(1))!.status).toBe('CONFIRMED');
    expect((await service.review()).count).toBe(0);
  });

  it('ignora um jogo e não volta a consultá-lo', async () => {
    const search = vi.fn(async () => []);
    const { service } = setup(baseGame(), search);
    await service.syncGame(id(1));
    expect(await service.ignore(id(1))).toBe(true);
    expect(await service.syncGame(id(1))).toBe('SKIPPED');
    expect((await service.review()).count).toBe(0);
  });
});

describe('MetadataSyncService.sweep', () => {
  it('respeita o limite por rodada e interrompe na primeira falha', async () => {
    const search = vi.fn(async () => [hades]);
    const { service } = setup(baseGame(), search);
    expect(await service.sweep(25)).toMatchObject({ checked: 1, applied: 1, failed: false });
    const failing = setup(baseGame(), async () => { throw new Error('HTTP 401'); });
    expect(await failing.service.sweep()).toMatchObject({ checked: 0, failed: true });
  });
});
