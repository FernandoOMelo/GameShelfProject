import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { GameInput, GameUpdate } from '@gameshelf/contracts';
import type { GameRecord, GameRepository } from './modules/games/repository.js';
import type { FranchiseRepository } from './modules/franchises/repository.js';
import type { PlatformRepository } from './modules/platforms/repository.js';
import type { GenreRepository } from './modules/genres/repository.js';
import type { SessionRecord, SessionRepository } from './modules/sessions/repository.js';
import type { BacklogRepository, QueueRecord } from './modules/backlog/repository.js';
import type { PlanningSettingsRepository } from './modules/planning/repository.js';
import type { GameMetadataProvider } from './modules/games/metadata-provider.js';
import type { GameTimeEstimateProvider } from './modules/games/time-estimate-provider.js';
import type { GameImageStorage } from './modules/games/image-storage.js';
import type { GameListRepository, GameListRecord } from './modules/game-lists/repository.js';
import type { GoalRecord, GoalRepository } from './modules/goals/repository.js';
import type { ScreenshotRecord, ScreenshotRepository } from './modules/sessions/screenshot-repository.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const game: GameRecord = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
  coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: 'Supergiant Games',
  publisher: null, franchiseId: null, status: 'BACKLOG', priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null, platformId: null, platformIds: [], genreIds: [], rating: null, difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: true, archived: false, startedAt: null, completedAt: null,
  createdAt: now, updatedAt: now,
};

function createRepository(): GameRepository {
  const games = [game];
  return {
    list: async () => games,
    find: async (id) => games.find((item) => item.id === id),
    create: async (input: GameInput) => ({ ...game, ...input, archived: input.archived ?? false, rating: input.rating ?? null, id: '00000000-0000-4000-8000-000000000002' }),
    update: async (id, input: GameUpdate) => {
      const existing = games.find((item) => item.id === id);
      return existing ? { ...existing, ...input, rating: input.rating ?? existing.rating, updatedAt: new Date() } : undefined;
    },
    delete: async (id) => {
      const index = games.findIndex((item) => item.id === id);
      if (index < 0) return false;
      games.splice(index, 1);
      return true;
    },
  };
}

function createFranchiseRepository(): FranchiseRepository {
  const franchises = [{ id: '00000000-0000-4000-8000-000000000010', name: 'The Legend of Zelda' }];
  return {
    list: async () => franchises,
    create: async (name) => {
      if (franchises.some((franchise) => franchise.name === name)) throw { code: '23505' };
      return { id: '00000000-0000-4000-8000-000000000011', name };
    },
  };
}

function createPlatformRepository(): PlatformRepository {
  return {
    list: async () => [{ id: '00000000-0000-4000-8000-000000000020', name: 'PC', parentId: null }],
    create: async (name) => ({ id: '00000000-0000-4000-8000-000000000021', name, parentId: null }),
    setParent: async (id, parentId) => ({ id, name: 'PC', parentId }),
  };
}

function createGenreRepository(): GenreRepository {
  return {
    list: async () => [{ id: '00000000-0000-4000-8000-000000000030', name: 'RPG' }],
    create: async (name) => ({ id: '00000000-0000-4000-8000-000000000031', name }),
  };
}

function createSessionRepository(): SessionRepository {
  const sessions: SessionRecord[] = [];
  return {
    listForGame: async (gameId) => sessions.filter((session) => session.gameId === gameId),
    listAll: async () => sessions,
    detachPlaythrough: async (playthroughId) => {
      const affected = sessions.filter((session) => session.playthroughId === playthroughId);
      for (const session of affected) session.playthroughId = null;
      return affected.length;
    },
    findForGame: async (gameId, sessionId) => sessions.find((session) => session.gameId === gameId && session.id === sessionId),
    create: async (gameId, input) => {
      const createdAt = new Date();
      const session: SessionRecord = {
        id: '00000000-0000-4000-8000-000000000040', gameId,
        playthroughId: input.playthroughId ?? null, platformId: input.platformId ?? null,
        startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
        progress: input.progress ?? null, location: input.location ?? null, notes: input.notes ?? null,
        keyDecisions: input.keyDecisions ?? null, tips: input.tips ?? null,
        createdAt, updatedAt: createdAt,
      };
      sessions.push(session);
      return session;
    },
    update: async (gameId, sessionId, input) => {
      const index = sessions.findIndex((session) => session.gameId === gameId && session.id === sessionId);
      if (index === -1) return undefined;
      const existing = sessions[index];
      const updated = {
        ...existing,
        startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
        progress: input.progress ?? null, location: input.location ?? null, notes: input.notes ?? null,
        keyDecisions: input.keyDecisions ?? null, tips: input.tips ?? null,
        updatedAt: new Date(),
      };
      sessions[index] = updated;
      return updated;
    },
    delete: async (gameId, sessionId) => {
      const index = sessions.findIndex((session) => session.gameId === gameId && session.id === sessionId);
      if (index === -1) return false;
      sessions.splice(index, 1);
      return true;
    },
  };
}

function createBacklogRepository(gameRecord: GameRecord = game): BacklogRepository {
  const queue: QueueRecord[] = [];
  return {
    listQueue: async () => queue,
    addToQueue: async (gameId) => {
      if (queue.some((item) => item.game.id === gameId)) throw { code: '23505' };
      queue.push({ game: { ...gameRecord, id: gameId }, position: queue.length, addedAt: now });
    },
    removeFromQueue: async (gameId) => {
      const index = queue.findIndex((item) => item.game.id === gameId);
      if (index < 0) return false;
      queue.splice(index, 1);
      queue.forEach((item, position) => { item.position = position; });
      return true;
    },
    reorderQueue: async (gameIds) => {
      if (gameIds.length !== queue.length || !gameIds.every((id) => queue.some((item) => item.game.id === id))) return false;
      gameIds.forEach((id, position) => { queue.find((item) => item.game.id === id)!.position = position; });
      queue.sort((left, right) => left.position - right.position);
      return true;
    },
  };
}

function createPlanningSettingsRepository(): PlanningSettingsRepository {
  let weeklyMinutes = 0;
  return { getWeeklyMinutes: async () => weeklyMinutes, setWeeklyMinutes: async (value) => { weeklyMinutes = value; } };
}

function createScreenshotRepository(sessionOwners: () => Array<{ id: string; gameId: string }>): ScreenshotRepository & { records: ScreenshotRecord[] } {
  const records: ScreenshotRecord[] = [];
  const ownedBy = (gameId: string, sessionId: string) => sessionOwners().some((item) => item.id === sessionId && item.gameId === gameId);
  return {
    records,
    listForSession: async (gameId, sessionId) => ownedBy(gameId, sessionId) ? records.filter((item) => item.sessionId === sessionId) : [],
    listAll: async () => records,
    listForGame: async (gameId) => records.filter((item) => sessionOwners().some((owner) => owner.id === item.sessionId && owner.gameId === gameId)),
    add: async (sessionId, url) => {
      const record = { id: `00000000-0000-4000-8000-${String(700 + records.length).padStart(12, '0')}`, sessionId, url, createdAt: new Date() };
      records.push(record);
      return record;
    },
    remove: async (gameId, sessionId, screenshotId) => {
      const index = records.findIndex((item) => item.id === screenshotId && item.sessionId === sessionId && ownedBy(gameId, sessionId));
      return index < 0 ? undefined : records.splice(index, 1)[0];
    },
  };
}

function createGoalRepository(): GoalRepository {
  const records: GoalRecord[] = [];
  return {
    list: async () => records,
    create: async (input) => {
      const month = input.month ?? 0;
      if (records.some((item) => item.kind === input.kind && item.period === input.period && item.year === input.year && item.month === month)) throw { code: '23505' };
      const record = { id: `00000000-0000-4000-8000-${String(900 + records.length).padStart(12, '0')}`, kind: input.kind, period: input.period, year: input.year, month, target: input.target };
      records.push(record);
      return record;
    },
    updateTarget: async (id, target) => {
      const record = records.find((item) => item.id === id);
      if (record) record.target = target;
      return record;
    },
    remove: async (id) => {
      const index = records.findIndex((item) => item.id === id);
      if (index < 0) return false;
      records.splice(index, 1);
      return true;
    },
  };
}

function createGameListRepository(): GameListRepository {
  const lists: GameListRecord[] = [];
  return {
    list: async () => lists,
    find: async (id) => lists.find((list) => list.id === id),
    create: async (name) => {
      if (lists.some((list) => list.name === name)) throw { code: '23505' };
      const record = { id: '00000000-0000-4000-8000-000000000050', name, createdAt: now, updatedAt: now, gameIds: [] };
      lists.push(record);
      return record;
    },
    rename: async (id, name) => {
      const record = lists.find((list) => list.id === id);
      if (!record) return undefined;
      if (lists.some((list) => list.id !== id && list.name === name)) throw { code: '23505' };
      record.name = name;
      return record;
    },
    delete: async (id) => {
      const index = lists.findIndex((list) => list.id === id);
      if (index < 0) return false;
      lists.splice(index, 1);
      return true;
    },
    addGame: async (listId, gameId) => {
      const record = lists.find((list) => list.id === listId)!;
      if (record.gameIds.includes(gameId)) throw { code: '23505' };
      record.gameIds.push(gameId);
    },
    addGames: async (listId, gameIds) => {
      const record = lists.find((list) => list.id === listId)!;
      for (const gameId of gameIds) if (!record.gameIds.includes(gameId)) record.gameIds.push(gameId);
    },
    removeGame: async (listId, gameId) => {
      const record = lists.find((list) => list.id === listId);
      if (!record) return false;
      const index = record.gameIds.indexOf(gameId);
      if (index < 0) return false;
      record.gameIds.splice(index, 1);
      return true;
    },
  };
}

describe('GET /health', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('returns the API health contract', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'gameshelf-api' });
  });

  it('allows the configured local web origin', async () => {
    const app = buildApp({ webOrigin: 'http://localhost:5173' });
    apps.push(app);
    const response = await app.inject({ method: 'OPTIONS', url: '/games', headers: { origin: 'http://localhost:5173' } });
    const rejected = await app.inject({ method: 'OPTIONS', url: '/games', headers: { origin: 'http://malicious.local' } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(rejected.statusCode).toBe(403);
  });
});

describe('games API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('lists games and returns the shared response shape', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const response = await app.inject('/games');
    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({ id: game.id, title: 'Hades', status: 'BACKLOG' });
  });

  it('returns a game by id for the detail view', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const response = await app.inject(`/games/${game.id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: game.id, title: 'Hades', estimatedMainHours: null });
  });

  it('rejects a blank title and negative estimates', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const blank = await app.inject({ method: 'POST', url: '/games', payload: { title: '  ' } });
    const negative = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Hades', personalEstimatedHours: -1 } });
    expect(blank.statusCode).toBe(400);
    expect(negative.statusCode).toBe(400);
  });

  it('accepts a franchise association when creating a game', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const response = await app.inject({
      method: 'POST', url: '/games',
      payload: { title: 'Metroid Dread', franchiseId: '00000000-0000-4000-8000-000000000010' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().franchiseId).toBe('00000000-0000-4000-8000-000000000010');
  });

  it('accepts a single platform and genre association', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const platformId = '00000000-0000-4000-8000-000000000020';
    const genreId = '00000000-0000-4000-8000-000000000030';
    const response = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Hades', platformId, genreIds: [genreId], status: 'PLAYING', owned: true, startedAt: '2025-01-01' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ platformId, genreIds: [genreId], status: 'PLAYING', owned: true, startedAt: '2025-01-01' });
  });

  it('accepts GameShelf local media paths when creating or editing a game', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const coverUrl = '/media/00000000-0000-4000-8000-000000000050.jpg';
    const created = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Local cover', coverUrl } });
    const updated = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { coverUrl } });
    expect(created.statusCode).toBe(201);
    expect(created.json().coverUrl).toBe(coverUrl);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().coverUrl).toBe(coverUrl);
  });

  it('stores per-platform ownership, lifecycle dates and one game rating', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const platformId = '00000000-0000-4000-8000-000000000020';
    const response = await app.inject({ method: 'POST', url: '/games', payload: {
      title: 'Hades', rating: 11,
      platformId, owned: true, status: 'COMPLETED', startedAt: '2025-01-02', completedAt: '2025-02-03',
    } });
    const invalidRating = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Bad rating', rating: 12 } });
    const invalidDates = await app.inject({ method: 'POST', url: '/games', payload: {
      title: 'Bad dates', platformId, status: 'COMPLETED', startedAt: '2025-03-02', completedAt: '2025-02-03',
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ rating: 11, platformId, owned: true, status: 'COMPLETED', startedAt: '2025-01-02', completedAt: '2025-02-03' });
    expect(invalidRating.statusCode).toBe(400);
    expect(invalidDates.statusCode).toBe(400);
  });

  it('allows ratings only for completed or abandoned games and preserves archive state', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const invalidCreate = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Still playing', status: 'PLAYING', rating: 8 } });
    const archived = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { archived: true } });
    const invalidRating = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { status: 'PLAYING', rating: 8 } });
    expect(invalidCreate.statusCode).toBe(400);
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({ archived: true, status: 'BACKLOG' });
    expect(invalidRating.statusCode).toBe(400);
  });

  it('removes a game from the queue when it is archived or loses possession', async () => {
    const repository = createRepository();
    const backlog = createBacklogRepository();
    const app = buildApp({ gameRepository: repository, backlogRepository: backlog });
    apps.push(app);
    await backlog.addToQueue(game.id);
    const archived = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { archived: true } });
    const queue = await app.inject('/queue');
    expect(archived.statusCode).toBe(200);
    expect(queue.json()).toEqual([]);
  });

  it('returns 404 for unknown games and updates existing games', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const missing = await app.inject('/games/00000000-0000-4000-8000-000000000099');
    const updated = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { priority: 'HIGH' } });
    expect(missing.statusCode).toBe(404);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().priority).toBe('HIGH');
  });

  it('deletes a game and returns 404 when it is already gone', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const deleted = await app.inject({ method: 'DELETE', url: `/games/${game.id}` });
    const missing = await app.inject({ method: 'DELETE', url: `/games/${game.id}` });
    expect(deleted.statusCode).toBe(204);
    expect(missing.statusCode).toBe(404);
  });
});

describe('franchises API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('lists and creates named franchises', async () => {
    const app = buildApp({ franchiseRepository: createFranchiseRepository() });
    apps.push(app);
    const list = await app.inject('/franchises');
    const created = await app.inject({ method: 'POST', url: '/franchises', payload: { name: 'Metroid' } });
    const invalid = await app.inject({ method: 'POST', url: '/franchises', payload: { name: '   ' } });
    const duplicate = await app.inject({ method: 'POST', url: '/franchises', payload: { name: 'The Legend of Zelda' } });
    expect(list.statusCode).toBe(200);
    expect(created.statusCode).toBe(201);
    expect(created.json().name).toBe('Metroid');
    expect(invalid.statusCode).toBe(400);
    expect(duplicate.statusCode).toBe(409);
  });
});

describe('platforms and genres APIs', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('lists and creates platform and genre catalog entries', async () => {
    const app = buildApp({ platformRepository: createPlatformRepository(), genreRepository: createGenreRepository() });
    apps.push(app);
    const platforms = await app.inject('/platforms');
    const platform = await app.inject({ method: 'POST', url: '/platforms', payload: { name: 'Nintendo Switch' } });
    const genres = await app.inject('/genres');
    const genre = await app.inject({ method: 'POST', url: '/genres', payload: { name: 'Metroidvania' } });
    expect(platforms.json()[0].name).toBe('PC');
    expect(platform.statusCode).toBe(201);
    expect(genres.json()[0].name).toBe('RPG');
    expect(genre.statusCode).toBe(201);
  });

  it('rejects blank catalog names', async () => {
    const app = buildApp({ platformRepository: createPlatformRepository(), genreRepository: createGenreRepository() });
    apps.push(app);
    const platform = await app.inject({ method: 'POST', url: '/platforms', payload: { name: '  ' } });
    const genre = await app.inject({ method: 'POST', url: '/genres', payload: { name: '' } });
    expect(platform.statusCode).toBe(400);
    expect(genre.statusCode).toBe(400);
  });
});

describe('sessions API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('creates a game session and calculates its duration on the server', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository() });
    apps.push(app);
    const response = await app.inject({
      method: 'POST', url: `/games/${game.id}/sessions`,
      payload: {
        startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T11:35:00.000Z',
        progress: 45, location: 'Elysium', notes: 'Primeira tentativa.',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ gameId: game.id, durationMinutes: 95, progress: 45, location: 'Elysium' });
    // O reenvio da mesma sessão (fila offline) não duplica o registro.
    const resent = await app.inject({ method: 'POST', url: `/games/${game.id}/sessions`, payload: { startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T11:35:00.000Z' } });
    expect(resent.statusCode).toBe(409);
    expect((await app.inject(`/games/${game.id}/sessions`)).json()).toHaveLength(1);
  });

  it('stores the session journal and preserves the fields untouched by a patch', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository() });
    apps.push(app);
    const created = await app.inject({
      method: 'POST', url: `/games/${game.id}/sessions`,
      payload: {
        startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T11:00:00.000Z',
        location: 'Capítulo 3', notes: 'Os Turks apareceram de novo.',
        keyDecisions: 'Salvei a vila.', tips: 'Guardar as poções para o boss.',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ location: 'Capítulo 3', keyDecisions: 'Salvei a vila.', tips: 'Guardar as poções para o boss.' });
    const patched = await app.inject({
      method: 'PATCH', url: `/games/${game.id}/sessions/${created.json().id}`,
      payload: { progress: 30 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ progress: 30, keyDecisions: 'Salvei a vila.', tips: 'Guardar as poções para o boss.' });
  });

  it('rejects invalid session timing and progress', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository() });
    apps.push(app);
    const beforeStart = await app.inject({ method: 'POST', url: `/games/${game.id}/sessions`, payload: { startedAt: '2026-01-01T11:00:00.000Z', endedAt: '2026-01-01T10:00:00.000Z' } });
    const invalidProgress = await app.inject({ method: 'POST', url: `/games/${game.id}/sessions`, payload: { startedAt: '2026-01-01T10:00:00.000Z', progress: 101 } });
    expect(beforeStart.statusCode).toBe(400);
    expect(invalidProgress.statusCode).toBe(400);
  });

  it('lists sessions for an existing game and returns 404 for a missing game', async () => {
    const sessionRepository = createSessionRepository();
    const app = buildApp({ gameRepository: createRepository(), sessionRepository });
    apps.push(app);
    await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T10:30:00.000Z' });
    const list = await app.inject(`/games/${game.id}/sessions`);
    const missing = await app.inject('/games/00000000-0000-4000-8000-000000000099/sessions');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(missing.statusCode).toBe(404);
  });

  it('finishes an in-progress session and validates updated timestamps', async () => {
    const sessionRepository = createSessionRepository();
    const created = await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
    const app = buildApp({ gameRepository: createRepository(), sessionRepository });
    apps.push(app);
    const finish = await app.inject({
      method: 'PATCH', url: `/games/${game.id}/sessions/${created.id}`,
      payload: { endedAt: '2026-01-01T10:45:00.000Z', progress: 30 },
    });
    const invalidUpdate = await app.inject({
      method: 'PATCH', url: `/games/${game.id}/sessions/${created.id}`,
      payload: { endedAt: '2026-01-01T09:59:00.000Z' },
    });
    expect(finish.statusCode).toBe(200);
    expect(finish.json()).toMatchObject({ durationMinutes: 45, progress: 30 });
    expect(invalidUpdate.statusCode).toBe(400);
  });

  it('deletes a session only from the requested game', async () => {
    const sessionRepository = createSessionRepository();
    const created = await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
    const app = buildApp({ gameRepository: createRepository(), sessionRepository });
    apps.push(app);
    const wrongGame = await app.inject({ method: 'DELETE', url: `/games/00000000-0000-4000-8000-000000000002/sessions/${created.id}` });
    const deleted = await app.inject({ method: 'DELETE', url: `/games/${game.id}/sessions/${created.id}` });
    const repeated = await app.inject({ method: 'DELETE', url: `/games/${game.id}/sessions/${created.id}` });
    expect(wrongGame.statusCode).toBe(404);
    expect(deleted.statusCode).toBe(204);
    expect(repeated.statusCode).toBe(404);
  });
});

describe('backlog and planning APIs', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('adds a game to the queue, rejects duplicates and removes it', async () => {
    const app = buildApp({ gameRepository: createRepository(), backlogRepository: createBacklogRepository() });
    apps.push(app);
    const added = await app.inject({ method: 'POST', url: '/queue', payload: { gameId: game.id } });
    const duplicate = await app.inject({ method: 'POST', url: '/queue', payload: { gameId: game.id } });
    const removed = await app.inject({ method: 'DELETE', url: `/queue/${game.id}` });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toMatchObject({ position: 0, game: { id: game.id, title: game.title } });
    expect(duplicate.statusCode).toBe(409);
    expect(removed.statusCode).toBe(204);
  });

  it('rejects games that are not owned from the queue', async () => {
    const nonOwnedRepository = createRepository();
    const originalFind = nonOwnedRepository.find;
    nonOwnedRepository.find = async (id) => {
      const found = await originalFind(id);
      return found ? { ...found, owned: false } : undefined;
    };
    const app = buildApp({ gameRepository: nonOwnedRepository, backlogRepository: createBacklogRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'POST', url: '/queue', payload: { gameId: game.id } });
    expect(response.statusCode).toBe(400);
  });

  it('saves a weekly goal and returns a dashboard summary', async () => {
    const app = buildApp({
      gameRepository: createRepository(), sessionRepository: createSessionRepository(),
      backlogRepository: createBacklogRepository(), planningSettingsRepository: createPlanningSettingsRepository(),
    });
    apps.push(app);
    const invalid = await app.inject({ method: 'PUT', url: '/planning/settings', payload: { weeklyMinutes: -30 } });
    const saved = await app.inject({ method: 'PUT', url: '/planning/settings', payload: { weeklyMinutes: 360 } });
    const dashboard = await app.inject('/dashboard');
    const rangedDashboard = await app.inject('/dashboard?from=2026-01-01&to=2026-01-31&timezoneOffsetMinutes=180');
    const invalidRange = await app.inject('/dashboard?from=2026-02-01&to=2026-01-01');
    expect(invalid.statusCode).toBe(400);
    expect(saved.json()).toEqual({ weeklyMinutes: 360 });
    expect(dashboard.json()).toMatchObject({ gameCount: 1, weeklyHours: 6, queueRemainingHours: 0, estimatedQueueWeeks: 0 });
    expect(rangedDashboard.json().period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(invalidRange.statusCode).toBe(400);
  });
});

describe('custom game lists API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('creates a named list, adds and removes games, and returns the list contents', async () => {
    const app = buildApp({ gameRepository: createRepository(), gameListRepository: createGameListRepository() });
    apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/lists', payload: { name: 'Favoritos' } });
    expect(created.statusCode).toBe(201);
    const listId = created.json().id as string;
    expect(created.json()).toMatchObject({ name: 'Favoritos', gameCount: 0 });

    const added = await app.inject({ method: 'POST', url: `/lists/${listId}/games`, payload: { gameId: game.id } });
    expect(added.statusCode).toBe(204);
    const duplicate = await app.inject({ method: 'POST', url: `/lists/${listId}/games`, payload: { gameId: game.id } });
    expect(duplicate.statusCode).toBe(409);
    const detail = await app.inject(`/lists/${listId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ name: 'Favoritos', gameCount: 1, games: [{ id: game.id, title: 'Hades' }] });

    const removed = await app.inject({ method: 'DELETE', url: `/lists/${listId}/games/${game.id}` });
    expect(removed.statusCode).toBe(204);
    expect((await app.inject(`/lists/${listId}`)).json()).toMatchObject({ gameCount: 0, games: [] });
    const renamed = await app.inject({ method: 'PATCH', url: `/lists/${listId}`, payload: { name: 'Favoritos pessoais' } });
    expect(renamed.json()).toMatchObject({ id: listId, name: 'Favoritos pessoais' });
    expect((await app.inject({ method: 'DELETE', url: `/lists/${listId}` })).statusCode).toBe(204);
    expect((await app.inject(`/lists/${listId}`)).statusCode).toBe(404);
  });

  it('rejects blank and duplicate list names', async () => {
    const app = buildApp({ gameRepository: createRepository(), gameListRepository: createGameListRepository() });
    apps.push(app);
    expect((await app.inject({ method: 'POST', url: '/lists', payload: { name: '  ' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/lists', payload: { name: 'Backlog pessoal' } })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/lists', payload: { name: 'Backlog pessoal' } })).statusCode).toBe(409);
  });

  it('saves, applies, renames and deletes a library filter', async () => {
    const stored: Array<{ id: string; name: string; filters: unknown; createdAt: Date; updatedAt: Date }> = [];
    const app = buildApp({
      savedFilterRepository: {
        list: async () => stored as never,
        find: async (id) => stored.find((item) => item.id === id) as never,
        create: async (name, filters) => {
          if (stored.some((item) => item.name === name)) throw { code: '23505' };
          const record = { id: '00000000-0000-4000-8000-000000000080', name, filters, createdAt: now, updatedAt: now };
          stored.push(record);
          return record as never;
        },
        update: async (id, changes) => {
          const record = stored.find((item) => item.id === id);
          if (!record) return undefined;
          Object.assign(record, changes);
          return record as never;
        },
        delete: async (id) => {
          const index = stored.findIndex((item) => item.id === id);
          if (index < 0) return false;
          stored.splice(index, 1);
          return true;
        },
      },
    });
    apps.push(app);

    const filters = { query: 'hades', status: 'COMPLETED', priority: 'ALL', platformId: 'ALL', genreId: 'ALL', franchiseId: 'ALL', developer: 'ALL', listId: 'ALL', completedYear: '2026', archived: false, sortBy: 'COMPLETED_DESC' };
    const created = await app.inject({ method: 'POST', url: '/saved-filters', payload: { name: 'Zerados 2026', filters } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'Zerados 2026', filters });

    expect((await app.inject({ method: 'POST', url: '/saved-filters', payload: { name: 'Zerados 2026', filters } })).statusCode).toBe(409);
    expect((await app.inject('/saved-filters')).json()).toHaveLength(1);

    const filterId = created.json().id as string;
    const renamed = await app.inject({ method: 'PATCH', url: `/saved-filters/${filterId}`, payload: { name: 'Zerados do ano' } });
    expect(renamed.json()).toMatchObject({ name: 'Zerados do ano' });

    expect((await app.inject({ method: 'DELETE', url: `/saved-filters/${filterId}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/saved-filters/${filterId}` })).statusCode).toBe(404);
  });

  it('rejects a saved filter with an unknown sort or extra field', async () => {
    const app = buildApp({ savedFilterRepository: { list: async () => [], find: async () => undefined, create: async () => { throw new Error('unused'); }, update: async () => undefined, delete: async () => false } });
    apps.push(app);
    const base = { query: '', status: 'ALL', priority: 'ALL', platformId: 'ALL', genreId: 'ALL', franchiseId: 'ALL', developer: 'ALL', listId: 'ALL', completedYear: 'ALL', archived: false };
    expect((await app.inject({ method: 'POST', url: '/saved-filters', payload: { name: 'X', filters: { ...base, sortBy: 'RANDOM' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/saved-filters', payload: { name: 'X', filters: { ...base, sortBy: 'TITLE', surpresa: 1 } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/saved-filters', payload: { name: '   ', filters: { ...base, sortBy: 'TITLE' } } })).statusCode).toBe(400);
  });

  it('creates a list already populated with games', async () => {
    const app = buildApp({ gameRepository: createRepository(), gameListRepository: createGameListRepository() });
    apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/lists', payload: { name: 'Em andamento', gameIds: [game.id] } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'Em andamento', gameCount: 1 });
    expect((await app.inject(`/lists/${created.json().id as string}`)).json()).toMatchObject({ games: [{ id: game.id, title: 'Hades' }] });
  });

  it('rejects a list created with repeated games', async () => {
    const app = buildApp({ gameRepository: createRepository(), gameListRepository: createGameListRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'POST', url: '/lists', payload: { name: 'Repetida', gameIds: [game.id, game.id] } });
    expect(response.statusCode).toBe(400);
  });
});

describe('metadata search API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('returns validated provider candidates for a search query', async () => {
    const metadataProvider: GameMetadataProvider = {
      id: 'test-provider',
      search: async (query) => [{ providerId: '42', title: query, releaseYear: 2024 }],
    };
    const app = buildApp({ metadataProvider });
    apps.push(app);

    const result = await app.inject('/metadata/games?query=Example%20Game');

    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual([{ providerId: '42', title: 'Example Game', releaseYear: 2024 }]);
  });

  it('rejects invalid queries and reports an unconfigured provider', async () => {
    const app = buildApp();
    apps.push(app);

    const invalid = await app.inject('/metadata/games?query=%20%20');
    const unavailable = await app.inject('/metadata/games?query=Hades');

    expect(invalid.statusCode).toBe(400);
    expect(unavailable.statusCode).toBe(503);
  });

  it('does not expose provider errors to API clients', async () => {
    const app = buildApp({ metadataProvider: { id: 'test', search: async () => { throw new Error('secret detail'); } } });
    apps.push(app);

    const result = await app.inject('/metadata/games?query=Hades');

    expect(result.statusCode).toBe(502);
    expect(result.json()).toEqual({ error: 'Não foi possível buscar metadata externa. Consulte o log da API para ver o diagnóstico.' });
    expect(result.body).not.toContain('secret detail');
  });
});

describe('time estimate metadata API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('returns validated time estimate candidates for a search query', async () => {
    const timeEstimateProvider: GameTimeEstimateProvider = {
      id: 'howlongtobeat',
      search: async (query) => [{ providerId: '2224', title: query, mainHours: 2, completionistHours: 4 }],
    };
    const app = buildApp({ timeEstimateProvider });
    apps.push(app);

    const result = await app.inject('/metadata/time-estimates?query=Dark%20Souls');

    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual([{ providerId: '2224', title: 'Dark Souls', mainHours: 2, completionistHours: 4 }]);
  });

  it('rejects invalid queries and reports an unconfigured provider', async () => {
    const app = buildApp();
    apps.push(app);

    const invalid = await app.inject('/metadata/time-estimates?query=%20%20');
    const unavailable = await app.inject('/metadata/time-estimates?query=Hades');

    expect(invalid.statusCode).toBe(400);
    expect(unavailable.statusCode).toBe(503);
  });

  it('does not expose provider errors to API clients', async () => {
    const app = buildApp({ timeEstimateProvider: { id: 'test', search: async () => { throw new Error('secret detail'); } } });
    apps.push(app);

    const result = await app.inject('/metadata/time-estimates?query=Hades');

    expect(result.statusCode).toBe(502);
    expect(result.json()).toEqual({ error: 'Não foi possível buscar estimativas no HowLongToBeat. Consulte o log da API para ver o diagnóstico.' });
    expect(result.body).not.toContain('secret detail');
  });
});

describe('local metadata images', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('stores IGDB cover and artwork locally when a game is saved', async () => {
    const importedUrls: string[] = [];
    const imageStorage: GameImageStorage = {
      importImage: async (sourceUrl) => {
        importedUrls.push(sourceUrl);
        return `/media/00000000-0000-4000-8000-000000000050.jpg`;
      },
      saveImage: async () => '/media/00000000-0000-4000-8000-000000000051.png',
      removeImage: async () => undefined,
      openImage: async () => undefined,
    };
    const app = buildApp({ gameRepository: createRepository(), imageStorage });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/games',
      payload: {
        title: 'Hades',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg',
        backgroundUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p/artwork.jpg',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ coverUrl: '/media/00000000-0000-4000-8000-000000000050.jpg' });
    expect(importedUrls).toEqual([
      'https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg',
      'https://images.igdb.com/igdb/image/upload/t_1080p/artwork.jpg',
    ]);
  });
});

describe('classification, stats and challenge API', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('accepts the new classification fields and requires a completion date for game of the year', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Chrono Trigger', status: 'COMPLETED', completedAt: '2026-02-01', difficulty: 'B', gameType: 'RPG de Turno', completionCondition: 'Veja os créditos', favorite: true, gameOfYear: true } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ difficulty: 'B', gameType: 'RPG de Turno', completionCondition: 'Veja os créditos', favorite: true, gameOfYear: true });
    const invalid = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Sem data', gameOfYear: true } });
    expect(invalid.statusCode).toBe(400);
    const badDifficulty = await app.inject({ method: 'POST', url: '/games', payload: { title: 'X', difficulty: 'Z' } });
    expect(badDifficulty.statusCode).toBe(400);
    const patch = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { gameOfYear: true } });
    expect(patch.statusCode).toBe(400);
  });

  it('returns the stats contract', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository(), platformRepository: createPlatformRepository(), genreRepository: createGenreRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/stats' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ totals: { completedCount: 0 }, ratingDistribution: expect.any(Array), byYear: [] });
  });

  it('returns the activity contract and rejects invalid parameters', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository(), platformRepository: createPlatformRepository(), genreRepository: createGenreRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/stats/activity?year=2026&timezoneOffsetMinutes=180' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ year: 2026, days: [], activeDays: 0, totalMinutes: 0, maxDayMinutes: 0, currentStreak: 0, longestStreak: 0 });
    expect((await app.inject({ method: 'GET', url: '/stats/activity?year=abc' })).statusCode).toBe(400);
    const replay = await app.inject({ method: 'GET', url: '/stats/replay?year=2026' });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ year: 2026, totalMinutes: 0, sessionCount: 0, mostPlayedGame: null, gameOfYear: null });
    expect((await app.inject({ method: 'GET', url: '/stats/replay?year=1' })).statusCode).toBe(400);
  });

  it('returns the timeline contract and rejects invalid parameters', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository(), platformRepository: createPlatformRepository(), genreRepository: createGenreRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/stats/timeline?limit=10&timezoneOffsetMinutes=180' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ nextBefore: null, events: [{ type: 'GAME_ADDED', gameId: game.id, gameTitle: 'Hades' }] });
    expect((await app.inject({ method: 'GET', url: '/stats/timeline?limit=0' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/stats/timeline?before=ontem' })).statusCode).toBe(400);
  });

  it('records a challenge completion when the last game of the mission is finished', async () => {
    const challengeListId = '00000000-0000-4000-8000-000000000040';
    const completions: Array<{ title: string; listId: string; gamesCount: number; completedAt: Date }> = [];
    const app = buildApp({
      gameRepository: createRepository(),
      sessionRepository: createSessionRepository(),
      platformRepository: createPlatformRepository(),
      genreRepository: createGenreRepository(),
      gameListRepository: {
        list: async () => [{ id: challengeListId, name: 'FF7', createdAt: now, updatedAt: now, gameIds: [game.id] }],
        find: async () => ({ id: challengeListId, name: 'FF7', createdAt: now, updatedAt: now, gameIds: [game.id] }),
        create: async () => { throw new Error('unused'); }, rename: async () => undefined, delete: async () => false,
        addGame: async () => undefined, addGames: async () => undefined, removeGame: async () => false,
      },
      mainChallengeRepository: { get: async () => ({ title: 'Zerar FF7', listId: challengeListId }), set: async () => undefined, clear: async () => undefined },
      challengeCompletionRepository: {
        listAll: async () => completions.map((item, index) => ({ id: `00000000-0000-4000-8000-0000000000${60 + index}`, ...item })),
        record: async (input) => { completions.push(input); },
      },
    });
    apps.push(app);

    const patch = await app.inject({ method: 'PATCH', url: `/games/${game.id}`, payload: { status: 'COMPLETED', completedAt: '2026-10-09' } });
    expect(patch.statusCode).toBe(200);
    expect(completions).toEqual([{ title: 'Zerar FF7', listId: challengeListId, gamesCount: 1, completedAt: new Date('2026-10-09T00:00:00.000Z') }]);

    const timeline = await app.inject({ method: 'GET', url: '/stats/timeline' });
    expect(timeline.json().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CHALLENGE_COMPLETED', title: 'Zerar FF7', gamesCount: 1, date: '2026-10-09' }),
    ]));
  });

  it('returns next game suggestions and validates parameters', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository(), backlogRepository: createBacklogRepository() });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/backlog/suggestions?timezoneOffsetMinutes=180' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([{ game: { id: game.id }, reasons: expect.any(Array) }]);
    expect((await app.inject({ method: 'GET', url: '/backlog/suggestions?timezoneOffsetMinutes=abc' })).statusCode).toBe(400);
  });

  describe('session screenshots', () => {
    const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

    function setup() {
      const sessionRepository = createSessionRepository();
      const screenshotRepository = createScreenshotRepository(() => [{ id: '00000000-0000-4000-8000-000000000040', gameId: game.id }]);
      const saved: string[] = [];
      const removed: string[] = [];
      const imageStorage: GameImageStorage = {
        importImage: async () => '/media/unused.jpg',
        saveImage: async (bytes) => {
          if (bytes[0] !== 137) throw new Error('Downloaded file is not a supported image.');
          const url = `/media/00000000-0000-4000-8000-${String(600 + saved.length).padStart(12, '0')}.png`;
          saved.push(url);
          return url;
        },
        removeImage: async (url) => { removed.push(url); },
        openImage: async () => undefined,
      };
      const app = buildApp({ gameRepository: createRepository(), sessionRepository, screenshotRepository, imageStorage });
      apps.push(app);
      return { app, sessionRepository, screenshotRepository, saved, removed };
    }
    const base = `/games/${game.id}/sessions/00000000-0000-4000-8000-000000000040/screenshots`;

    it('uploads, lists and deletes screenshots, removing the stored file', async () => {
      const { app, sessionRepository, removed } = setup();
      await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
      const created = await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ url: '/media/00000000-0000-4000-8000-000000000600.png' });
      expect((await app.inject({ method: 'GET', url: base })).json()).toHaveLength(1);
      expect((await app.inject({ method: 'DELETE', url: `${base}/${created.json().id}` })).statusCode).toBe(204);
      expect(removed).toEqual(['/media/00000000-0000-4000-8000-000000000600.png']);
      expect((await app.inject({ method: 'GET', url: base })).json()).toEqual([]);
      expect((await app.inject({ method: 'DELETE', url: `${base}/${created.json().id}` })).statusCode).toBe(404);
    });

    it('rejects invalid files, unsupported content types, missing sessions and the per-session limit', async () => {
      const { app, sessionRepository, saved } = setup();
      expect((await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes })).statusCode).toBe(404);
      await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
      expect((await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: Buffer.from('not an image') })).statusCode).toBe(415);
      expect((await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'application/json' }, payload: { a: 1 } })).statusCode).toBe(415);
      expect((await app.inject({ method: 'GET', url: `/games/${game.id}/sessions/invalid/screenshots` })).statusCode).toBe(400);
      for (let index = 0; index < 10; index += 1) {
        expect((await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes })).statusCode).toBe(201);
      }
      expect((await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes })).statusCode).toBe(409);
      expect(saved).toHaveLength(10);
    });

    it('removes stored files when the session or the game is deleted', async () => {
      const { app, sessionRepository, removed } = setup();
      await sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
      await app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes });
      expect((await app.inject({ method: 'DELETE', url: `/games/${game.id}/sessions/00000000-0000-4000-8000-000000000040` })).statusCode).toBe(204);
      expect(removed).toEqual(['/media/00000000-0000-4000-8000-000000000600.png']);

      const second = setup();
      await second.sessionRepository.create(game.id, { startedAt: '2026-01-01T10:00:00.000Z' });
      await second.app.inject({ method: 'POST', url: base, headers: { 'content-type': 'image/png' }, payload: pngBytes });
      expect((await second.app.inject({ method: 'DELETE', url: `/games/${game.id}` })).statusCode).toBe(204);
      expect(second.removed).toEqual(['/media/00000000-0000-4000-8000-000000000600.png']);
    });
  });

  it('queues the eligible games of a list in title order and reports skipped ones', async () => {
    const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const records: GameRecord[] = [
      { ...game, id: id(11), title: 'Zelda' }, { ...game, id: id(12), title: 'Celeste' }, { ...game, id: id(13), title: 'Já na fila' },
      { ...game, id: id(14), title: 'Zerado', status: 'COMPLETED' }, { ...game, id: id(15), title: 'Sem posse', owned: false }, { ...game, id: id(16), title: 'Fora da lista' },
    ];
    const repository: GameRepository = { ...createRepository(), list: async () => records, find: async (gameId) => records.find((item) => item.id === gameId) };
    const backlog = createBacklogRepository();
    await backlog.addToQueue(id(13));
    const lists = createGameListRepository();
    const list = await lists.create('Curtos');
    list.gameIds.push(id(11), id(12), id(13), id(14), id(15));
    const app = buildApp({ gameRepository: repository, backlogRepository: backlog, gameListRepository: lists });
    apps.push(app);
    const response = await app.inject({ method: 'POST', url: '/queue/from-list', payload: { listId: list.id } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ added: 2, skipped: 3 });
    expect((await backlog.listQueue()).map((item) => item.game.id)).toEqual([id(13), id(12), id(11)]);
    expect((await app.inject({ method: 'POST', url: '/queue/from-list', payload: { listId: list.id } })).json()).toMatchObject({ added: 0, skipped: 5 });
    expect((await app.inject({ method: 'POST', url: '/queue/from-list', payload: { listId: id(999) } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/queue/from-list', payload: { listId: 'x' } })).statusCode).toBe(400);
  });

  it('creates, updates and removes goals with calculated progress', async () => {
    const app = buildApp({ gameRepository: createRepository(), sessionRepository: createSessionRepository(), goalRepository: createGoalRepository() });
    apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, target: 12 } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: null, target: 12, current: 0, percent: 0 });
    const goalId = created.json().id as string;
    const monthly = await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'PLAYED_HOURS', period: 'MONTH', year: 2026, month: 3, target: 40 } });
    expect(monthly.json()).toMatchObject({ month: 3, target: 40 });
    expect((await app.inject({ method: 'GET', url: '/goals?timezoneOffsetMinutes=180' })).json()).toHaveLength(2);

    expect((await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, target: 5 } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'COMPLETED_GAMES', period: 'MONTH', year: 2026, target: 5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, month: 2, target: 5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/goals', payload: { kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2027, target: 0 } })).statusCode).toBe(400);

    const updated = await app.inject({ method: 'PATCH', url: `/goals/${goalId}`, payload: { target: 20 } });
    expect(updated.json()).toMatchObject({ id: goalId, target: 20 });
    expect((await app.inject({ method: 'PATCH', url: '/goals/00000000-0000-4000-8000-000000000001', payload: { target: 20 } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: '/goals/invalid', payload: { target: 20 } })).statusCode).toBe(400);

    expect((await app.inject({ method: 'DELETE', url: `/goals/${goalId}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/goals/${goalId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/goals' })).json()).toHaveLength(1);
  });

  it('sets, reads and clears the main challenge from a list', async () => {
    let stored: { title: string; listId: string } | undefined;
    const lists = createGameListRepository();
    const list = await lists.create('Clássicos');
    await lists.addGame(list.id, game.id);
    const app = buildApp({
      gameRepository: createRepository(), gameListRepository: lists,
      mainChallengeRepository: { get: async () => stored, set: async (input) => { stored = input; }, clear: async () => { stored = undefined; } },
    });
    apps.push(app);
    expect((await app.inject({ method: 'GET', url: '/challenge' })).json()).toBeNull();
    expect((await app.inject({ method: 'PUT', url: '/challenge', payload: { title: 'Zerar tudo', listId: '00000000-0000-4000-8000-000000000099' } })).statusCode).toBe(404);
    const put = await app.inject({ method: 'PUT', url: '/challenge', payload: { title: 'Zerar tudo', listId: list.id } });
    expect(put.json()).toMatchObject({ title: 'Zerar tudo', totalGames: 1, completedGames: 0, percent: 0, listName: 'Clássicos' });
    expect((await app.inject({ method: 'DELETE', url: '/challenge' })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/challenge' })).json()).toBeNull();
  });
});
