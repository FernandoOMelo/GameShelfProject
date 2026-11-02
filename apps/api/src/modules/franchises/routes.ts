import type { FastifyInstance } from 'fastify';
import { franchiseGamesResponseSchema, franchiseInputSchema, franchiseSchema } from '@gameshelf/contracts';
import type { FranchiseRepository } from './repository.js';
import type { FranchiseGamesProvider } from '../games/metadata-provider.js';
import type { GameRepository } from '../games/repository.js';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const normalizeTitle = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export async function registerFranchiseRoutes(app: FastifyInstance, repository: FranchiseRepository, franchiseGames?: FranchiseGamesProvider, games?: GameRepository) {
  app.get('/franchises', async (_request, reply) => {
    const franchises = await repository.list();
    return reply.send(franchises.map((franchise) => franchiseSchema.parse(franchise)));
  });

  app.post('/franchises', async (request, reply) => {
    const parsed = franchiseInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o nome da franquia.', issues: parsed.error.issues });
    try {
      const franchise = await repository.create(parsed.data.name, parsed.data.igdbFranchiseId);
      return reply.code(201).send(franchiseSchema.parse(franchise));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma franquia com esse nome.' });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>('/franchises/:id/igdb-link', async (request, reply) => {
    if (!validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = franchiseInputSchema.pick({ igdbFranchiseId: true }).safeParse(request.body);
    if (!parsed.success || !parsed.data.igdbFranchiseId) return reply.code(400).send({ error: 'Informe o id da franquia no IGDB.' });
    try {
      const franchise = await repository.setIgdbFranchiseId(request.params.id, parsed.data.igdbFranchiseId);
      if (!franchise) return reply.code(404).send({ error: 'Franquia não encontrada.' });
      return reply.send(franchiseSchema.parse(franchise));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Essa franquia do IGDB já está vinculada a outra franquia local.' });
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/franchises/:id/igdb-games', async (request, reply) => {
    if (!franchiseGames) return reply.code(503).send({ error: 'Catálogo de franquias indisponível. Configure as credenciais do IGDB.' });
    if (!validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const franchise = await repository.find(request.params.id);
    if (!franchise) return reply.code(404).send({ error: 'Franquia não encontrada.' });
    if (!franchise.igdbFranchiseId) return reply.send(franchiseGamesResponseSchema.parse({ franchiseName: franchise.name, games: [] }));

    const siblings = await franchiseGames.franchiseGames(franchise.igdbFranchiseId);
    const libraryGames = games ? await games.list() : [];
    const libraryByTitle = new Map(libraryGames.map((game) => [normalizeTitle(game.title), game]));
    return reply.send(franchiseGamesResponseSchema.parse({
      franchiseName: franchise.name,
      games: siblings.map((sibling) => {
        const match = libraryByTitle.get(normalizeTitle(sibling.title));
        return {
          ...sibling,
          inLibrary: Boolean(match),
          libraryGameId: match?.id ?? null,
          libraryGameStatus: match?.status ?? null,
        };
      }),
    }));
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
