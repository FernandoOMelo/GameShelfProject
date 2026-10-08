import type { FastifyInstance } from 'fastify';
import { queueFromListSchema, queueItemSchema, queueReorderSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { BacklogRepository } from './repository.js';

export async function registerBacklogRoutes(app: FastifyInstance, games: GameRepository, backlog: BacklogRepository, lists?: GameListRepository) {
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
    if (!game.owned) return reply.code(400).send({ error: 'A fila só aceita jogos que você possui.' });
    if (game.archived || game.status === 'COMPLETED' || game.status === 'ABANDONED') return reply.code(400).send({ error: 'Jogos arquivados, zerados ou abandonados não podem entrar na fila.' });
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

  // ADR-013: enfileira ao final os jogos elegíveis de uma lista, em ordem alfabética.
  app.post('/queue/from-list', async (request, reply) => {
    if (!lists) return reply.code(404).send({ error: 'Listas indisponíveis.' });
    const parsed = queueFromListSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ID de lista inválido.', issues: parsed.error.issues });
    const list = await lists.find(parsed.data.listId);
    if (!list) return reply.code(404).send({ error: 'Lista não encontrada.' });
    const queued = new Set((await backlog.listQueue()).map((item) => item.game.id));
    const members = new Set(list.gameIds);
    const eligible = (await games.list())
      .filter((game) => members.has(game.id) && !queued.has(game.id) && game.owned && !game.archived && game.status !== 'COMPLETED' && game.status !== 'ABANDONED')
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    for (const game of eligible) await backlog.addToQueue(game.id);
    const queue = (await backlog.listQueue()).map((item) => queueItemSchema.parse({ ...item, addedAt: item.addedAt.toISOString(), game: serializeGame(item.game) }));
    return reply.send({ added: eligible.length, skipped: members.size - eligible.length, queue });
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
    retroactivePlayedHours: Number(game.retroactivePlayedHours ?? 0),
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
