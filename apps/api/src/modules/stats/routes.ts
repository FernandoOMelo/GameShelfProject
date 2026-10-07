import type { FastifyInstance } from 'fastify';
import { gameSchema, sessionSchema, statsResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import { buildStats } from './service.js';

export async function registerStatsRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, platforms: PlatformRepository, genres: GenreRepository) {
  app.get('/stats', async (_request, reply) => {
    const [gameRecords, sessionRecords, platformItems, genreItems] = await Promise.all([games.list(), sessions.listAll(), platforms.list(), genres.list()]);
    const result = buildStats({
      games: gameRecords.map((game) => gameSchema.parse({
        ...game,
        estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
        estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
        personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
        retroactivePlayedHours: Number(game.retroactivePlayedHours ?? 0),
        createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(),
      })),
      sessions: sessionRecords.map((session) => sessionSchema.parse({
        ...session,
        startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
        durationMinutes: session.endedAt === null ? null : Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000),
        createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
      })),
      platforms: platformItems, genres: genreItems,
    });
    return reply.send(statsResponseSchema.parse(result));
  });
}
