import type { FastifyInstance } from 'fastify';
import { metadataReviewResponseSchema, metadataSyncRunResultSchema, metadataSearchQuerySchema, metadataUseCandidateInputSchema } from '@gameshelf/contracts';
import { parseId } from '../shared/parse-id.js';
import type { MetadataSyncService } from './service.js';

/** Revisão e execução da captura automática de metadados (ADR-043). */
export async function registerMetadataSyncRoutes(app: FastifyInstance, service: MetadataSyncService) {
  app.get('/metadata-sync/review', async (_request, reply) => reply.send(metadataReviewResponseSchema.parse(await service.review())));

  app.post('/metadata-sync/run', async (_request, reply) => reply.send(metadataSyncRunResultSchema.parse(await service.sweep())));

  app.post<{ Params: { gameId: string } }>('/metadata-sync/:gameId/sync', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    const outcome = await service.syncGame(gameId, { force: true });
    if (outcome === 'SKIPPED') return reply.code(404).send({ error: 'Jogo não encontrado.' });
    if (outcome === 'FAILED') return reply.code(502).send({ error: 'Não foi possível consultar o provedor de metadados.' });
    return reply.send({ outcome });
  });

  app.post<{ Params: { gameId: string } }>('/metadata-sync/:gameId/use', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const body = metadataUseCandidateInputSchema.safeParse(request.body);
    if (!gameId || !body.success) return reply.code(400).send({ error: 'Dados inválidos.' });
    const outcome = await service.useCandidate(gameId, body.data.providerId);
    if (outcome !== 'OK') return reply.code(404).send({ error: outcome === 'GAME_NOT_FOUND' ? 'Jogo não encontrado.' : 'Candidato não encontrado.' });
    return reply.send({ ok: true });
  });

  app.post<{ Params: { gameId: string } }>('/metadata-sync/:gameId/search', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const body = metadataSearchQuerySchema.safeParse(request.body);
    if (!gameId || !body.success) return reply.code(400).send({ error: 'Informe uma busca de 1 a 100 caracteres.' });
    const outcome = await service.searchAgain(gameId, body.data.query);
    if (outcome === 'GAME_NOT_FOUND') return reply.code(404).send({ error: 'Jogo não encontrado.' });
    if (outcome === 'FAILED') return reply.code(502).send({ error: 'Não foi possível buscar metadata externa.' });
    return reply.send({ ok: true });
  });

  for (const [action, run] of [
    ['ignore', (id: string) => service.ignore(id)],
    ['confirm', (id: string) => service.confirm(id)],
    ['undo', (id: string) => service.undo(id)],
  ] as const) {
    app.post<{ Params: { gameId: string } }>(`/metadata-sync/:gameId/${action}`, async (request, reply) => {
      const gameId = parseId(request.params.gameId);
      if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
      if (!await run(gameId)) return reply.code(409).send({ error: 'Esta ação não se aplica ao estado atual do jogo.' });
      return reply.send({ ok: true });
    });
  }
}
