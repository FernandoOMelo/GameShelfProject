import type { FastifyInstance } from 'fastify';
import { platformInputSchema, platformSchema, platformSummariesSchema, platformUpdateSchema } from '@gameshelf/contracts';
import type { PlatformRepository } from './repository.js';
import { parseId } from '../shared/parse-id.js';
import { checkParent, checkRemovable } from './service.js';
import { platformPresentation } from './catalog.js';

export async function registerPlatformRoutes(app: FastifyInstance, repository: PlatformRepository) {
  app.get('/platforms', async (_request, reply) => {
    const platforms = await repository.list();
    return reply.send(platforms.map((platform) => platformSchema.parse(platform)));
  });

  app.get('/platforms/summaries', async (_request, reply) => {
    const summaries = await repository.listSummaries();
    return reply.send(platformSummariesSchema.parse(summaries));
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
      return reply.code(201).send(platformSchema.parse(await repository.create(parsed.data.name, parsed.data.parentId ?? null, platformPresentation(parsed.data.name))));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma plataforma com esse nome.' });
      throw error;
    }
  });

  // Renomear e/ou mudar o grupo de uma plataforma existente (ADR-025 e
  // ADR-029). Nada é mesclado: as associações, sessões e jornadas continuam
  // apontando para a mesma plataforma.
  app.patch<{ Params: { id: string } }>('/platforms/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = platformUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    if (parsed.data.name === undefined && parsed.data.parentId === undefined) {
      return reply.code(400).send({ error: 'Informe o nome ou o grupo da plataforma.' });
    }
    const catalog = await repository.list();
    const platform = catalog.find((item) => item.id === id);
    if (!platform) return reply.code(404).send({ error: 'Plataforma não encontrada.' });
    if (parsed.data.parentId !== undefined) {
      const problem = checkParent(platform, parsed.data.parentId, catalog);
      if (problem) return reply.code(409).send({ error: problem });
    }
    try {
      let updated = platform;
      if (parsed.data.name !== undefined) updated = await repository.rename(id, parsed.data.name) ?? updated;
      if (parsed.data.parentId !== undefined) updated = await repository.setParent(id, parsed.data.parentId) ?? updated;
      return reply.send(platformSchema.parse(updated));
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Já existe uma plataforma com esse nome.' });
      throw error;
    }
  });

  // Exclusão com regra de domínio (ADR-029): nada fica órfão — plataforma com
  // jogos vinculados ou que é grupo de outras não pode ser excluída.
  app.delete<{ Params: { id: string } }>('/platforms/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const catalog = await repository.list();
    const platform = catalog.find((item) => item.id === id);
    if (!platform) return reply.code(404).send({ error: 'Plataforma não encontrada.' });
    const removable = checkRemovable(platform, catalog);
    if (removable) return reply.code(409).send({ error: removable });
    const links = await repository.countGameLinks(id);
    if (links > 0) {
      return reply.code(409).send({ error: links === 1 ? 'Um jogo usa esta plataforma: remova o vínculo antes de excluí-la.' : `${links} jogos usam esta plataforma: remova os vínculos antes de excluí-la.` });
    }
    const removed = await repository.remove(id);
    if (!removed) return reply.code(404).send({ error: 'Plataforma não encontrada.' });
    return reply.code(204).send();
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
