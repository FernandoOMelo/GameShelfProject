import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FranchiseRepository } from './repository.js';
import { registerFranchiseRoutes } from './routes.js';
import type { FranchiseGamesProvider } from '../games/metadata-provider.js';
import type { GameRepository } from '../games/repository.js';

const franchiseId = '00000000-0000-4000-8000-000000000010';

function fakeFranchiseRepository(): FranchiseRepository {
  const franchises: Array<{ id: string; name: string; igdbFranchiseId: number | null }> = [
    { id: franchiseId, name: 'Final Fantasy', igdbFranchiseId: null },
  ];
  return {
    list: async () => franchises,
    find: async (id) => franchises.find((item) => item.id === id),
    create: async (name, igdbFranchiseId = null) => {
      const franchise = { id: '00000000-0000-4000-8000-000000000011', name, igdbFranchiseId };
      franchises.push(franchise);
      return franchise;
    },
    setIgdbFranchiseId: async (id, igdbFranchiseId) => {
      const franchise = franchises.find((item) => item.id === id);
      if (!franchise) return undefined;
      franchise.igdbFranchiseId = igdbFranchiseId;
      return franchise;
    },
  };
}

describe('rotas de franquia', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('vincula o id do IGDB a uma franquia existente', async () => {
    const repository = fakeFranchiseRepository();
    const app = Fastify();
    apps.push(app);
    registerFranchiseRoutes(app, repository);

    const response = await app.inject({ method: 'PATCH', url: `/franchises/${franchiseId}/igdb-link`, payload: { igdbFranchiseId: 42 } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: franchiseId, igdbFranchiseId: 42 });
  });

  it('lista os jogos da franquia no IGDB cruzados com a biblioteca local', async () => {
    const repository = fakeFranchiseRepository();
    await repository.setIgdbFranchiseId(franchiseId, 42);
    const franchiseGames: FranchiseGamesProvider = {
      franchiseGames: async () => [
        { igdbId: 1, title: 'Final Fantasy VII Remake', releaseYear: 2020, coverUrl: null },
        { igdbId: 2, title: 'Final Fantasy XVI', releaseYear: 2023, coverUrl: null },
      ],
    };
    const games = {
      list: async () => [{ id: '00000000-0000-4000-8000-000000000099', title: 'Final Fantasy VII Remake', status: 'COMPLETED' }],
    } as unknown as GameRepository;
    const app = Fastify();
    apps.push(app);
    registerFranchiseRoutes(app, repository, franchiseGames, games);

    const response = await app.inject(`/franchises/${franchiseId}/igdb-games`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      franchiseName: 'Final Fantasy',
      games: [
        { title: 'Final Fantasy VII Remake', inLibrary: true, libraryGameId: '00000000-0000-4000-8000-000000000099', libraryGameStatus: 'COMPLETED' },
        { title: 'Final Fantasy XVI', inLibrary: false, libraryGameId: null },
      ],
    });
  });

  it('informa que não há catálogo de franquias sem o provider configurado', async () => {
    const app = Fastify();
    apps.push(app);
    registerFranchiseRoutes(app, fakeFranchiseRepository());
    expect((await app.inject(`/franchises/${franchiseId}/igdb-games`)).statusCode).toBe(503);
  });
});
