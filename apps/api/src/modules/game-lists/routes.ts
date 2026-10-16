import type { FastifyInstance } from 'fastify';
import { gameListCreateSchema, gameListInputSchema, gameListSchema, gameListSummarySchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { GameListRepository, GameListRecord } from './repository.js';

export async function registerGameListRoutes(app: FastifyInstance, games: GameRepository, lists: GameListRepository) {
  app.get('/lists', async (_request, reply) => {
    const records = await lists.list();
    return reply.send(records.map((record) => gameListSummarySchema.parse(toSummary(record))));
  });

  app.get<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const listId = parseId(request.params.listId);
    if (!listId) return reply.code(400).send({ error: 'ID de lista inválido.' });
    const record = await lists.find(listId);
    if (!record) return reply.code(404).send({ error: 'Lista não encontrada.' });
    const gamesInList = await Promise.all(record.gameIds.map((gameId) => games.find(gameId)));
    return reply.send(gameListSchema.parse({ ...toSummary(record), games: gamesInList.filter(Boolean).map((game) => serializeGame(game!)) }));
  });

  app.post('/lists', async (request, reply) => {
    const parsed = gameListCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Nome de lista inválido.', issues: parsed.error.issues });
    let created: GameListRecord;
    try {
      created = await lists.create(parsed.data.name);
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Já existe uma lista com esse nome.' });
      throw error;
    }
    const gameIds = parsed.data.gameIds ?? [];
    if (gameIds.length === 0) return reply.code(201).send(gameListSummarySchema.parse(toSummary(created)));
    try {
      await lists.addGames(created.id, gameIds);
    } catch (error) {
      if (isMissingReference(error)) {
        await lists.delete(created.id);
        return reply.code(400).send({ error: 'A lista inclui um jogo que não existe.' });
      }
      throw error;
    }
    const record = await lists.find(created.id);
    return reply.code(201).send(gameListSummarySchema.parse(toSummary(record ?? created)));
  });

  app.patch<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const listId = parseId(request.params.listId);
    if (!listId) return reply.code(400).send({ error: 'ID de lista inválido.' });
    const parsed = gameListInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Nome de lista inválido.', issues: parsed.error.issues });
    try {
      const record = await lists.rename(listId, parsed.data.name);
      return record ? reply.send(gameListSummarySchema.parse(toSummary(record))) : reply.code(404).send({ error: 'Lista não encontrada.' });
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Já existe uma lista com esse nome.' });
      throw error;
    }
  });

  app.delete<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const listId = parseId(request.params.listId);
    if (!listId) return reply.code(400).send({ error: 'ID de lista inválido.' });
    if (!await lists.delete(listId)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    return reply.code(204).send();
  });

  app.post<{ Params: { listId: string }; Body: { gameId?: unknown } }>('/lists/:listId/games', async (request, reply) => {
    const listId = parseId(request.params.listId);
    if (!listId) return reply.code(400).send({ error: 'ID de lista inválido.' });
    if (typeof request.body?.gameId !== 'string' || !parseId(request.body.gameId)) return reply.code(400).send({ error: 'ID de jogo inválido.' });
    if (!await lists.find(listId)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    if (!await games.find(request.body.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    try {
      await lists.addGame(listId, request.body.gameId);
      return reply.code(204).send();
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Este jogo já está na lista.' });
      throw error;
    }
  });

  app.delete<{ Params: { listId: string; gameId: string } }>('/lists/:listId/games/:gameId', async (request, reply) => {
    const listId = parseId(request.params.listId);
    const gameId = parseId(request.params.gameId);
    if (!listId || !gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await lists.find(listId)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    if (!await lists.removeGame(listId, gameId)) return reply.code(404).send({ error: 'Jogo não encontrado na lista.' });
    return reply.code(204).send();
  });
}

function toSummary(record: GameListRecord) {
  return { id: record.id, name: record.name, gameCount: record.gameIds.length, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

function serializeGame(game: NonNullable<Awaited<ReturnType<GameRepository['find']>>>) {
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

function parseId(value: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isMissingReference(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}
