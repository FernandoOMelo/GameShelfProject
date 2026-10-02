import type { FastifyInstance } from 'fastify';
import { platformInputSchema, platformSchema } from '@gameshelf/contracts';
import type { PlatformRepository } from './repository.js';

export async function registerPlatformRoutes(app: FastifyInstance, repository: PlatformRepository) {
  app.get('/platforms', async (_request, reply) => {
    const platforms = await repository.list();
    return reply.send(platforms.map((platform) => platformSchema.parse(platform)));
  });

  app.post('/platforms', async (request, reply) => {
    const parsed = platformInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o nome da plataforma.', issues: parsed.error.issues });
    try {
      return reply.code(201).send(platformSchema.parse(await repository.create(parsed.data.name)));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma plataforma com esse nome.' });
      throw error;
    }
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
