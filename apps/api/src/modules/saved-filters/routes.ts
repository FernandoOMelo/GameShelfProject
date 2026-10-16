import type { FastifyInstance } from 'fastify';
import { savedFilterInputSchema, savedFilterSchema, savedFilterUpdateSchema } from '@gameshelf/contracts';
import type { SavedFilterRecord, SavedFilterRepository } from './repository.js';

export async function registerSavedFilterRoutes(app: FastifyInstance, filters: SavedFilterRepository) {
  app.get('/saved-filters', async (_request, reply) => {
    const records = await filters.list();
    return reply.send(records.map((record) => savedFilterSchema.parse(toResponse(record))));
  });

  app.post('/saved-filters', async (request, reply) => {
    const parsed = savedFilterInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Filtro inválido.', issues: parsed.error.issues });
    try {
      const record = await filters.create(parsed.data.name, parsed.data.filters);
      return reply.code(201).send(savedFilterSchema.parse(toResponse(record)));
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Já existe um filtro com esse nome.' });
      throw error;
    }
  });

  app.patch<{ Params: { filterId: string } }>('/saved-filters/:filterId', async (request, reply) => {
    const filterId = parseId(request.params.filterId);
    if (!filterId) return reply.code(400).send({ error: 'ID de filtro inválido.' });
    const parsed = savedFilterUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Filtro inválido.', issues: parsed.error.issues });
    try {
      const record = await filters.update(filterId, parsed.data);
      return record ? reply.send(savedFilterSchema.parse(toResponse(record))) : reply.code(404).send({ error: 'Filtro não encontrado.' });
    } catch (error) {
      if (isDuplicateKey(error)) return reply.code(409).send({ error: 'Já existe um filtro com esse nome.' });
      throw error;
    }
  });

  app.delete<{ Params: { filterId: string } }>('/saved-filters/:filterId', async (request, reply) => {
    const filterId = parseId(request.params.filterId);
    if (!filterId) return reply.code(400).send({ error: 'ID de filtro inválido.' });
    if (!await filters.delete(filterId)) return reply.code(404).send({ error: 'Filtro não encontrado.' });
    return reply.code(204).send();
  });
}

function toResponse(record: SavedFilterRecord) {
  return {
    id: record.id,
    name: record.name,
    filters: record.filters,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parseId(value: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
