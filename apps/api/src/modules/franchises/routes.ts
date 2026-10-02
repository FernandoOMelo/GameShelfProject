import type { FastifyInstance } from 'fastify';
import { franchiseInputSchema, franchiseSchema } from '@gameshelf/contracts';
import type { FranchiseRepository } from './repository.js';

export async function registerFranchiseRoutes(app: FastifyInstance, repository: FranchiseRepository) {
  app.get('/franchises', async (_request, reply) => {
    const franchises = await repository.list();
    return reply.send(franchises.map((franchise) => franchiseSchema.parse(franchise)));
  });

  app.post('/franchises', async (request, reply) => {
    const parsed = franchiseInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o nome da franquia.', issues: parsed.error.issues });
    try {
      const franchise = await repository.create(parsed.data.name);
      return reply.code(201).send(franchiseSchema.parse(franchise));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma franquia com esse nome.' });
      throw error;
    }
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
