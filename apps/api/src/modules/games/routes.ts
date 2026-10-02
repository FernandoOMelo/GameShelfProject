import type { FastifyInstance } from 'fastify';
import { gameInputSchema, gameSchema, gameUpdateSchema } from '@gameshelf/contracts';
import type { GameRepository } from './repository.js';

export async function registerGameRoutes(app: FastifyInstance, repository: GameRepository) {
  app.get('/games', async (_request, reply) => {
    const games = await repository.list();
    return reply.send(games.map((game) => gameSchema.parse(toResponse(game))));
  });

  app.get<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const game = await repository.find(id);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send(gameSchema.parse(toResponse(game)));
  });

  app.post('/games', async (request, reply) => {
    const parsed = gameInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const game = await repository.create(parsed.data);
    return reply.code(201).send(gameSchema.parse(toResponse(game)));
  });

  app.patch<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = gameUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const game = await repository.update(id, parsed.data);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send(gameSchema.parse(toResponse(game)));
  });

  app.delete<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await repository.delete(id)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.code(204).send();
  });
}

function parseId(id: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function toResponse(game: Awaited<ReturnType<GameRepository['find']>> extends infer T ? Exclude<T, undefined> : never) {
  return {
    ...game,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}
