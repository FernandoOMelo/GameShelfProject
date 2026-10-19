import { afterEach, describe, expect, it } from 'vitest';
import type { GameInput, GamePlatformInput, GamePlatformUpdate, PlaythroughInput, PlaythroughUpdate, SessionInput } from '@gameshelf/contracts';
import { buildApp } from '../../app.js';
import type { GameRecord, GameRepository } from '../games/repository.js';
import type { GamePlatformRecord, GamePlatformRepository } from '../game-platforms/repository.js';
import type { PlaythroughRecord, PlaythroughRepository } from './repository.js';
import type { SessionRecord, SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import { nextSequence } from './service.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GAME = id(1);
const PC = id(10);
const PS5 = id(11);
const now = new Date('2026-05-01T12:00:00.000Z');

function gameRepository(): GameRepository {
  const game: GameRecord = {
    id: GAME, title: 'The Witcher 3', description: null, coverUrl: null, backgroundUrl: null, releaseYear: 2015,
    developer: null, publisher: null, franchiseId: null, platformId: null, platformIds: [], genreIds: [],
    status: 'PLAYING', archived: false, priority: 'NORMAL', rating: null, difficulty: null, gameType: null,
    completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: true,
    startedAt: null, completedAt: null, estimatedMainHours: null, estimatedCompletionistHours: null,
    personalEstimatedHours: null, retroactivePlayedHours: 0, notes: null, createdAt: now, updatedAt: now,
  };
  return {
    list: async () => [game],
    find: async (gameId) => gameId === GAME ? game : undefined,
    create: async (input: GameInput) => ({ ...game, ...input, id: id(2) }),
    update: async (_gameId, input) => Object.assign(game, input),
    delete: async () => true,
  };
}

const platformRepository: PlatformRepository = {
  list: async () => [{ id: PC, name: 'PC', parentId: null }, { id: PS5, name: 'PlayStation 5', parentId: null }],
  create: async (name) => ({ id: id(12), name, parentId: null }),
  setParent: async (platformId, parentId) => ({ id: platformId, name: 'PC', parentId }),
};

// Tempo que a fonte externa informa para uma associação, por id. Um teste o
// preenche para simular o que a sincronização teria gravado.
const externalMinutes = new Map<string, number>();

function gamePlatformRepository(): GamePlatformRepository {
  const rows: GamePlatformRecord[] = [];
  let seq = 100;
  const withExternal = (row: GamePlatformRecord): GamePlatformRecord => externalMinutes.has(row.id)
    ? Object.assign(row, { externalPlaytimeMinutes: externalMinutes.get(row.id)!, externalSource: 'achievist', externalId: row.id })
    : row;
  return {
    listAll: async () => rows.map(withExternal),
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId).map(withExternal),
    find: async (gameId, rowId) => {
      const row = rows.find((item) => item.gameId === gameId && item.id === rowId);
      return row ? withExternal(row) : undefined;
    },
    create: async (gameId, input: GamePlatformInput) => {
      if (input.isPrimary) for (const row of rows.filter((item) => item.gameId === gameId)) row.isPrimary = false;
      const row: GamePlatformRecord = {
        id: id(seq += 1), gameId, platformId: input.platformId, edition: input.edition?.trim() ?? null,
        format: input.format ?? null, owned: input.owned ?? false, isPrimary: input.isPrimary ?? false,
        externalSource: null, externalId: null, externalAccountLabel: null, externalPlaytimeMinutes: null,
        externalLastPlayedAt: null, externalSyncedAt: null, externalPlaytimeImportedMinutes: 0, notes: input.notes?.trim() ?? null,
        createdAt: now, updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    update: async (gameId, rowId, input: GamePlatformUpdate) => {
      const row = rows.find((item) => item.gameId === gameId && item.id === rowId);
      if (!row) return undefined;
      if (input.isPrimary) for (const other of rows.filter((item) => item.gameId === gameId)) other.isPrimary = false;
      Object.assign(row, {
        ...(input.platformId !== undefined && { platformId: input.platformId }),
        ...(input.edition !== undefined && { edition: input.edition?.trim() ?? null }),
        ...(input.format !== undefined && { format: input.format }),
        ...(input.owned !== undefined && { owned: input.owned }),
        ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
      });
      return row;
    },
    delete: async (gameId, rowId) => {
      const index = rows.findIndex((item) => item.gameId === gameId && item.id === rowId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    // A importação externa (ADR-024) tem testes próprios; aqui as três
    // operações existem só para satisfazer o contrato do repositório.
    listByExternalSource: async (source) => rows.filter((row) => row.externalSource === source),
    attachExternal: async (gameId, platformId) => {
      const row: GamePlatformRecord = {
        id: id(seq += 1), gameId, platformId, edition: null, format: null, owned: true, isPrimary: false,
        externalSource: null, externalId: null, externalAccountLabel: null, externalPlaytimeMinutes: null,
        externalLastPlayedAt: null, externalSyncedAt: null, externalPlaytimeImportedMinutes: 0, notes: null, createdAt: now, updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    updateExternalSnapshot: async (rowId) => rows.find((row) => row.id === rowId),
    markPlaytimeImported: async (rowId, importedMinutes) => {
      const row = rows.find((item) => item.id === rowId);
      return row ? Object.assign(row, { externalPlaytimeImportedMinutes: importedMinutes }) : undefined;
    },
  };
}

function playthroughRepository(): PlaythroughRepository {
  const rows: PlaythroughRecord[] = [];
  let seq = 200;
  return {
    listAll: async () => rows,
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId).sort((a, b) => a.sequence - b.sequence),
    find: async (gameId, rowId) => rows.find((row) => row.gameId === gameId && row.id === rowId),
    create: async (gameId, input: PlaythroughInput) => {
      const row: PlaythroughRecord = {
        id: id(seq += 1), gameId, sequence: nextSequence(rows.filter((item) => item.gameId === gameId)),
        label: input.label?.trim() ?? null, status: input.status ?? 'PLANNED',
        primaryPlatformId: input.primaryPlatformId ?? null, startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null, notes: input.notes?.trim() ?? null, createdAt: now, updatedAt: now,
      };
      rows.push(row);
      return row;
    },
    update: async (gameId, rowId, input: PlaythroughUpdate) => {
      const row = rows.find((item) => item.gameId === gameId && item.id === rowId);
      if (!row) return undefined;
      Object.assign(row, {
        ...(input.label !== undefined && { label: input.label?.trim() ?? null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.primaryPlatformId !== undefined && { primaryPlatformId: input.primaryPlatformId }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        ...(input.notes !== undefined && { notes: input.notes?.trim() ?? null }),
      });
      return row;
    },
    delete: async (gameId, rowId) => {
      const index = rows.findIndex((item) => item.gameId === gameId && item.id === rowId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}

function sessionRepository(): SessionRepository {
  const rows: SessionRecord[] = [];
  let seq = 300;
  const write = (row: SessionRecord, input: SessionInput) => Object.assign(row, {
    playthroughId: input.playthroughId ?? null, platformId: input.platformId ?? null,
    startedAt: new Date(input.startedAt), endedAt: input.endedAt ? new Date(input.endedAt) : null,
    progress: input.progress ?? null, location: input.location ?? null, notes: input.notes ?? null,
    keyDecisions: input.keyDecisions ?? null, tips: input.tips ?? null, updatedAt: now,
  });
  return {
    listForGame: async (gameId) => rows.filter((row) => row.gameId === gameId),
    listAll: async () => rows,
    findForGame: async (gameId, sessionId) => rows.find((row) => row.gameId === gameId && row.id === sessionId),
    create: async (gameId, input) => {
      const row: SessionRecord = {
        id: id(seq += 1), gameId, playthroughId: null, platformId: null, startedAt: new Date(input.startedAt),
        endedAt: null, progress: null, location: null, notes: null, keyDecisions: null, tips: null,
        createdAt: now, updatedAt: now,
      };
      write(row, input);
      rows.push(row);
      return row;
    },
    update: async (gameId, sessionId, input) => {
      const row = rows.find((item) => item.gameId === gameId && item.id === sessionId);
      return row ? write(row, input) : undefined;
    },
    delete: async () => false,
    detachPlaythrough: async (playthroughId) => {
      const affected = rows.filter((row) => row.playthroughId === playthroughId);
      for (const row of affected) row.playthroughId = null;
      return affected.length;
    },
  };
}

const apps: Array<ReturnType<typeof buildApp>> = [];
function setup() {
  const app = buildApp({
    gameRepository: gameRepository(),
    platformRepository,
    gamePlatformRepository: gamePlatformRepository(),
    playthroughRepository: playthroughRepository(),
    sessionRepository: sessionRepository(),
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  externalMinutes.clear();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('plataformas associadas ao jogo', () => {
  it('associa o mesmo jogo a várias plataformas sem duplicar o cadastro canônico', async () => {
    const app = setup();
    for (const platformId of [PC, PS5]) {
      const response = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId, owned: true } });
      expect(response.statusCode).toBe(201);
      expect(response.json().gameId).toBe(GAME);
    }
    const list = await app.inject({ method: 'GET', url: `/games/${GAME}/platforms` });
    expect(list.json()).toHaveLength(2);
    expect((await app.inject({ method: 'GET', url: '/games' })).json()).toHaveLength(1);
  });

  it('rejeita a mesma plataforma e edição duas vezes, mas aceita edições diferentes', async () => {
    const app = setup();
    const payload = { platformId: PC, edition: 'Complete Edition' };
    expect((await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PC, edition: 'Game of the Year' } })).statusCode).toBe(201);
  });

  it('mantém uma única plataforma principal', async () => {
    const app = setup();
    await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PC, isPrimary: true } });
    const second = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PS5, isPrimary: true } });
    expect(second.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: `/games/${GAME}/platforms` });
    expect(list.json().filter((item: { isPrimary: boolean }) => item.isPrimary)).toHaveLength(1);
  });

  it('recusa uma plataforma que não existe no catálogo', async () => {
    const app = setup();
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: id(99) } });
    expect(response.statusCode).toBe(400);
  });

  it('desassociar a plataforma não apaga sessões nem jornadas', async () => {
    const app = setup();
    const link = (await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PC } })).json();
    const playthrough = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T12:00:00.000Z', playthroughId: playthrough.id, platformId: PC } });

    expect((await app.inject({ method: 'DELETE', url: `/games/${GAME}/platforms/${link.id}` })).statusCode).toBe(204);
    const sessions = (await app.inject({ method: 'GET', url: `/games/${GAME}/sessions` })).json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ platformId: PC, playthroughId: playthrough.id, durationMinutes: 120 });
    expect((await app.inject({ method: 'GET', url: `/games/${GAME}/playthroughs` })).json()).toHaveLength(1);
  });
});

describe('lançar tempo externo como horas retroativas', () => {
    // A associação precisa ter tempo informado pela fonte; o teste grava isso
    // direto no repositório, como a sincronização faria.
    async function withExternalTime(app: ReturnType<typeof buildApp>, minutes: number) {
      const link = (await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PC } })).json();
      externalMinutes.set(link.id, minutes);
      return link;
    }

    it('lança o tempo informado e marca quanto já foi lançado', async () => {
      const app = setup();
      const link = await withExternalTime(app, 120);
      const response = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms/${link.id}/import-playtime` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ importedMinutes: 120, retroactivePlayedHours: 2 });
      expect(response.json().platform).toMatchObject({ externalPlaytimeImportedMinutes: 120 });
    });

    it('não lança duas vezes o mesmo tempo', async () => {
      const app = setup();
      const link = await withExternalTime(app, 120);
      await app.inject({ method: 'POST', url: `/games/${GAME}/platforms/${link.id}/import-playtime` });
      const again = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms/${link.id}/import-playtime` });

      expect(again.statusCode).toBe(409);
      expect(again.json().error).toContain('já foi lançado');
      // As horas do jogo não mudaram na segunda tentativa.
      expect((await app.inject({ method: 'GET', url: `/games/${GAME}` })).json().retroactivePlayedHours).toBe(2);
    });

    it('recusa quando a fonte não informa tempo para a plataforma', async () => {
      const app = setup();
      const link = (await app.inject({ method: 'POST', url: `/games/${GAME}/platforms`, payload: { platformId: PC } })).json();
      const response = await app.inject({ method: 'POST', url: `/games/${GAME}/platforms/${link.id}/import-playtime` });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toContain('não informa');
    });

    it('não cria sessão nem jornada ao lançar o tempo', async () => {
      const app = setup();
      const link = await withExternalTime(app, 60);
      await app.inject({ method: 'POST', url: `/games/${GAME}/platforms/${link.id}/import-playtime` });

      expect((await app.inject({ method: 'GET', url: `/games/${GAME}/sessions` })).json()).toHaveLength(0);
      expect((await app.inject({ method: 'GET', url: `/games/${GAME}/playthroughs` })).json()).toHaveLength(0);
    });
  });

  describe('jornadas e replays', () => {
  it('mantém várias jornadas no mesmo jogo, numeradas em ordem, sem duplicar o jogo', async () => {
    const app = setup();
    const first = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2016-01-01' } })).json();
    await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${first.id}`, payload: { status: 'COMPLETED', completedAt: '2016-06-01' } });
    const replay = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01', label: 'Replay no PS5' } })).json();

    expect(first).toMatchObject({ sequence: 1, isReplay: false, gameId: GAME });
    expect(replay).toMatchObject({ sequence: 2, isReplay: true, gameId: GAME });
    expect((await app.inject({ method: 'GET', url: '/games' })).json()).toHaveLength(1);

    const metrics = (await app.inject({ method: 'GET', url: `/games/${GAME}/playthroughs/metrics` })).json();
    expect(metrics).toMatchObject({ total: 2, started: 2, completed: 1, replaysStarted: 1, activePlaythroughId: replay.id });
  });

  it('retomar uma jornada pausada não cria outra jornada', async () => {
    const app = setup();
    const created = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'PAUSED' } });
    const resumed = await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'PLAYING' } });

    expect(resumed.statusCode).toBe(200);
    expect(resumed.json()).toMatchObject({ id: created.id, sequence: 1, status: 'PLAYING' });
    expect((await app.inject({ method: 'GET', url: `/games/${GAME}/playthroughs` })).json()).toHaveLength(1);
  });

  it('reabrir uma jornada concluída limpa a conclusão e deixa de contá-la como zerada', async () => {
    const app = setup();
    const created = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'COMPLETED', completedAt: '2026-02-01' } });
    const reopened = await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'PLAYING' } });

    expect(reopened.json()).toMatchObject({ status: 'PLAYING', completedAt: null, startedAt: '2026-01-01' });
    expect((await app.inject({ method: 'GET', url: `/games/${GAME}/playthroughs/metrics` })).json().completed).toBe(0);
  });

  it('recusa concluir uma jornada que nunca foi iniciada', async () => {
    const app = setup();
    const created = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: {} })).json();
    expect(created).toMatchObject({ status: 'PLANNED', startedAt: null });
    const response = await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'COMPLETED', completedAt: '2026-02-01' } });
    expect(response.statusCode).toBe(409);
  });

  it('exige data de conclusão ao concluir e recusa conclusão anterior ao início', async () => {
    const app = setup();
    const created = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-03-01' } })).json();
    expect((await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'COMPLETED' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/games/${GAME}/playthroughs/${created.id}`, payload: { status: 'COMPLETED', completedAt: '2026-02-01' } })).statusCode).toBe(400);
  });

  it('excluir a jornada preserva as sessões, apenas sem vínculo', async () => {
    const app = setup();
    const playthrough = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T11:30:00.000Z', playthroughId: playthrough.id } });
    expect((await app.inject({ method: 'DELETE', url: `/games/${GAME}/playthroughs/${playthrough.id}` })).statusCode).toBe(204);

    const sessions = (await app.inject({ method: 'GET', url: `/games/${GAME}/sessions` })).json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ playthroughId: null, durationMinutes: 90 });
  });
});

describe('sessões, jornadas e plataformas', () => {
  it('aceita sessões em plataformas diferentes dentro da mesma jornada', async () => {
    const app = setup();
    const playthrough = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    for (const [platformId, startedAt] of [[PC, '2026-01-02T10:00:00.000Z'], [PS5, '2026-01-03T10:00:00.000Z']] as const) {
      const response = await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt, endedAt: null, playthroughId: playthrough.id, platformId } });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ playthroughId: playthrough.id, platformId });
    }
    const sessions = (await app.inject({ method: 'GET', url: `/games/${GAME}/sessions` })).json();
    expect(sessions.map((session: { platformId: string }) => session.platformId).sort()).toEqual([PC, PS5].sort());
  });

  it('continua aceitando sessões sem jornada e sem plataforma', async () => {
    const app = setup();
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt: '2026-01-02T10:00:00.000Z' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ playthroughId: null, platformId: null });
  });

  it('recusa vincular a sessão a uma jornada que não é do jogo', async () => {
    const app = setup();
    const response = await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt: '2026-01-02T10:00:00.000Z', playthroughId: id(777) } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Jornada');
  });

  it('permite associar uma sessão existente a uma jornada depois', async () => {
    const app = setup();
    const session = (await app.inject({ method: 'POST', url: `/games/${GAME}/sessions`, payload: { startedAt: '2026-01-02T10:00:00.000Z' } })).json();
    const playthrough = (await app.inject({ method: 'POST', url: `/games/${GAME}/playthroughs`, payload: { status: 'PLAYING', startedAt: '2026-01-01' } })).json();
    const updated = await app.inject({ method: 'PATCH', url: `/games/${GAME}/sessions/${session.id}`, payload: { playthroughId: playthrough.id } });
    expect(updated.json()).toMatchObject({ id: session.id, playthroughId: playthrough.id });
  });
});
