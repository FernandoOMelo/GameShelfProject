import type { FastifyInstance } from 'fastify';
import { integrationHealthSchema } from '@gameshelf/contracts';
import type { IntegrationHealthTracker } from './health.js';

export async function registerIntegrationHealthRoutes(app: FastifyInstance, tracker: IntegrationHealthTracker) {
  app.get('/integrations/health', async (_request, reply) => reply.send(tracker.snapshot().map((item) => integrationHealthSchema.parse(item))));

  app.post<{ Params: { key: string } }>('/integrations/health/:key/test', async (request, reply) => {
    const key = request.params.key;
    if (key !== 'igdb' && key !== 'rawg' && key !== 'achievist') return reply.code(404).send({ error: 'Integração desconhecida.' });
    const result = await tracker.test(key);
    if (!result) return reply.code(404).send({ error: 'Integração desconhecida.' });
    return reply.send(integrationHealthSchema.parse(result));
  });
}
