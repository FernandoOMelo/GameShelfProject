import type { FastifyInstance } from 'fastify';
import { dlcInputSchema, dlcSchema, dlcUpdateSchema, rawgAchievementCandidateSchema, rawgAchievementSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { DlcRecord, DlcRepository } from './repository.js';
import type { RawgAchievementProvider } from '../game-platforms/rawg-achievements.js';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function toResponse(dlc: DlcRecord) {
  return dlcSchema.parse({
    ...dlc,
    estimatedHours: dlc.estimatedHours === null ? null : Number(dlc.estimatedHours),
    playedHours: Number(dlc.playedHours),
    createdAt: dlc.createdAt.toISOString(),
    updatedAt: dlc.updatedAt.toISOString(),
  });
}

export async function registerDlcRoutes(app: FastifyInstance, games: GameRepository, repository: DlcRepository, rawgProvider?: RawgAchievementProvider) {
  app.get<{ Params: { gameId: string } }>('/games/:gameId/dlcs', async (request, reply) => {
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send((await repository.listForGame(request.params.gameId)).map(toResponse));
  });

  app.post<{ Params: { gameId: string } }>('/games/:gameId/dlcs', async (request, reply) => {
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const parsed = dlcInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    return reply.code(201).send(toResponse(await repository.create(request.params.gameId, parsed.data)));
  });

  app.patch<{ Params: { gameId: string; id: string } }>('/games/:gameId/dlcs/:id', async (request, reply) => {
    if (!validId(request.params.gameId) || !validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = dlcUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const updated = await repository.update(request.params.gameId, request.params.id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'DLC não encontrada.' });
    return reply.send(toResponse(updated));
  });

  app.delete<{ Params: { gameId: string; id: string } }>('/games/:gameId/dlcs/:id', async (request, reply) => {
    if (!validId(request.params.gameId) || !validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await repository.delete(request.params.gameId, request.params.id)) return reply.code(404).send({ error: 'DLC não encontrada.' });
    return reply.code(204).send();
  });

  app.get<{ Params: { gameId: string; id: string } }>('/games/:gameId/dlcs/:id/rawg-candidates', async (request, reply) => {
    if (!rawgProvider) return reply.code(503).send({ error: 'Catálogo RAWG indisponível. Configure RAWG_API_KEY.' });
    if (!validId(request.params.gameId) || !validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const dlc = await repository.find(request.params.gameId, request.params.id);
    if (!dlc) return reply.code(404).send({ error: 'DLC não encontrada.' });
    return reply.send((await rawgProvider.search(dlc.name)).map((item) => rawgAchievementCandidateSchema.parse(item)));
  });

  app.put<{ Params: { gameId: string; id: string } }>('/games/:gameId/dlcs/:id/rawg-link', async (request, reply) => {
    if (!validId(request.params.gameId) || !validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = rawgAchievementCandidateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Escolha uma referência RAWG válida.' });
    const updated = await repository.update(request.params.gameId, request.params.id, { rawgId: parsed.data.id, rawgSlug: parsed.data.slug, rawgName: parsed.data.name });
    if (!updated) return reply.code(404).send({ error: 'DLC não encontrada.' });
    return reply.send(toResponse(updated));
  });

  // Catálogo de conquistas da DLC: buscado ao vivo na RAWG pelo rawgId
  // guardado, sem espelho local — é informação de referência, de baixo risco
  // se indisponível por instantes (ao contrário do jogo base, não há fonte de
  // desbloqueio pessoal por DLC hoje).
  app.get<{ Params: { gameId: string; id: string } }>('/games/:gameId/dlcs/:id/achievements', async (request, reply) => {
    if (!validId(request.params.gameId) || !validId(request.params.id)) return reply.code(400).send({ error: 'ID inválido.' });
    const dlc = await repository.find(request.params.gameId, request.params.id);
    if (!dlc) return reply.code(404).send({ error: 'DLC não encontrada.' });
    if (!dlc.rawgId) return reply.send([]);
    if (!rawgProvider) return reply.code(503).send({ error: 'Catálogo RAWG indisponível. Configure RAWG_API_KEY.' });
    try {
      return reply.send((await rawgProvider.achievements(dlc.rawgId)).map((item) => rawgAchievementSchema.parse(item)));
    } catch {
      return reply.code(502).send({ error: 'Não foi possível buscar as conquistas na RAWG.' });
    }
  });
}
