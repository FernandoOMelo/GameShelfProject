import type { FastifyInstance } from 'fastify';
import { duplicateGameGroupSchema, gameMergeInputSchema, gameSchema } from '@gameshelf/contracts';
import { parseId } from '../shared/parse-id.js';
import { toResponse } from './routes.js';
import { findDuplicateGroups, type GameMergeRepository } from './merge.js';
import type { GameRepository } from './repository.js';
import type { BacklogRepository } from '../backlog/repository.js';

export async function registerGameMergeRoutes(app: FastifyInstance, repository: GameRepository, merger: GameMergeRepository, backlog?: BacklogRepository) {
  // Sugestões, não ações: o usuário decide o que mesclar.
  app.get('/games/duplicates', async (_request, reply) => {
    const groups = findDuplicateGroups(await repository.list());
    return reply.send(groups.map((group) => duplicateGameGroupSchema.parse(group)));
  });

  app.post<{ Params: { id: string } }>('/games/:id/merge', async (request, reply) => {
    const targetId = parseId(request.params.id);
    if (!targetId) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = gameMergeInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Informe o jogo a ser mesclado.', issues: parsed.error.issues });
    if (parsed.data.sourceGameId === targetId) return reply.code(400).send({ error: 'Escolha um jogo diferente para mesclar.' });
    if (!await merger.merge(targetId, parsed.data.sourceGameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const merged = await repository.find(targetId);
    if (!merged) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    if (backlog && (!merged.owned || merged.archived || merged.status === 'COMPLETED' || merged.status === 'ABANDONED')) await backlog.removeFromQueue(targetId);
    return reply.send(gameSchema.parse(toResponse(merged)));
  });
}
