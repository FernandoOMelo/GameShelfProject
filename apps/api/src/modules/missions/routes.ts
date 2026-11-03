import type { FastifyInstance } from 'fastify';
import { missionInputSchema, missionSchema, missionUpdateSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import { toGame, toSession } from '../shared/serialize.js';
import { parseId } from '../shared/parse-id.js';
import type { MissionRepository } from './repository.js';
import { buildMissionProgress } from './service.js';

export async function registerMissionRoutes(
  app: FastifyInstance, games: GameRepository, sessions: SessionRepository, lists: GameListRepository, missions: MissionRepository,
) {
  async function progress() {
    const [records, gameRecords, sessionRecords, listRecords] = await Promise.all([missions.list(), games.list(), sessions.listAll(), lists.list()]);
    return buildMissionProgress(records, gameRecords.map(toGame), sessionRecords.map(toSession), listRecords.map((list) => ({ id: list.id, name: list.name, gameIds: list.gameIds })))
      .map((item) => missionSchema.parse(item));
  }

  app.get('/missions', async (_request, reply) => reply.send(await progress()));

  app.post('/missions', async (request, reply) => {
    const parsed = missionInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    if (parsed.data.kind === 'LIST' && !await lists.find(parsed.data.listId!)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    const created = await missions.create(parsed.data);
    return reply.code(201).send((await progress()).find((item) => item.id === created.id));
  });

  app.patch<{ Params: { id: string } }>('/missions/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = missionUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    if (parsed.data.listId && !await lists.find(parsed.data.listId)) return reply.code(404).send({ error: 'Lista não encontrada.' });
    const updated = await missions.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'Missão não encontrada.' });
    return reply.send((await progress()).find((item) => item.id === updated.id));
  });

  app.delete<{ Params: { id: string } }>('/missions/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await missions.remove(id)) return reply.code(404).send({ error: 'Missão não encontrada.' });
    return reply.code(204).send();
  });
}
