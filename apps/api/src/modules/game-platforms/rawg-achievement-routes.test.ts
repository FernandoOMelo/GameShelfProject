import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameRepository } from '../games/repository.js';
import { registerRawgAchievementRoutes } from './rawg-achievement-routes.js';
import type { RawgAchievementProvider, RawgAchievementRepository } from './rawg-achievements.js';
import type { GamePlatformRepository } from './repository.js';
import type { ExternalAchievementRepository } from './achievement-repository.js';
import type { PlatformRepository } from '../platforms/repository.js';

const gameId = '00000000-0000-4000-8000-000000000001';
const candidate = { id: 3498, slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V', released: '2013-09-17', backgroundImage: null };
const games = { find: async (id: string) => id === gameId ? { id: gameId, title: 'Grand Theft Auto V' } : undefined } as GameRepository;

describe('rotas do catálogo RAWG', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('permite confirmar um candidato e persistir seu catálogo', async () => {
    const replace = vi.fn<RawgAchievementRepository['replace']>().mockResolvedValue({
      linkedGame: candidate,
      achievements: [{ id: '00000000-0000-4000-8000-000000000002', rawgId: 40, name: 'First win', description: null, imageUrl: null, percent: 32.5 }],
      refreshedAt: '2026-10-25T00:00:00.000Z',
    });
    const store: RawgAchievementRepository = { get: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }), replace };
    const provider: RawgAchievementProvider = { search: async () => [candidate], achievements: async () => [{ id: '00000000-0000-4000-8000-000000000003', rawgId: 40, name: 'First win', description: null, imageUrl: null, percent: 32.5 }] };
    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, games, store, provider);

    expect((await app.inject({ method: 'GET', url: `/games/${gameId}/rawg-achievements/candidates` })).json()).toEqual([candidate]);
    const response = await app.inject({ method: 'PUT', url: `/games/${gameId}/rawg-achievements`, payload: candidate });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ linkedGame: candidate, achievements: [{ rawgId: 40, percent: 32.5 }] });
    expect(replace).toHaveBeenCalledWith(gameId, candidate, expect.any(Array));
  });

  it('keeps stored catalog available but protects provider routes without the key', async () => {
    const store: RawgAchievementRepository = { get: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }), replace: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }) };
    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, games, store);

    expect((await app.inject(`/games/${gameId}/rawg-achievements`)).statusCode).toBe(200);
    expect((await app.inject(`/games/${gameId}/rawg-achievements/candidates`)).statusCode).toBe(503);
    expect((await app.inject({ method: 'PUT', url: `/games/${gameId}/rawg-achievements`, payload: candidate })).statusCode).toBe(503);
  });

  it('mescla o catálogo RAWG com as conquistas espelhadas de todas as plataformas do jogo', async () => {
    const store: RawgAchievementRepository = {
      get: async () => ({
        linkedGame: candidate,
        achievements: [{ id: '00000000-0000-4000-8000-000000000002', rawgId: 40, name: 'Primeira vitória', description: 'Vença uma corrida.', imageUrl: null, percent: 42.5 }],
        refreshedAt: '2026-10-25T00:00:00.000Z',
      }),
      replace: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }),
    };
    const gamePlatforms = { listForGame: async () => [{ id: 'link-1', platformId: '00000000-0000-4000-8000-0000000000a1', edition: null }] } as unknown as GamePlatformRepository;
    const externalAchievements: ExternalAchievementRepository = {
      listUnlocks: async () => [],
      countsByGamePlatform: async () => new Map(),
      listForGamePlatform: async () => [{
        id: '00000000-0000-4000-8000-000000000009', gamePlatformId: 'link-1', externalId: '40', name: 'primeira vitória', description: null, iconUrl: null,
        points: null, rarityPercent: null, unlocked: true, unlockedAt: new Date('2026-10-09T12:21:00.000Z'), syncedAt: new Date('2026-10-28T00:00:00.000Z'),
      }],
      replaceForGamePlatform: async () => [],
    };
    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, games, store, undefined, { gamePlatforms, externalAchievements });

    const response = await app.inject(`/games/${gameId}/achievements`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1, unlockedCount: 1, achievements: [{ name: 'primeira vitória', description: 'Vença uma corrida.', unlocked: true }] });
  });

  it('separa as conquistas por plataforma quando o jogo tem mais de uma associação', async () => {
    const store: RawgAchievementRepository = { get: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }), replace: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }) };
    const psId = '00000000-0000-4000-8000-0000000000a1';
    const pcId = '00000000-0000-4000-8000-0000000000a2';
    const gamePlatforms = { listForGame: async () => [{ id: 'link-ps', platformId: psId, edition: null }, { id: 'link-pc', platformId: pcId, edition: 'Steam' }] } as unknown as GamePlatformRepository;
    const record = (id: string, link: string, unlocked: boolean) => ({
      id, gamePlatformId: link, externalId: id, name: 'Primeiro passo', description: 'Comece.', iconUrl: null, points: null, rarityPercent: null,
      unlocked, unlockedAt: unlocked ? new Date('2026-10-09T12:21:00.000Z') : null, syncedAt: new Date('2026-10-28T00:00:00.000Z'),
    });
    const externalAchievements: ExternalAchievementRepository = {
      listUnlocks: async () => [],
      countsByGamePlatform: async () => new Map(),
      listForGamePlatform: async (id) => [record(id === 'link-ps' ? '00000000-0000-4000-8000-0000000000b1' : '00000000-0000-4000-8000-0000000000b2', id, id === 'link-ps')],
      replaceForGamePlatform: async () => [],
    };
    const platforms = { list: async () => [{ id: psId, name: 'PlayStation 5' }, { id: pcId, name: 'PC' }] } as unknown as PlatformRepository;
    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, games, store, undefined, { gamePlatforms, externalAchievements, platforms });

    const body = (await app.inject(`/games/${gameId}/achievements`)).json();
    expect(body.groups.map((group: { name: string; unlockedCount: number; total: number }) => [group.name, group.unlockedCount, group.total])).toEqual([['PlayStation 5', 1, 1], ['PC · Steam', 0, 1]]);
    expect(body.total).toBe(2);
  });

  it('vincula o catálogo RAWG ao ler as conquistas de um jogo ainda sem vínculo', async () => {
    const link = { linkedGame: candidate, achievements: [{ id: '00000000-0000-4000-8000-000000000002', rawgId: 40, name: 'First win', description: 'Win.', imageUrl: null, percent: 32.5 }], refreshedAt: '2026-10-25T00:00:00.000Z' };
    let stored: typeof link | null = null;
    const store: RawgAchievementRepository = {
      get: async () => stored ?? { linkedGame: null, achievements: [], refreshedAt: null },
      replace: async () => { stored = link; return link; },
    };
    const search = vi.fn(async () => [candidate]);
    const provider: RawgAchievementProvider = { search, achievements: async () => link.achievements };
    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, games, store, provider);

    const first = await app.inject(`/games/${gameId}/achievements`);
    expect(first.json()).toMatchObject({ catalogAvailable: true, total: 1, groups: [{ id: 'catalog' }] });
    await app.inject(`/games/${gameId}/achievements`);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('preenche a condição de zeramento com a conquista de jogo concluído, sem sobrescrever o que já existe', async () => {
    const link = { linkedGame: candidate, achievements: [
      { id: '00000000-0000-4000-8000-000000000002', rawgId: 1, name: 'Hardboiled Writer', description: 'You completed the game on Normal difficulty.', imageUrl: null, percent: 15 },
    ], refreshedAt: '2026-10-25T00:00:00.000Z' };
    const store: RawgAchievementRepository = { get: async () => link, replace: async () => link };
    const update = vi.fn(async () => undefined);
    const empty = { find: async () => ({ id: gameId, title: 'Alan Wake', completionCondition: null }), update } as unknown as GameRepository;
    const filled = { find: async () => ({ id: gameId, title: 'Alan Wake', completionCondition: 'Zerar tudo' }), update } as unknown as GameRepository;

    const app = Fastify();
    apps.push(app);
    registerRawgAchievementRoutes(app, empty, store);
    await app.inject(`/games/${gameId}/achievements`);
    expect(update).toHaveBeenCalledWith(gameId, { completionCondition: 'Hardboiled Writer: You completed the game on Normal difficulty.' });

    update.mockClear();
    const other = Fastify();
    apps.push(other);
    registerRawgAchievementRoutes(other, filled, store);
    await other.inject(`/games/${gameId}/achievements`);
    expect(update).not.toHaveBeenCalled();
  });
});
