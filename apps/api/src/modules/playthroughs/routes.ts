import type { FastifyInstance } from 'fastify';
import { playthroughInputSchema, playthroughMetricsSchema, playthroughSchema, playthroughUpdateSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import { parseId } from '../shared/parse-id.js';
import { toPlaythrough } from '../shared/serialize.js';
import type { PlaythroughRepository } from './repository.js';
import { buildMetrics, checkTransition } from './service.js';

export async function registerPlaythroughRoutes(
  app: FastifyInstance,
  games: GameRepository,
  platforms: PlatformRepository,
  repository: PlaythroughRepository,
  sessions?: SessionRepository,
) {
  app.get<{ Params: { gameId: string } }>('/games/:gameId/playthroughs', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const records = await repository.listForGame(gameId);
    return reply.send(records.map((record) => playthroughSchema.parse(toPlaythrough(record))));
  });

  app.get<{ Params: { gameId: string } }>('/games/:gameId/playthroughs/metrics', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const records = await repository.listForGame(gameId);
    return reply.send(playthroughMetricsSchema.parse(buildMetrics(records)));
  });

  // Criar uma jornada nunca duplica o jogo canônico: a nova jornada apenas
  // recebe a próxima posição na ordenação do mesmo jogo.
  app.post<{ Params: { gameId: string } }>('/games/:gameId/playthroughs', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const parsed = playthroughInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados da jornada inválidos.', issues: parsed.error.issues });
    const platformError = await validatePlatform(platforms, parsed.data.primaryPlatformId);
    if (platformError) return reply.code(400).send({ error: platformError });
    const record = await repository.create(gameId, parsed.data);
    return reply.code(201).send(playthroughSchema.parse(toPlaythrough(record)));
  });

  app.patch<{ Params: { gameId: string; id: string } }>('/games/:gameId/playthroughs/:id', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    const patch = playthroughUpdateSchema.safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: 'Dados da jornada inválidos.', issues: patch.error.issues });
    const existing = await repository.find(gameId, id);
    if (!existing) return reply.code(404).send({ error: 'Jornada não encontrada.' });
    const platformError = await validatePlatform(platforms, patch.data.primaryPlatformId);
    if (platformError) return reply.code(400).send({ error: platformError });

    const nextStatus = patch.data.status ?? existing.status;
    const transitionError = checkTransition(existing.status, nextStatus);
    if (transitionError) return reply.code(409).send({ error: transitionError });

    // Reabrir uma jornada concluída é explícito: a data de conclusão é limpa
    // junto, para que a jornada não continue contando como concluída.
    const reopened = existing.status === 'COMPLETED' && nextStatus === 'PLAYING' && patch.data.completedAt === undefined;
    const merged = playthroughInputSchema.safeParse({
      label: existing.label,
      status: existing.status,
      primaryPlatformId: existing.primaryPlatformId,
      startedAt: existing.startedAt,
      completedAt: reopened ? null : existing.completedAt,
      notes: existing.notes,
      ...patch.data,
    });
    if (!merged.success) return reply.code(400).send({ error: 'A jornada resultante possui dados inválidos.', issues: merged.error.issues });
    const record = await repository.update(gameId, id, merged.data);
    if (!record) return reply.code(404).send({ error: 'Jornada não encontrada.' });
    return reply.send(playthroughSchema.parse(toPlaythrough(record)));
  });

  // Excluir a jornada não apaga o histórico: as sessões vinculadas ficam sem
  // jornada, preservando duração, datas e anotações.
  app.delete<{ Params: { gameId: string; id: string } }>('/games/:gameId/playthroughs/:id', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await repository.find(gameId, id)) return reply.code(404).send({ error: 'Jornada não encontrada.' });
    if (sessions) await sessions.detachPlaythrough(id);
    if (!await repository.delete(gameId, id)) return reply.code(404).send({ error: 'Jornada não encontrada.' });
    return reply.code(204).send();
  });
}

async function validatePlatform(platforms: PlatformRepository, platformId: string | null | undefined): Promise<string | undefined> {
  if (!platformId) return undefined;
  return (await platforms.list()).some((platform) => platform.id === platformId) ? undefined : 'Plataforma não encontrada.';
}
