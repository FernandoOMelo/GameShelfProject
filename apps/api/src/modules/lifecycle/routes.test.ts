import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { GameRecord, GameRepository } from '../games/repository.js';
import type { PlaythroughRecord, PlaythroughRepository } from '../playthroughs/repository.js';
import type { SessionRecord, SessionRepository } from '../sessions/repository.js';
import { registerLifecycleRoutes } from './routes.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GAME = id(1);
const PC = id(10);
const now = new Date('2026-05-01T12:00:00.000Z');

function setup(overrides: Partial<GameRecord> = {}) {
  const game: GameRecord = {
    id: GAME, title: 'Hades', description: null, coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null,
    franchiseId: null, platformId: PC, platformIds: [PC], genreIds: [], status: 'BACKLOG', archived: false, priority: 'NORMAL', rating: null,
    difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: true,
    startedAt: null, completedAt: null, estimatedMainHours: null, estimatedCompletionistHours: null, personalEstimatedHours: null,
    retroactivePlayedHours: 0, notes: null, createdAt: now, updatedAt: now, ...overrides,
  };
  const games: GameRepository = {
    list: async () => [game], find: async (gameId) => gameId === GAME ? game : undefined,
    create: async () => game, update: async (_gameId, input) => Object.assign(game, input), delete: async () => true,
  };
  const journeys: PlaythroughRecord[] = [];
  const sessionRows: SessionRecord[] = [];
  const playthroughs: PlaythroughRepository = {
    listAll: async () => journeys,
    listForGame: async (gameId) => journeys.filter((row) => row.gameId === gameId).sort((a, b) => a.sequence - b.sequence),
    find: async (gameId, rowId) => journeys.find((row) => row.gameId === gameId && row.id === rowId),
    create: async (gameId, input) => {
      const row: PlaythroughRecord = {
        id: id(200 + journeys.length), gameId, sequence: journeys.filter((item) => item.gameId === gameId).length + 1, label: null,
        status: input.status ?? 'PLANNED', primaryPlatformId: input.primaryPlatformId ?? null, startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null, notes: null, createdAt: now, updatedAt: now,
      };
      journeys.push(row);
      return row;
    },
    update: async (_gameId, rowId, input) => {
      const row = journeys.find((item) => item.id === rowId);
      return row ? Object.assign(row, input) : undefined;
    },
    delete: async (_gameId, rowId) => {
      const index = journeys.findIndex((item) => item.id === rowId);
      if (index < 0) return false;
      journeys.splice(index, 1);
      return true;
    },
  };
  const sessions: SessionRepository = {
    listForGame: async (gameId) => sessionRows.filter((row) => row.gameId === gameId),
    listAll: async () => sessionRows,
    findForGame: async (gameId, rowId) => sessionRows.find((row) => row.gameId === gameId && row.id === rowId),
    create: async () => { throw new Error('não usado'); },
    update: async (_gameId, rowId, input) => {
      const row = sessionRows.find((item) => item.id === rowId);
      if (!row) return undefined;
      Object.assign(row, {
        startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
        playthroughId: input.playthroughId ?? null, platformId: input.platformId ?? null,
      });
      return row;
    },
    delete: async () => true,
    detachPlaythrough: async (journeyId) => {
      const affected = sessionRows.filter((row) => row.playthroughId === journeyId);
      for (const row of affected) row.playthroughId = null;
      return affected.length;
    },
  };
  const addSession = (startedAt: string, endedAt: string | null, extra: Partial<SessionRecord> = {}) => {
    const row: SessionRecord = {
      id: id(300 + sessionRows.length), gameId: GAME, playthroughId: null, platformId: null, startedAt: new Date(startedAt),
      endedAt: endedAt ? new Date(endedAt) : null, progress: null, location: null, notes: null, keyDecisions: null, tips: null,
      createdAt: now, updatedAt: now, ...extra,
    };
    sessionRows.push(row);
    return row;
  };
  const app = Fastify();
  void app.register((instance) => registerLifecycleRoutes(instance, { games, sessions, playthroughs }));
  return { app, game, journeys, addSession };
}

const apps: Array<{ close: () => Promise<unknown> }> = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe('GET /games/:id/lifecycle', () => {
  it('oferece a primeira jornada e traz onde o jogador parou', async () => {
    const { app, addSession } = setup();
    apps.push(app);
    addSession('2026-04-01T20:00:00.000Z', '2026-04-01T21:00:00.000Z', { location: 'Tártaro', progress: 30 });
    const response = await app.inject({ method: 'GET', url: `/games/${GAME}/lifecycle?timezoneOffsetMinutes=180` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      start: { mode: 'OFFER_FIRST', nextSequence: 1, suggestedPlatformId: PC, gameStatusAfter: 'PLAYING', lastSession: { location: 'Tártaro', progress: 30 } },
      finish: { journeyId: null, hasOpenSession: false },
    });
  });
});

describe('POST /games/:id/start-playing', () => {
  it('cria a jornada, preenche o início do jogo e vincula a sessão', async () => {
    const { app, game, journeys, addSession } = setup();
    apps.push(app);
    const session = addSession('2026-05-01T01:30:00.000Z', null);
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/start-playing`, payload: { startedAt: session.startedAt.toISOString(), sessionId: session.id, timezoneOffsetMinutes: 180 } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mode: 'OFFER_FIRST', playthrough: { status: 'PLAYING', startedAt: '2026-04-30', primaryPlatformId: PC }, game: { status: 'PLAYING', startedAt: '2026-04-30' } });
    expect(journeys).toHaveLength(1);
    expect(session.playthroughId).toBe(journeys[0]!.id);
    expect(game.status).toBe('PLAYING');
  });

  it('não reescreve o início do jogo, não muda Desejado e só vincula a jornada ativa', async () => {
    const { app, game, journeys } = setup({ status: 'DESIRED', startedAt: '2025-01-01' });
    apps.push(app);
    journeys.push({ id: id(250), gameId: GAME, sequence: 1, label: null, status: 'PLAYING', primaryPlatformId: null, startedAt: '2025-01-01', completedAt: null, notes: null, createdAt: now, updatedAt: now });
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/start-playing`, payload: {} });
    expect(response.json()).toMatchObject({ mode: 'LINK_ACTIVE', playthrough: { id: id(250) }, game: { status: 'DESIRED', startedAt: '2025-01-01' } });
    expect(journeys).toHaveLength(1);
    expect(game.status).toBe('DESIRED');
  });

  it('cria um replay quando o jogo já foi zerado sem mudar a ficha', async () => {
    const { app, journeys } = setup({ status: 'COMPLETED', startedAt: '2024-01-01', completedAt: '2024-02-01' });
    apps.push(app);
    journeys.push({ id: id(250), gameId: GAME, sequence: 1, label: null, status: 'COMPLETED', primaryPlatformId: null, startedAt: '2024-01-01', completedAt: '2024-02-01', notes: null, createdAt: now, updatedAt: now });
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/start-playing`, payload: {} });
    expect(response.json()).toMatchObject({ mode: 'OFFER_REPLAY', playthrough: { sequence: 2, status: 'PLAYING' }, game: { status: 'COMPLETED' } });
  });
});

describe('POST /games/:id/finish', () => {
  it('conclui a jornada ativa, encerra a sessão aberta e permite desfazer', async () => {
    const { app, game, journeys, addSession } = setup({ status: 'PLAYING', startedAt: '2026-04-01' });
    apps.push(app);
    journeys.push({ id: id(250), gameId: GAME, sequence: 1, label: null, status: 'PLAYING', primaryPlatformId: null, startedAt: '2026-04-01', completedAt: null, notes: null, createdAt: now, updatedAt: now });
    const open = addSession('2026-04-20T10:00:00.000Z', null);
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/finish`, payload: { completedAt: '2026-04-30', rating: 10, difficulty: 'A' } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ game: { status: 'COMPLETED', completedAt: '2026-04-30', rating: 10, difficulty: 'A' }, playthrough: { status: 'COMPLETED', completedAt: '2026-04-30' }, closedSessionIds: [open.id] });
    expect(open.endedAt).not.toBeNull();
    expect(body.undo).toMatchObject({ status: 'PLAYING', completedAt: null, journey: { action: 'REOPEN', id: id(250) } });

    const undone = await app.inject({ method: 'POST', url: `/games/${GAME}/finish/undo`, payload: body.undo });
    expect(undone.statusCode).toBe(200);
    expect(game).toMatchObject({ status: 'PLAYING', completedAt: null });
    expect(journeys[0]).toMatchObject({ status: 'PLAYING', completedAt: null });
  });

  it('cria uma jornada já concluída quando o jogo não tem nenhuma e a remove ao desfazer', async () => {
    const { app, journeys } = setup({ status: 'PLAYING', startedAt: '2026-04-01' });
    apps.push(app);
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/finish`, payload: { completedAt: '2026-04-30' } });
    expect(response.json()).toMatchObject({ playthrough: { status: 'COMPLETED', startedAt: '2026-04-01', completedAt: '2026-04-30' } });
    expect(journeys).toHaveLength(1);
    await app.inject({ method: 'POST', url: `/games/${GAME}/finish/undo`, payload: response.json().undo });
    expect(journeys).toHaveLength(0);
  });

  it('recusa data anterior ao início e jogo desejado', async () => {
    const { app } = setup({ status: 'PLAYING', startedAt: '2026-04-10' });
    apps.push(app);
    expect((await app.inject({ method: 'POST', url: `/games/${GAME}/finish`, payload: { completedAt: '2026-04-01' } })).statusCode).toBe(409);
    const desired = setup({ status: 'DESIRED' });
    apps.push(desired.app);
    expect((await desired.app.inject({ method: 'POST', url: `/games/${GAME}/finish`, payload: {} })).statusCode).toBe(409);
  });
});
