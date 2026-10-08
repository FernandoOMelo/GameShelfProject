import type { FastifyInstance } from 'fastify';
import { activityQuerySchema, activityResponseSchema, replayResponseSchema, statsResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import { toGame, toSession } from '../shared/serialize.js';
import { buildActivity } from './activity.js';
import { buildReplay } from './replay.js';
import { buildStats } from './service.js';

export async function registerStatsRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, platforms: PlatformRepository, genres: GenreRepository) {
  app.get('/stats/replay', async (request, reply) => {
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do replay inválidos.', issues: parsed.error.issues });
    const { timezoneOffsetMinutes } = parsed.data;
    const year = parsed.data.year ?? new Date(Date.now() - timezoneOffsetMinutes * 60_000).getUTCFullYear();
    const [gameRecords, sessionRecords, genreItems] = await Promise.all([games.list(), sessions.listAll(), genres.list()]);
    return reply.send(replayResponseSchema.parse(buildReplay({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), genres: genreItems, year, timezoneOffsetMinutes,
    })));
  });

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
      games: gameRecords.map(toGame),
      sessions: sessionRecords.map(toSession),
      platforms: platformItems, genres: genreItems,
    });
    return reply.send(statsResponseSchema.parse(result));
  });
}
