import type { FastifyInstance } from 'fastify';
import { activityQuerySchema, activityResponseSchema, gameSchema, sessionSchema, statsResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import { buildActivity } from './activity.js';
import { buildStats } from './service.js';

type SessionRecord = Awaited<ReturnType<SessionRepository['listAll']>>[number];

function toSession(session: SessionRecord) {
  return sessionSchema.parse({
    ...session,
    startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
    durationMinutes: session.endedAt === null ? null : Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000),
    createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
  });
}

export async function registerStatsRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, platforms: PlatformRepository, genres: GenreRepository) {
  app.get('/stats/activity', async (request, reply) => {
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros de atividade inválidos.', issues: parsed.error.issues });
    const { timezoneOffsetMinutes } = parsed.data;
    const today = new Date(Date.now() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    const year = parsed.data.year ?? Number(today.slice(0, 4));
    const records = await sessions.listAll();
    return reply.send(activityResponseSchema.parse(buildActivity({ sessions: records.map(toSession), year, today, timezoneOffsetMinutes })));
  });

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
      sessions: sessionRecords.map(toSession),
      platforms: platformItems, genres: genreItems,
    });
    return reply.send(statsResponseSchema.parse(result));
  });
}
