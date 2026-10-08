import type { FastifyInstance } from 'fastify';
import { queueItemSchema, suggestionSchema } from '@gameshelf/contracts';
import { z } from 'zod';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { BacklogRepository } from './repository.js';
import { toGame, toSession } from '../shared/serialize.js';
import { buildSuggestions } from './suggestions.js';

const querySchema = z.object({ timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0) }).strict();

export async function registerSuggestionRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, backlog: BacklogRepository) {
  app.get('/backlog/suggestions', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Parâmetros inválidos.', issues: parsed.error.issues });
    const today = new Date(Date.now() - parsed.data.timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    const [gameRecords, sessionRecords, queueRecords] = await Promise.all([games.list(), sessions.listAll(), backlog.listQueue()]);
    const suggestions = buildSuggestions({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), today,
      queue: queueRecords.map((item) => queueItemSchema.parse({ position: item.position, addedAt: item.addedAt.toISOString(), game: toGame(item.game) })),
    });
    return reply.send(suggestions.map((suggestion) => suggestionSchema.parse(suggestion)));
  });
}
