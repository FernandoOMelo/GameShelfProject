import type { FastifyInstance } from 'fastify';
import { platformInputSchema, platformSchema, platformUpdateSchema } from '@gameshelf/contracts';
import type { PlatformRepository } from './repository.js';
import { parseId } from '../shared/parse-id.js';
import { checkParent } from './service.js';

export async function registerPlatformRoutes(app: FastifyInstance, repository: PlatformRepository) {
  app.get('/platforms', async (_request, reply) => {
    const platforms = await repository.list();
    return reply.send(platforms.map((platform) => platformSchema.parse(platform)));
  });

  app.post('/platforms', async (request, reply) => {
    const parsed = platformInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o nome da plataforma.', issues: parsed.error.issues });
    try {
      if (parsed.data.parentId) {
        const catalog = await repository.list();
        const parent = catalog.find((item) => item.id === parsed.data.parentId);
        if (!parent) return reply.code(400).send({ error: 'Grupo não encontrado.' });
        if (parent.parentId !== null) return reply.code(400).send({ error: 'O grupo escolhido já pertence a outro grupo: o catálogo tem apenas dois níveis.' });
      }
      return reply.code(201).send(platformSchema.parse(await repository.create(parsed.data.name, parsed.data.parentId ?? null)));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma plataforma com esse nome.' });
      throw error;
    }
  });

  // Definir ou remover o grupo de uma plataforma existente. Nada é renomeado nem
  // mesclado: as associações, sessões e jornadas continuam apontando para a
  // mesma plataforma, que apenas passa a pertencer a um grupo.
  app.patch<{ Params: { id: string } }>('/platforms/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = platformUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const catalog = await repository.list();
    const platform = catalog.find((item) => item.id === id);
    if (!platform) return reply.code(404).send({ error: 'Plataforma não encontrada.' });
    const problem = checkParent(platform, parsed.data.parentId, catalog);
    if (problem) return reply.code(409).send({ error: problem });
    const updated = await repository.setParent(id, parsed.data.parentId);
    if (!updated) return reply.code(404).send({ error: 'Plataforma não encontrada.' });
    return reply.send(platformSchema.parse(updated));
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
