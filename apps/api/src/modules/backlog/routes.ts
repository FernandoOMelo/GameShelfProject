import type { FastifyInstance } from 'fastify';
import { queueItemSchema, queueReorderSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { BacklogRepository } from './repository.js';

export async function registerBacklogRoutes(app: FastifyInstance, games: GameRepository, backlog: BacklogRepository) {
  app.get('/queue', async (_request, reply) => {
    const items = await backlog.listQueue();
    return reply.send(items.map((item) => queueItemSchema.parse({
      ...item,
      addedAt: item.addedAt.toISOString(),
      game: serializeGame(item.game),
    })));
  });

  app.post<{ Body: { gameId?: unknown } }>('/queue', async (request, reply) => {
    if (typeof request.body?.gameId !== 'string' || !isUuid(request.body.gameId)) return reply.code(400).send({ error: 'ID de jogo inválido.' });
    const game = await games.find(request.body.gameId);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    if (game.status === 'COMPLETED' || game.status === 'ABANDONED') return reply.code(400).send({ error: 'Jogos concluídos ou abandonados não podem entrar na fila.' });
    try {
      await backlog.addToQueue(game.id);
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Este jogo já está na fila.' });
      throw error;
    }
    const items = await backlog.listQueue();
    const added = items.find((item) => item.game.id === game.id);
    return reply.code(201).send(queueItemSchema.parse({
      ...added!, addedAt: added!.addedAt.toISOString(), game: serializeGame(added!.game),
    }));
  });

  app.delete<{ Params: { gameId: string } }>('/queue/:gameId', async (request, reply) => {
    if (!isUuid(request.params.gameId)) return reply.code(400).send({ error: 'ID de jogo inválido.' });
    if (!await backlog.removeFromQueue(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado na fila.' });
    return reply.code(204).send();
  });

  app.put('/queue/order', async (request, reply) => {
    const parsed = queueReorderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Ordenação inválida.', issues: parsed.error.issues });
    if (!await backlog.reorderQueue(parsed.data.gameIds)) return reply.code(409).send({ error: 'A fila mudou. Atualize e tente novamente.' });
    return reply.send((await backlog.listQueue()).map((item) => queueItemSchema.parse({
      ...item, addedAt: item.addedAt.toISOString(), game: serializeGame(item.game),
    })));
  });
}

function serializeGame(game: Awaited<ReturnType<GameRepository['find']>> extends infer T ? Exclude<T, undefined> : never) {
  return {
    ...game,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
