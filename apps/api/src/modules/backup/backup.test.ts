import { afterEach, describe, expect, it } from 'vitest';
import type { BackupData } from '@gameshelf/contracts';
import { backupSchema } from '@gameshelf/contracts';
import { buildApp } from '../../app.js';
import { findBackupIssues } from './service.js';
import { LibraryNotEmptyError, type BackupImporter } from './importer.js';
import type { GameRecord } from '../games/repository.js';
import type { GamePlatformRecord } from '../game-platforms/repository.js';
import type { PlaythroughRecord } from '../playthroughs/repository.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-03-01T10:00:00.000Z');

const gameRecord: GameRecord = {
  id: id(10), title: 'Hades', description: null, coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null,
  franchiseId: id(1), platformId: id(2), platformIds: [id(2)], genreIds: [id(3)], status: 'COMPLETED', archived: false, priority: 'HIGH', rating: 10, difficulty: 'B',
  gameType: null, completionCondition: null, favorite: true, gameOfYear: false, excludedFromSuggestions: false, owned: true, startedAt: '2026-01-01', completedAt: '2026-02-01',
  estimatedMainHours: '20.50', estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: '5', notes: null, createdAt: now, updatedAt: now,
};

const platformLinkRecord: GamePlatformRecord = {
  id: id(60), gameId: id(10), platformId: id(2), edition: null, format: 'DIGITAL', owned: true, isPrimary: true,
  externalSource: null, externalId: null, externalAccountLabel: null, externalPlaytimeMinutes: null,
  externalLastPlayedAt: null, externalSyncedAt: null, notes: null, createdAt: now, updatedAt: now,
};

const playthroughRecord: PlaythroughRecord = {
  id: id(70), gameId: id(10), sequence: 1, label: 'Primeira jornada', status: 'COMPLETED', primaryPlatformId: id(2),
  startedAt: '2026-01-01', completedAt: '2026-02-01', notes: null, createdAt: now, updatedAt: now,
};

function validData(): BackupData {
  return {
    franchises: [{ id: id(1), name: 'Supergiant' }], platforms: [{ id: id(2), name: 'PC' }], genres: [{ id: id(3), name: 'Roguelike' }],
    games: [{
      id: id(10), title: 'Hades', description: null, coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null,
      franchiseId: id(1), platformId: id(2), platformIds: [id(2)], genreIds: [id(3)], status: 'COMPLETED', rating: 10, difficulty: 'B', gameType: null, completionCondition: null,
      favorite: true, gameOfYear: false, excludedFromSuggestions: false, owned: true, archived: false, startedAt: '2026-01-01', completedAt: '2026-02-01', priority: 'HIGH',
      estimatedMainHours: 20.5, estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 5, notes: null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }],
    sessions: [{ id: id(20), gameId: id(10), startedAt: now.toISOString(), endedAt: null, progress: null, location: null, notes: null, keyDecisions: null, tips: null, playthroughId: null, platformId: null, createdAt: now.toISOString(), updatedAt: now.toISOString() }],
    screenshots: [{ id: id(30), sessionId: id(20), url: '/media/00000000-0000-4000-8000-000000000999.png', createdAt: now.toISOString() }],
    queue: [{ gameId: id(10), position: 0, addedAt: now.toISOString() }],
    lists: [{ id: id(40), name: 'Favoritos', gameIds: [id(10)], createdAt: now.toISOString(), updatedAt: now.toISOString() }],
    challenge: { title: 'Zerar tudo', listId: id(40) },
    goals: [{ id: id(50), kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: 0, target: 12 }],
    gamePlatforms: [{
      id: id(60), gameId: id(10), platformId: id(2), edition: null, format: 'DIGITAL', owned: true, isPrimary: true,
      externalSource: null, externalId: null, externalAccountLabel: null, externalPlaytimeMinutes: null,
      externalLastPlayedAt: null, externalSyncedAt: null, notes: null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }],
    playthroughs: [{
      id: id(70), gameId: id(10), sequence: 1, label: 'Primeira jornada', status: 'COMPLETED', primaryPlatformId: id(2),
      startedAt: '2026-01-01', completedAt: '2026-02-01', notes: null, isReplay: false,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }],
    weeklyMinutes: 360,
  };
}

describe('backup integrity', () => {
  it('accepts consistent data', () => {
    expect(findBackupIssues(validData())).toEqual([]);
  });

  it('reports repeated ids, repeated names and dangling references', () => {
    const data = validData();
    data.franchises.push({ id: id(1), name: 'Supergiant' });
    data.games[0]!.platformId = id(99);
    data.games[0]!.genreIds = [id(3), id(98)];
    data.sessions[0]!.gameId = id(97);
    data.screenshots[0]!.sessionId = id(96);
    data.queue.push({ gameId: id(10), position: 0, addedAt: now.toISOString() });
    data.lists[0]!.gameIds = [id(10), id(10), id(95)];
    data.challenge = { title: 'x', listId: id(94) };
    data.goals.push({ id: id(51), kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: 0, target: 5 }, { id: id(52), kind: 'PLAYED_HOURS', period: 'MONTH', year: 2026, month: 0, target: 5 });
    const issues = findBackupIssues(data).join('\n');
    for (const expected of ['Franquias: id repetido', 'Franquias: nome repetido', 'plataforma inexistente', 'gênero inexistente', 'Sessão', 'Imagem', 'Fila: jogo repetido', 'Fila: posição repetida', 'jogos repetidos', 'Missão principal', 'meta repetida', 'mês incompatível']) {
      expect(issues).toContain(expected);
    }
  });

  it('caps the number of reported issues', () => {
    const data = validData();
    data.sessions = Array.from({ length: 50 }, (_, index) => ({ ...data.sessions[0]!, id: id(1000 + index), gameId: id(999) }));
    expect(findBackupIssues(data)).toHaveLength(20);
  });
});

describe('backup API', () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

  function setup(importer: BackupImporter) {
    const app = buildApp({
      gameRepository: { list: async () => [gameRecord], find: async () => gameRecord, create: async () => gameRecord, update: async () => gameRecord, delete: async () => true },
      franchiseRepository: { list: async () => [{ id: id(1), name: 'Supergiant' }], create: async () => ({ id: id(1), name: 'Supergiant' }) },
      platformRepository: { list: async () => [{ id: id(2), name: 'PC' }], create: async () => ({ id: id(2), name: 'PC' }) },
      genreRepository: { list: async () => [{ id: id(3), name: 'Roguelike' }], create: async () => ({ id: id(3), name: 'Roguelike' }) },
      sessionRepository: {
        listForGame: async () => [], findForGame: async () => undefined, create: async () => { throw new Error('unused'); }, update: async () => undefined, delete: async () => false,
        detachPlaythrough: async () => 0,
        listAll: async () => [{ id: id(20), gameId: id(10), startedAt: now, endedAt: new Date(now.getTime() + 3_600_000), progress: 50, location: 'Elysium', notes: null, keyDecisions: null, tips: null, playthroughId: null, platformId: null, createdAt: now, updatedAt: now }],
      },
      screenshotRepository: {
        listForSession: async () => [], listForGame: async () => [], add: async () => { throw new Error('unused'); }, remove: async () => undefined,
        listAll: async () => [{ id: id(30), sessionId: id(20), url: '/media/00000000-0000-4000-8000-000000000999.png', createdAt: now }],
      },
      backlogRepository: { listQueue: async () => [{ game: gameRecord, position: 0, addedAt: now }], addToQueue: async () => undefined, removeFromQueue: async () => false, reorderQueue: async () => false },
      gameListRepository: {
        list: async () => [{ id: id(40), name: 'Favoritos', createdAt: now, updatedAt: now, gameIds: [id(10)] }], find: async () => undefined,
        create: async () => { throw new Error('unused'); }, rename: async () => undefined, delete: async () => false, addGame: async () => undefined, addGames: async () => undefined, removeGame: async () => false,
      },
      mainChallengeRepository: { get: async () => ({ title: 'Zerar tudo', listId: id(40) }), set: async () => undefined, clear: async () => undefined },
      goalRepository: { list: async () => [{ id: id(50), kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: 0, target: 12 }], create: async () => { throw new Error('unused'); }, updateTarget: async () => undefined, remove: async () => false },
      planningSettingsRepository: { getWeeklyMinutes: async () => 360, setWeeklyMinutes: async () => undefined },
      gamePlatformRepository: {
        listAll: async () => [platformLinkRecord], listForGame: async () => [platformLinkRecord], find: async () => platformLinkRecord,
        create: async () => platformLinkRecord, update: async () => platformLinkRecord, delete: async () => false,
        listByExternalSource: async () => [], attachExternal: async () => platformLinkRecord,
        updateExternalSnapshot: async () => platformLinkRecord,
      },
      playthroughRepository: {
        listAll: async () => [playthroughRecord], listForGame: async () => [playthroughRecord], find: async () => playthroughRecord,
        create: async () => playthroughRecord, update: async () => playthroughRecord, delete: async () => false,
      },
      backupImporter: importer,
    });
    apps.push(app);
    return app;
  }

  it('exports every collection as a downloadable, schema-valid file', async () => {
    const response = await setup({ importAll: async () => undefined }).inject('/backup/export');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="gameshelf-backup-\d{4}-\d{2}-\d{2}\.json"$/);
    const backup = backupSchema.parse(response.json());
    expect(backup.data.games[0]).toMatchObject({ title: 'Hades', genreIds: [id(3)], estimatedMainHours: 20.5, retroactivePlayedHours: 5 });
    expect(backup.data).toMatchObject({
      franchises: [{ name: 'Supergiant' }], sessions: [{ progress: 50 }], screenshots: [{ id: id(30) }], queue: [{ gameId: id(10), position: 0 }],
      lists: [{ gameIds: [id(10)] }], challenge: { title: 'Zerar tudo' }, goals: [{ target: 12 }], weeklyMinutes: 360,
    });
    expect(findBackupIssues(backup.data)).toEqual([]);
  });

  it('imports a valid backup exactly once and reports what was written', async () => {
    const imported: BackupData[] = [];
    const app = setup({ importAll: async (data) => { imported.push(data); } });
    const backup = { app: 'gameshelf', version: 1, exportedAt: now.toISOString(), data: validData() };
    const response = await app.inject({ method: 'POST', url: '/backup/import', payload: backup });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ games: 1, sessions: 1, lists: 1, goals: 1, screenshots: 1, queue: 1, gamePlatforms: 1, playthroughs: 1 });
    expect(imported).toHaveLength(1);
  });

  it('rejects files that are not a GameShelf backup, unknown fields and inconsistent references without importing', async () => {
    const imported: BackupData[] = [];
    const app = setup({ importAll: async (data) => { imported.push(data); } });
    const post = (payload: unknown) => app.inject({ method: 'POST', url: '/backup/import', payload: payload as object });
    expect((await post({ hello: 'world' })).statusCode).toBe(400);
    expect((await post({ app: 'gameshelf', version: 2, exportedAt: now.toISOString(), data: validData() })).statusCode).toBe(400);
    expect((await post({ app: 'gameshelf', version: 1, exportedAt: now.toISOString(), data: { ...validData(), extra: true } })).statusCode).toBe(400);
    const dangling = validData();
    dangling.sessions[0]!.gameId = id(77);
    const inconsistent = await post({ app: 'gameshelf', version: 1, exportedAt: now.toISOString(), data: dangling });
    expect(inconsistent.statusCode).toBe(400);
    expect(inconsistent.json().problems).toEqual([expect.stringContaining('jogo inexistente')]);
    expect(imported).toEqual([]);
  });

  it('answers 409 for a library that already has data and 422 when the database rejects the data', async () => {
    const backup = { app: 'gameshelf', version: 1, exportedAt: now.toISOString(), data: validData() };
    const notEmpty = setup({ importAll: async () => { throw new LibraryNotEmptyError(); } });
    expect((await notEmpty.inject({ method: 'POST', url: '/backup/import', payload: backup })).statusCode).toBe(409);
    const rejected = setup({ importAll: async () => { throw new Error('check constraint'); } });
    const response = await rejected.inject({ method: 'POST', url: '/backup/import', payload: backup });
    expect(response.statusCode).toBe(422);
    expect(response.body).not.toContain('check constraint');
  });
});
