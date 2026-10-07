import type { FastifyInstance } from 'fastify';
import { gameMetadataCandidatesSchema, metadataSearchQuerySchema } from '@gameshelf/contracts';
import type { GameMetadataProvider } from './metadata-provider.js';

export async function registerMetadataRoutes(app: FastifyInstance, provider?: GameMetadataProvider) {
  app.get('/metadata/games', async (request, reply) => {
    const parsedQuery = metadataSearchQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) return reply.code(400).send({ error: 'Informe uma busca de 1 a 100 caracteres.' });
    if (!provider) return reply.code(503).send({ error: 'Busca externa indisponível. Configure um provedor de metadata.' });

    try {
      const candidates = await provider.search(parsedQuery.data.query);
      return reply.send(gameMetadataCandidatesSchema.parse(candidates));
    } catch (cause) {
      const diagnostic = cause instanceof Error ? cause.message : 'Unknown provider error';
      request.log.error({ err: diagnostic }, 'Metadata provider request failed');
      const publicError = diagnostic.includes('HTTP 401') || diagnostic.includes('HTTP 403')
        ? 'O IGDB recusou a autenticação. Confira IGDB_CLIENT_ID e IGDB_CLIENT_SECRET e reinicie a API.'
        : diagnostic.includes('HTTP 400')
          ? 'O IGDB recusou a consulta de metadata. Confira os campos solicitados pelo provedor.'
          : 'Não foi possível buscar metadata externa. Consulte o log da API para ver o diagnóstico.';
      return reply.code(502).send({ error: publicError });
    }
  });
}
