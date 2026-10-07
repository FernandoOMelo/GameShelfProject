import type { FastifyInstance } from 'fastify';
import { mainChallengeInputSchema, mainChallengeSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { MainChallengeRepository } from './repository.js';
import { buildChallengeProgress } from './service.js';

export async function registerChallengeRoutes(app: FastifyInstance, games: GameRepository, lists: GameListRepository, challenges: MainChallengeRepository) {
  async function progress() {
    const challenge = await challenges.get();
    if (!challenge) return undefined;
    const list = await lists.find(challenge.listId);
    if (!list) return undefined;
    const statusById = new Map((await games.list()).map((game) => [game.id, game.status as string]));
    return mainChallengeSchema.parse(buildChallengeProgress(challenge, list, statusById));
  }

  app.get('/challenge', async (_request, reply) => reply.send(await progress() ?? null));

  app.put('/challenge', async (request, reply) => {
    const parsed = mainChallengeInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    if (!await lists.find(parsed.data.listId)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    await challenges.set(parsed.data);
    return reply.send(await progress());
  });

  app.delete('/challenge', async (_request, reply) => {
    await challenges.clear();
    return reply.code(204).send();
  });
}
