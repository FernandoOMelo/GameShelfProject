import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { DlcInput, DlcUpdate } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { DlcRecord, DlcRepository } from './repository.js';
import { registerDlcRoutes } from './routes.js';
import type { RawgAchievementProvider } from '../game-platforms/rawg-achievements.js';

const gameId = '00000000-0000-4000-8000-000000000001';
const otherGameId = '00000000-0000-4000-8000-000000000002';
const games = { find: async (id: string) => id === gameId ? { id: gameId, title: 'Final Fantasy VII Rebirth' } : id === otherGameId ? { id: otherGameId, title: 'INTERmission' } : undefined } as GameRepository;

function baseRecord(id: string, input: DlcInput): DlcRecord {
  return {
    id, gameId, name: input.name, description: input.description ?? null, coverUrl: input.coverUrl ?? null,
    releaseDate: input.releaseDate ?? null, owned: input.owned ?? false, status: input.status ?? 'NOT_STARTED',
    estimatedHours: input.estimatedHours ?? null, playedHours: input.playedHours ?? 0,
    rawgId: input.rawgId ?? null, rawgSlug: input.rawgSlug ?? null, rawgName: input.rawgName ?? null,
    linkedGameId: input.linkedGameId ?? null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'), updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };
}

function fakeDlcRepository(): DlcRepository {
  const rows = new Map<string, DlcRecord>();
  let seq = 0;
  return {
    listForGame: async (forGameId) => [...rows.values()].filter((row) => row.gameId === forGameId),
    find: async (forGameId, id) => { const row = rows.get(id); return row?.gameId === forGameId ? row : undefined; },
    create: async (forGameId, input: DlcInput) => {
      seq += 1;
      const record = baseRecord(`00000000-0000-4000-8000-00000000020${seq}`, input);
      rows.set(record.id, record);
      return record;
    },
    update: async (forGameId, id, input: DlcUpdate) => {
      const existing = rows.get(id);
      if (!existing || existing.gameId !== forGameId) return undefined;
      const next = { ...existing, ...input, updatedAt: new Date() };
      rows.set(id, next);
      return next;
    },
    delete: async (forGameId, id) => {
      const row = rows.get(id);
      if (!row || row.gameId !== forGameId) return false;
      return rows.delete(id);
    },
  };
}

describe('rotas de DLC', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('cria, lista, atualiza e exclui uma DLC do jogo', async () => {
    const repository = fakeDlcRepository();
    const app = Fastify();
    apps.push(app);
    registerDlcRoutes(app, games, repository);

    const create = await app.inject({ method: 'POST', url: `/games/${gameId}/dlcs`, payload: { name: 'INTERmission' } });
    expect(create.statusCode).toBe(201);
    const dlc = create.json() as { id: string };
    expect(dlc).toMatchObject({ name: 'INTERmission', status: 'NOT_STARTED', owned: false, playedHours: 0 });

    const list = await app.inject(`/games/${gameId}/dlcs`);
    expect(list.json()).toHaveLength(1);

    const patch = await app.inject({ method: 'PATCH', url: `/games/${gameId}/dlcs/${dlc.id}`, payload: { owned: true, status: 'PLAYING', playedHours: 2.5 } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ owned: true, status: 'PLAYING', playedHours: 2.5 });

    const remove = await app.inject({ method: 'DELETE', url: `/games/${gameId}/dlcs/${dlc.id}` });
    expect(remove.statusCode).toBe(204);
    expect((await app.inject(`/games/${gameId}/dlcs`)).json()).toHaveLength(0);
  });

  it('busca e vincula uma referência RAWG à DLC', async () => {
    const repository = fakeDlcRepository();
    const candidate = { id: 99, slug: 'intermission', name: 'FF7R INTERmission', released: '2021-06-10', backgroundImage: null };
    const provider: RawgAchievementProvider = { search: async () => [candidate], achievements: async () => [] };
    const app = Fastify();
    apps.push(app);
    registerDlcRoutes(app, games, repository, provider);

    const created = (await app.inject({ method: 'POST', url: `/games/${gameId}/dlcs`, payload: { name: 'INTERmission' } })).json() as { id: string };
    expect((await app.inject(`/games/${gameId}/dlcs/${created.id}/rawg-candidates`)).json()).toEqual([candidate]);

    const linked = await app.inject({ method: 'PUT', url: `/games/${gameId}/dlcs/${created.id}/rawg-link`, payload: candidate });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ rawgId: 99, rawgSlug: 'intermission', rawgName: 'FF7R INTERmission' });
  });

  it('devolve lista vazia de conquistas quando a DLC ainda não tem referência RAWG', async () => {
    const repository = fakeDlcRepository();
    const app = Fastify();
    apps.push(app);
    registerDlcRoutes(app, games, repository);
    const created = (await app.inject({ method: 'POST', url: `/games/${gameId}/dlcs`, payload: { name: 'INTERmission' } })).json() as { id: string };
    const response = await app.inject(`/games/${gameId}/dlcs/${created.id}/achievements`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('vincula a DLC a um jogo cadastrado, recusando o próprio jogo base e jogos inexistentes', async () => {
    const app = Fastify();
    apps.push(app);
    registerDlcRoutes(app, games, fakeDlcRepository());

    const created = await app.inject({ method: 'POST', url: `/games/${gameId}/dlcs`, payload: { name: 'INTERmission', linkedGameId: otherGameId } });
    expect(created.statusCode).toBe(201);
    expect(created.json().linkedGameId).toBe(otherGameId);
    const id = created.json().id as string;

    expect((await app.inject({ method: 'PATCH', url: `/games/${gameId}/dlcs/${id}`, payload: { linkedGameId: gameId } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/games/${gameId}/dlcs/${id}`, payload: { linkedGameId: '00000000-0000-4000-8000-0000000000ff' } })).statusCode).toBe(400);
    const unlinked = await app.inject({ method: 'PATCH', url: `/games/${gameId}/dlcs/${id}`, payload: { linkedGameId: null } });
    expect(unlinked.statusCode).toBe(200);
    expect(unlinked.json().linkedGameId).toBeNull();
  });
});
