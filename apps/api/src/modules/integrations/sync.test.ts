import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GamePlatformInput, GamePlatformUpdate, Platform } from '@gameshelf/contracts';
import { buildApp } from '../../app.js';
import type { GameRecord, GameRepository } from '../games/repository.js';
import type { ExternalProvenance, GamePlatformRecord, GamePlatformRepository } from '../game-platforms/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { PlaythroughRecord, PlaythroughRepository } from '../playthroughs/repository.js';
import type { SessionRecord, SessionRepository } from '../sessions/repository.js';
import type { ExternalLibraryEntry, ExternalLibraryProvider } from './external-library.js';
import type {
  ExternalMatchQueueRepository, ExternalMatchRecord, ExternalMatchSnapshot,
} from './match-queue-repository.js';
import { ExternalSyncRunner } from './sync-runner.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HADES = id(1);
const OTHER_HADES = id(2);
const STEAM = id(10);
const PS5 = id(11);
const now = new Date('2026-06-01T12:00:00.000Z');

function gameRecord(gameId: string, title: string): GameRecord {
  return {
    id: gameId, title, description: null, coverUrl: null, backgroundUrl: null, releaseYear: 2020,
    developer: null, publisher: null, franchiseId: null, platformId: null, platformIds: [], genreIds: [],
    status: 'PLAYING', archived: false, priority: 'NORMAL', rating: 7, difficulty: null, gameType: null,
    completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: true,
    startedAt: '2026-01-10', completedAt: null, estimatedMainHours: null, estimatedCompletionistHours: null,
    personalEstimatedHours: null, retroactivePlayedHours: 3, notes: 'anotação do usuário', createdAt: now, updatedAt: now,
  };
}

function gameRepository(titles: Array<[string, string]> = [[HADES, 'Hades']]): GameRepository & { rows: GameRecord[] } {
  const games = titles.map(([gameId, title]) => gameRecord(gameId, title));
  return {
    rows: games,
    list: async () => games,
    find: async (gameId) => games.find((item) => item.id === gameId),
    create: async (input) => {
      const created = { ...gameRecord(id(700 + games.length), input.title), ...input, genreIds: [], platformIds: [] };
      games.push(created);
      return created;
    },
    update: async (gameId, input) => {
      const game = games.find((item) => item.id === gameId);
      return game ? Object.assign(game, input) : undefined;
    },
    delete: async () => true,
  };
}

function platformRepository(initial: Platform[] = [{ id: STEAM, name: 'Steam', parentId: null }, { id: PS5, name: 'PlayStation 5', parentId: null }]): PlatformRepository & { created: string[] } {
  const platforms = [...initial];
  const created: string[] = [];
  return {
    created,
    list: async () => platforms,
    setParent: async (id, parentId) => {
      const platform = platforms.find((item) => item.id === id);
      return platform ? Object.assign(platform, { parentId }) : undefined;
    },
    create: async (name) => {
      const platform = { id: id(90 + platforms.length), name, parentId: null };
      platforms.push(platform);
      created.push(name);
      return platform;
    },
  };
}

function gamePlatformRepository(): GamePlatformRepository {
  const rows: GamePlatformRecord[] = [];
  let seq = 100;
  const blank = (gameId: string, platformId: string): GamePlatformRecord => ({
    id: id(seq += 1), gameId, platformId, edition: null, format: null, owned: false, isPrimary: false,
    externalSource: null, externalId: null, externalAccountLabel: null, externalPlaytimeMinutes: null,
    externalLastPlayedAt: null, externalSyncedAt: null, externalPlaytimeImportedMinutes: 0, countsTowardTotal: false, notes: null, createdAt: now, updatedAt: now,
  });
  const external = (external_: ExternalProvenance) => ({
    externalSource: external_.source, externalId: external_.externalId, externalAccountLabel: external_.accountLabel,
    externalPlaytimeMinutes: external_.playtimeMinutes, externalLastPlayedAt: external_.lastPlayedAt,
    externalSyncedAt: external_.syncedAt,
  });
  return {
    listAll: async () => rows,
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId),
    find: async (gameId, rowId) => rows.find((row) => row.gameId === gameId && row.id === rowId),
    create: async (gameId, input: GamePlatformInput) => {
      const row = {
        ...blank(gameId, input.platformId), edition: input.edition?.trim() ?? null, format: input.format ?? null,
        owned: input.owned ?? false, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() ?? null,
      };
      rows.push(row);
      return row;
    },
    update: async (gameId, rowId, input: GamePlatformUpdate) => {
      const row = rows.find((item) => item.gameId === gameId && item.id === rowId);
      if (row) Object.assign(row, input);
      return row;
    },
    delete: async (gameId, rowId) => {
      const index = rows.findIndex((item) => item.gameId === gameId && item.id === rowId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    listByExternalSource: async (source) => rows.filter((row) => row.externalSource === source),
    attachExternal: async (gameId, platformId, provenance) => {
      const existing = rows.find((row) => row.gameId === gameId && row.platformId === platformId && row.edition === null);
      if (existing) return Object.assign(existing, external(provenance), { updatedAt: new Date() });
      const row = { ...blank(gameId, platformId), owned: true, ...external(provenance) };
      rows.push(row);
      return row;
    },
    updateExternalSnapshot: async (rowId, provenance) => {
      const row = rows.find((item) => item.id === rowId);
      return row ? Object.assign(row, external(provenance), { updatedAt: new Date() }) : undefined;
    },
    markPlaytimeImported: async (rowId, importedMinutes) => {
      const row = rows.find((item) => item.id === rowId);
      return row ? Object.assign(row, { externalPlaytimeImportedMinutes: importedMinutes }) : undefined;
    },
  };
}

function queueRepository(): ExternalMatchQueueRepository & { rows: ExternalMatchRecord[] } {
  const rows: ExternalMatchRecord[] = [];
  let seq = 300;
  return {
    rows,
    // Mesma ordenação do repositório real, por título.
    listForSource: async (source) => rows.filter((row) => row.source === source).sort((a, b) => a.title.localeCompare(b.title)),
    find: async (rowId) => rows.find((row) => row.id === rowId),
    upsert: async (snapshot: ExternalMatchSnapshot, seenAt) => {
      const existing = rows.find((row) => row.source === snapshot.source && row.externalId === snapshot.externalId);
      // Como no banco: o status não entra no update, então "ignorada" resiste a
      // qualquer sincronização seguinte.
      if (existing) return Object.assign(existing, snapshot, { lastSeenAt: seenAt });
      const row: ExternalMatchRecord = { id: id(seq += 1), ...snapshot, status: 'PENDING', firstSeenAt: seenAt, lastSeenAt: seenAt };
      rows.push(row);
      return row;
    },
    ignore: async (rowId) => {
      const row = rows.find((item) => item.id === rowId);
      if (row) row.status = 'IGNORED';
      return row;
    },
    delete: async (rowId) => {
      const index = rows.findIndex((item) => item.id === rowId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    deleteByExternalId: async (source, externalId) => {
      const index = rows.findIndex((item) => item.source === source && item.externalId === externalId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}

function sessionRepository(): SessionRepository & { rows: SessionRecord[] } {
  const rows: SessionRecord[] = [];
  let seq = 400;
  return {
    rows,
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId),
    listAll: async () => rows,
    detachPlaythrough: async () => 0,
    findForGame: async (gameId, sessionId) => rows.find((row) => row.gameId === gameId && row.id === sessionId),
    create: async (gameId, input) => {
      const row: SessionRecord = {
        id: id(seq += 1), gameId, playthroughId: input.playthroughId ?? null, platformId: input.platformId ?? null,
        startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
        progress: input.progress ?? null, location: input.location ?? null, notes: input.notes ?? null,
        keyDecisions: input.keyDecisions ?? null, tips: input.tips ?? null, createdAt: now, updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    update: async () => undefined,
    delete: async () => false,
  };
}

function playthroughRepository(): PlaythroughRepository & { rows: PlaythroughRecord[] } {
  const rows: PlaythroughRecord[] = [];
  return {
    rows,
    listAll: async () => rows,
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId),
    find: async (gameId, rowId) => rows.find((row) => row.gameId === gameId && row.id === rowId),
    create: async () => { throw new Error('a sincronização não pode criar jornadas'); },
    update: async () => undefined,
    delete: async () => false,
  };
}

const entry = (overrides: Partial<ExternalLibraryEntry> = {}): ExternalLibraryEntry => ({
  externalId: '501', title: 'Hades', platformName: 'Steam', accountLabel: 'fulano',
  playtimeMinutes: 1_200, lastPlayedAt: new Date('2026-05-20T22:00:00.000Z'), ...overrides,
});

function provider(entries: ExternalLibraryEntry[]): ExternalLibraryProvider {
  return { source: 'achievist', fetchLibrary: async () => entries };
}

function setup(options: {
  entries?: ExternalLibraryEntry[];
  provider?: ExternalLibraryProvider;
  games?: Array<[string, string]>;
  platforms?: Platform[];
  enabled?: boolean;
} = {}) {
  const deps = {
    provider: options.provider ?? provider(options.entries ?? [entry()]),
    games: gameRepository(options.games),
    platforms: platformRepository(options.platforms),
    gamePlatforms: gamePlatformRepository(),
    queue: queueRepository(),
  };
  const sessions = sessionRepository();
  const playthroughs = playthroughRepository();
  const runner = new ExternalSyncRunner(deps, () => now);
  const app = buildApp({
    gameRepository: deps.games, platformRepository: deps.platforms, gamePlatformRepository: deps.gamePlatforms,
    playthroughRepository: playthroughs, sessionRepository: sessions,
    ...(options.enabled === false ? {} : { externalLibraryProvider: deps.provider, externalSyncRunner: runner }),
    externalMatchQueueRepository: deps.queue,
  });
  return { app, runner, sessions, playthroughs, ...deps };
}

async function sync(context: Awaited<ReturnType<typeof setup>>) {
  const response = await context.app.inject({ method: 'POST', url: '/integrations/achievist/sync' });
  await context.runner.settled();
  return response;
}

const apps: Array<{ close: () => Promise<unknown> }> = [];
const track = <T extends { app: { close: () => Promise<unknown> } }>(context: T) => { apps.push(context.app); return context; };
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe('sincronização com a fonte externa', () => {
  it('não cria sessões nem jornadas, e grava o tempo externo separado do local', async () => {
    const context = track(setup());
    // Vínculo já confirmado antes da rodada.
    await context.gamePlatforms.attachExternal(HADES, STEAM, {
      source: 'achievist', externalId: '501', accountLabel: null, playtimeMinutes: null, lastPlayedAt: null, syncedAt: now,
    });

    const response = await sync(context);
    const state = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });

    expect(response.statusCode).toBe(202);
    expect(state.json()).toMatchObject({
      status: 'succeeded',
      summary: { fetched: 1, updated: 1, pending: 0, ignored: 0, sessionsCreated: 0, playthroughsCreated: 0 },
    });
    expect(context.sessions.rows).toHaveLength(0);
    expect(context.playthroughs.rows).toHaveLength(0);
    const [association] = await context.gamePlatforms.listForGame(HADES);
    expect(association).toMatchObject({ externalPlaytimeMinutes: 1_200, externalSyncedAt: now });
    // O jogo canônico não é tocado: horas locais, nota e anotação ficam como estavam.
    expect(await context.games.find(HADES)).toMatchObject({ retroactivePlayedHours: 3, rating: 7, notes: 'anotação do usuário' });
  });

  it('sincronizar duas vezes não duplica nada nem altera o que o usuário declarou', async () => {
    const context = track(setup({ entries: [entry(), entry({ externalId: '502', title: 'Celeste', platformName: 'Steam' })] }));
    const association = await context.gamePlatforms.attachExternal(HADES, STEAM, {
      source: 'achievist', externalId: '501', accountLabel: null, playtimeMinutes: null, lastPlayedAt: null, syncedAt: now,
    });
    await context.gamePlatforms.update(HADES, association.id, { format: 'DIGITAL', isPrimary: true, notes: 'comprado na promoção' });

    await sync(context);
    const first = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' });
    await sync(context);
    const second = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' });

    expect(first.json()).toHaveLength(1);
    expect(second.json()).toEqual(first.json());
    expect(await context.gamePlatforms.listAll()).toHaveLength(1);
    expect(context.queue.rows).toHaveLength(1);
    expect(await context.gamePlatforms.listForGame(HADES)).toMatchObject([{
      format: 'DIGITAL', isPrimary: true, notes: 'comprado na promoção', owned: true, externalPlaytimeMinutes: 1_200,
    }]);
  });

  it('encontrar o mesmo jogo em outra plataforma não cria replay nem jornada', async () => {
    const context = track(setup({ entries: [entry(), entry({ externalId: '777', platformName: 'PlayStation 5' })] }));
    await context.gamePlatforms.attachExternal(HADES, STEAM, {
      source: 'achievist', externalId: '501', accountLabel: null, playtimeMinutes: null, lastPlayedAt: null, syncedAt: now,
    });
    await context.gamePlatforms.attachExternal(HADES, PS5, {
      source: 'achievist', externalId: '777', accountLabel: null, playtimeMinutes: null, lastPlayedAt: null, syncedAt: now,
    });

    await sync(context);

    expect(await context.gamePlatforms.listForGame(HADES)).toHaveLength(2);
    expect(context.playthroughs.rows).toHaveLength(0);
    const metrics = await context.app.inject({ method: 'GET', url: `/games/${HADES}/playthroughs/metrics` });
    expect(metrics.json()).toMatchObject({ total: 0, started: 0, replaysStarted: 0 });
  });

  it('não vincula por título: a sugestão fica pendente e a ambiguidade não se resolve sozinha', async () => {
    const context = track(setup({
      entries: [entry(), entry({ externalId: '601', title: 'Celeste' })],
      games: [[HADES, 'Hades'], [OTHER_HADES, 'HADES!'], [id(3), 'Celeste']],
    }));

    await sync(context);
    const pending = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' });

    const [celeste, hades] = pending.json() as Array<Record<string, unknown>>;
    expect(hades).toMatchObject({ title: 'Hades', ambiguous: true });
    expect(hades.suggestions).toHaveLength(2);
    expect(celeste).toMatchObject({ title: 'Celeste', ambiguous: false, suggestions: [{ gameId: id(3), title: 'Celeste' }] });
    // Nada foi vinculado: sugerir não é aplicar.
    expect(await context.gamePlatforms.listAll()).toHaveLength(0);
  });

  it('confirma uma pendência criando a associação, a plataforma do catálogo e nada mais', async () => {
    const context = track(setup({ entries: [entry({ platformName: 'Nintendo Switch' })], platforms: [] }));
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const response = await context.app.inject({
      method: 'POST', url: `/integrations/achievist/pending/${pending.id}/confirm`, payload: { gameId: HADES },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      gameId: HADES, externalSource: 'achievist', externalId: '501', externalPlaytimeMinutes: 1_200,
      externalAccountLabel: 'fulano', owned: true, isPrimary: false, edition: null,
    });
    expect(context.platforms.created).toEqual(['Nintendo Switch']);
    expect(context.queue.rows).toHaveLength(0);
    expect(context.sessions.rows).toHaveLength(0);
    expect(context.playthroughs.rows).toHaveLength(0);
  });

  it('depois de confirmada, a entrada vira atualização de tempo e não volta para a fila', async () => {
    const context = track(setup());
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);
    await context.app.inject({ method: 'POST', url: `/integrations/achievist/pending/${pending.id}/confirm`, payload: { gameId: HADES, platformId: STEAM } });

    await sync(context);
    const state = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });

    expect(state.json()).toMatchObject({ summary: { updated: 1, pending: 0 } });
    expect(await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json())).toEqual([]);
    expect(await context.gamePlatforms.listAll()).toHaveLength(1);
  });

  it('recusa confirmar quando a plataforma do jogo já aponta para outra entrada externa', async () => {
    const context = track(setup({ entries: [entry({ externalId: '888' })] }));
    await context.gamePlatforms.attachExternal(HADES, STEAM, {
      source: 'achievist', externalId: '501', accountLabel: null, playtimeMinutes: null, lastPlayedAt: null, syncedAt: now,
    });
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const response = await context.app.inject({
      method: 'POST', url: `/integrations/achievist/pending/${pending.id}/confirm`, payload: { gameId: HADES, platformId: STEAM },
    });

    expect(response.statusCode).toBe(409);
    expect(await context.gamePlatforms.listForGame(HADES)).toMatchObject([{ externalId: '501' }]);
  });

  it('uma pendência ignorada não volta a ser proposta', async () => {
    const context = track(setup());
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const ignored = await context.app.inject({ method: 'POST', url: `/integrations/achievist/pending/${pending.id}/ignore` });
    await sync(context);
    const state = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });

    expect(ignored.statusCode).toBe(204);
    expect(state.json()).toMatchObject({ summary: { pending: 0, ignored: 1 } });
    expect(await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json())).toEqual([]);
  });

  it('a fonte indisponível não impede a biblioteca nem o registro manual de sessões', async () => {
    const unavailable: ExternalLibraryProvider = {
      source: 'achievist',
      fetchLibrary: () => Promise.reject(new Error('O Achievist respondeu HTTP 502 em /api/games.')),
    };
    const context = track(setup({ provider: unavailable }));

    const triggered = await sync(context);
    const state = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });
    const library = await context.app.inject({ method: 'GET', url: '/games' });
    const session = await context.app.inject({
      method: 'POST', url: `/games/${HADES}/sessions`,
      payload: { startedAt: '2026-06-01T20:00:00.000Z', endedAt: '2026-06-01T21:30:00.000Z' },
    });

    expect(triggered.statusCode).toBe(202);
    expect(state.json()).toMatchObject({ status: 'failed', error: 'O Achievist respondeu HTTP 502 em /api/games.' });
    expect(library.statusCode).toBe(200);
    expect(library.json()).toHaveLength(1);
    expect(session.statusCode).toBe(201);
    expect(session.json()).toMatchObject({ durationMinutes: 90 });
    expect(context.queue.rows).toHaveLength(0);
  });

  it('recusa uma segunda rodada enquanto a primeira não termina', async () => {
    let release = () => {};
    const slow: ExternalLibraryProvider = {
      source: 'achievist',
      fetchLibrary: () => new Promise((resolve) => { release = () => resolve([]); }),
    };
    const context = track(setup({ provider: slow }));

    const first = await context.app.inject({ method: 'POST', url: '/integrations/achievist/sync' });
    const second = await context.app.inject({ method: 'POST', url: '/integrations/achievist/sync' });
    const running = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });
    release();
    await context.runner.settled();

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(409);
    expect(running.json()).toMatchObject({ status: 'running' });
  });

  it('sem credenciais a integração se declara desligada e o resto da API segue normal', async () => {
    const context = track(setup({ enabled: false }));

    const state = await context.app.inject({ method: 'GET', url: '/integrations/achievist/sync' });
    const triggered = await context.app.inject({ method: 'POST', url: '/integrations/achievist/sync' });
    const pending = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' });
    const library = await context.app.inject({ method: 'GET', url: '/games' });

    expect(state.json()).toMatchObject({ status: 'disabled', summary: null });
    expect(triggered.statusCode).toBe(503);
    expect(pending.statusCode).toBe(503);
    expect(library.statusCode).toBe(200);
  });

  it('cadastra o jogo que falta direto da fila e já vincula a entrada', async () => {
    const context = track(setup({ entries: [entry({ title: 'Celeste', platformName: 'Steam' })] }));
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const response = await context.app.inject({
      method: 'POST', url: `/integrations/achievist/pending/${pending.id}/create-game`,
      payload: { game: { title: 'Celeste', status: 'BACKLOG', owned: true } },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { game: { id: string; title: string; status: string }; platform: { gameId: string; externalId: string } };
    expect(body.game).toMatchObject({ title: 'Celeste', status: 'BACKLOG' });
    expect(body.platform).toMatchObject({ gameId: body.game.id, externalSource: 'achievist', externalId: '501' });
    // A pendência sai da fila e nada de histórico é inventado para o jogo novo.
    expect(context.queue.rows).toHaveLength(0);
    expect(context.sessions.rows).toHaveLength(0);
    expect(context.playthroughs.rows).toHaveLength(0);
  });

  it('o título do formulário prevalece sobre o que a fonte sugeriu', async () => {
    const context = track(setup({ entries: [entry({ title: 'CELESTE (Steam)' })] }));
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const response = await context.app.inject({
      method: 'POST', url: `/integrations/achievist/pending/${pending.id}/create-game`,
      payload: { game: { title: 'Celeste', status: 'DESIRED', owned: false } },
    });

    expect((response.json() as { game: { title: string; owned: boolean } }).game).toMatchObject({ title: 'Celeste', owned: false });
  });

  it('recusa cadastrar um jogo sem título válido', async () => {
    const context = track(setup({ entries: [entry({})] }));
    await sync(context);
    const [pending] = await context.app.inject({ method: 'GET', url: '/integrations/achievist/pending' }).then((r) => r.json() as Array<{ id: string }>);

    const response = await context.app.inject({
      method: 'POST', url: `/integrations/achievist/pending/${pending.id}/create-game`,
      payload: { game: { title: '   ' } },
    });

    expect(response.statusCode).toBe(400);
    expect(context.queue.rows).toHaveLength(1);
  });

  it('não confirma uma pendência inexistente nem com um id inválido', async () => {
    const context = track(setup());

    const invalid = await context.app.inject({ method: 'POST', url: '/integrations/achievist/pending/abc/confirm', payload: { gameId: HADES } });
    const missing = await context.app.inject({ method: 'POST', url: `/integrations/achievist/pending/${id(999)}/confirm`, payload: { gameId: HADES } });

    expect(invalid.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
  });
});

describe('ExternalSyncRunner', () => {
  it('começa em idle e guarda o resultado da última rodada', async () => {
    const context = setup();
    expect(context.runner.snapshot()).toMatchObject({ source: 'achievist', status: 'idle', summary: null, error: null });
    expect(context.runner.start()).toBe(true);
    expect(context.runner.isRunning()).toBe(true);
    await context.runner.settled();
    expect(context.runner.snapshot()).toMatchObject({ status: 'succeeded', startedAt: now.toISOString(), finishedAt: now.toISOString() });
    await context.app.close();
  });

  it('não propaga a falha da fonte para quem disparou', async () => {
    const context = setup({ provider: { source: 'achievist', fetchLibrary: () => Promise.reject(new Error('fetch failed')) } });
    context.runner.start();
    await expect(context.runner.settled()).resolves.toBeUndefined();
    expect(context.runner.snapshot()).toMatchObject({ status: 'failed', error: 'fetch failed' });
    await context.app.close();
  });
});

afterEach(() => { vi.restoreAllMocks(); });
