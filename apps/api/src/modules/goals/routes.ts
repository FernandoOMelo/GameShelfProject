import type { FastifyInstance } from 'fastify';
import { goalInputSchema, goalProgressSchema, goalsQuerySchema, goalTargetSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import { toGame, toSession } from '../shared/serialize.js';
import type { GoalRepository } from './repository.js';
import { buildGoalProgress } from './service.js';

export async function registerGoalRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, goals: GoalRepository) {
  async function progress(timezoneOffsetMinutes: number) {
    const [goalRecords, gameRecords, sessionRecords] = await Promise.all([goals.list(), games.list(), sessions.listAll()]);
    const today = new Date(Date.now() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    return buildGoalProgress({ goals: goalRecords, games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), today, timezoneOffsetMinutes })
      .map((item) => goalProgressSchema.parse(item));
  }

  app.get('/goals', async (request, reply) => {
    const query = goalsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Parâmetros inválidos.', issues: query.error.issues });
    return reply.send(await progress(query.data.timezoneOffsetMinutes));
  });

  app.post('/goals', async (request, reply) => {
    const parsed = goalInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    let created;
    try {
      created = await goals.create(parsed.data);
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Já existe uma meta deste tipo para o período.' });
      throw error;
    }
    return reply.code(201).send((await progress(0)).find((item) => item.id === created.id));
  });

  app.patch<{ Params: { id: string } }>('/goals/:id', async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'ID de meta inválido.' });
    const parsed = goalTargetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const updated = await goals.updateTarget(request.params.id, parsed.data.target);
    if (!updated) return reply.code(404).send({ error: 'Meta não encontrada.' });
    return reply.send((await progress(0)).find((item) => item.id === updated.id));
  });

  app.delete<{ Params: { id: string } }>('/goals/:id', async (request, reply) => {
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'ID de meta inválido.' });
    if (!await goals.remove(request.params.id)) return reply.code(404).send({ error: 'Meta não encontrada.' });
    return reply.code(204).send();
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
