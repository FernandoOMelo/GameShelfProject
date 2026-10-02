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

const now = new Date('2026-01-01T00:00:00.000Z');
const game: GameRecord = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
  coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: 'Supergiant Games',
  publisher: null, franchiseId: null, status: 'BACKLOG', priority: 'NORMAL', estimatedMainHours: null,
  estimatedCompletionistHours: null, personalEstimatedHours: null, notes: null, platformIds: [], genreIds: [],
  createdAt: now, updatedAt: now,
};

function createRepository(): GameRepository {
  const games = [game];
  return {
    list: async () => games,
    find: async (id) => games.find((item) => item.id === id),
    create: async (input: GameInput) => ({ ...game, ...input, id: '00000000-0000-4000-8000-000000000002' }),
    update: async (id, input: GameUpdate) => {
      const existing = games.find((item) => item.id === id);
      return existing ? { ...existing, ...input, updatedAt: new Date() } : undefined;
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
    list: async () => [{ id: '00000000-0000-4000-8000-000000000020', name: 'PC' }],
    create: async (name) => ({ id: '00000000-0000-4000-8000-000000000021', name }),
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
    findForGame: async (gameId, sessionId) => sessions.find((session) => session.gameId === gameId && session.id === sessionId),
    create: async (gameId, input) => {
      const createdAt = new Date();
      const session: SessionRecord = {
        id: '00000000-0000-4000-8000-000000000040', gameId,
        startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
        progress: input.progress ?? null, location: input.location ?? null, notes: input.notes ?? null,
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

  it('accepts multiple platform and genre associations', async () => {
    const app = buildApp({ gameRepository: createRepository() });
    apps.push(app);
    const platformId = '00000000-0000-4000-8000-000000000020';
    const genreId = '00000000-0000-4000-8000-000000000030';
    const response = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Hades', platformIds: [platformId], genreIds: [genreId] } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ platformIds: [platformId], genreIds: [genreId] });
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

  it('saves a weekly goal and returns a dashboard summary', async () => {
    const app = buildApp({
      gameRepository: createRepository(), sessionRepository: createSessionRepository(),
      backlogRepository: createBacklogRepository(), planningSettingsRepository: createPlanningSettingsRepository(),
    });
    apps.push(app);
    const invalid = await app.inject({ method: 'PUT', url: '/planning/settings', payload: { weeklyMinutes: -30 } });
    const saved = await app.inject({ method: 'PUT', url: '/planning/settings', payload: { weeklyMinutes: 360 } });
    const dashboard = await app.inject('/dashboard');
    expect(invalid.statusCode).toBe(400);
    expect(saved.json()).toEqual({ weeklyMinutes: 360 });
    expect(dashboard.json()).toMatchObject({ gameCount: 1, weeklyHours: 6, queueRemainingHours: 0, estimatedQueueWeeks: 0 });
  });
});
