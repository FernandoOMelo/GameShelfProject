import type { FastifyInstance } from 'fastify';
import { gameTimeEstimatesSchema, metadataSearchQuerySchema } from '@gameshelf/contracts';
import type { GameTimeEstimateProvider } from './time-estimate-provider.js';

export async function registerTimeEstimateRoutes(app: FastifyInstance, provider?: GameTimeEstimateProvider) {
  app.get('/metadata/time-estimates', async (request, reply) => {
    const parsedQuery = metadataSearchQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) return reply.code(400).send({ error: 'Informe uma busca de 1 a 100 caracteres.' });
    if (!provider) return reply.code(503).send({ error: 'Busca de estimativas indisponível. Configure um provedor de estimativas.' });

    try {
      const candidates = await provider.search(parsedQuery.data.query);
      return reply.send(gameTimeEstimatesSchema.parse(candidates));
    } catch (cause) {
      const diagnostic = cause instanceof Error ? cause.message : 'Unknown provider error';
      request.log.error({ err: diagnostic }, 'Time estimate provider request failed');
      return reply.code(502).send({ error: 'Não foi possível buscar estimativas no HowLongToBeat. Consulte o log da API para ver o diagnóstico.' });
    }
  });
}
