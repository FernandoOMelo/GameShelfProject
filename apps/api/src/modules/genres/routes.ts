import type { FastifyInstance } from 'fastify';
import { genreInputSchema, genreSchema } from '@gameshelf/contracts';
import type { GenreRepository } from './repository.js';

export async function registerGenreRoutes(app: FastifyInstance, repository: GenreRepository) {
  app.get('/genres', async (_request, reply) => {
    const genres = await repository.list();
    return reply.send(genres.map((genre) => genreSchema.parse(genre)));
  });

  app.post('/genres', async (request, reply) => {
    const parsed = genreInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o nome do gênero.', issues: parsed.error.issues });
    try {
      return reply.code(201).send(genreSchema.parse(await repository.create(parsed.data.name)));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe um gênero com esse nome.' });
      throw error;
    }
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
