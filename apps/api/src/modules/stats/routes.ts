import type { FastifyInstance } from 'fastify';
import { achievementSeriesQuerySchema, achievementSeriesResponseSchema, activityQuerySchema, activityResponseSchema, replayResponseSchema, statsQuerySchema, statsResponseSchema, timelineQuerySchema, timelineResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import type { ChallengeCompletionRepository } from '../challenge/repository.js';
import type { GamePlatformRepository } from '../game-platforms/repository.js';
import type { PlaythroughRepository } from '../playthroughs/repository.js';
import { toGame, toGamePlatform, toPlaythrough, toSession } from '../shared/serialize.js';
import type { ExternalAchievementRepository } from '../game-platforms/achievement-repository.js';
import { achievementDays } from './achievement-activity.js';
import { buildActivity } from './activity.js';
import { buildReplay } from './replay.js';
import { buildStats } from './service.js';
import { buildTimeline } from './timeline.js';

export async function registerStatsRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, platforms: PlatformRepository, genres: GenreRepository, completions?: ChallengeCompletionRepository, library?: { gamePlatforms: GamePlatformRepository; playthroughs: PlaythroughRepository }, achievements?: ExternalAchievementRepository) {
  app.get('/stats/timeline', async (request, reply) => {
    const parsed = timelineQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros da linha do tempo inválidos.', issues: parsed.error.issues });
    const [gameRecords, sessionRecords, completionRecords, importRecords, unlocks] = await Promise.all([
      games.list(), sessions.listAll(), completions?.listAll() ?? Promise.resolve([]),
      library?.gamePlatforms.listExternalPlaytimeImports() ?? Promise.resolve([]),
      achievements?.listUnlocks() ?? Promise.resolve([]),
    ]);
    return reply.send(timelineResponseSchema.parse(buildTimeline({
      games: gameRecords.map(toGame),
      sessions: sessionRecords.map(toSession),
      completions: completionRecords.map((record) => ({ title: record.title, gamesCount: record.gamesCount, completedAt: record.completedAt.toISOString() })),
      playtimeImports: importRecords.map((record) => ({
        id: record.id,
        gameId: record.gameId,
        platformName: record.platformName,
        source: record.source,
        importedMinutes: record.importedMinutes,
        importedAt: record.importedAt.toISOString(),
        externalLastPlayedAt: record.externalLastPlayedAt?.toISOString() ?? null,
        activityStartedAt: record.activityStartedAt?.toISOString() ?? null,
        activityEndedAt: record.activityEndedAt?.toISOString() ?? null,
        activityDays: record.activityDays,
      })),
      unlocks,
      limit: parsed.data.limit,
      before: parsed.data.before,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
    })));
  });

  app.get('/stats/achievements', async (request, reply) => {
    const parsed = achievementSeriesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros das conquistas inválidos.', issues: parsed.error.issues });
    const days = achievementDays(await (achievements?.listUnlocks() ?? Promise.resolve([])), parsed.data.timezoneOffsetMinutes);
    return reply.send(achievementSeriesResponseSchema.parse({ total: days.reduce((sum, day) => sum + day.count, 0), days }));
  });

  app.get('/stats/replay', async (request, reply) => {
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do replay inválidos.', issues: parsed.error.issues });
    const { timezoneOffsetMinutes } = parsed.data;
    const year = parsed.data.year ?? new Date(Date.now() - timezoneOffsetMinutes * 60_000).getUTCFullYear();
    const [gameRecords, sessionRecords, genreItems, unlocks] = await Promise.all([games.list(), sessions.listAll(), genres.list(), achievements?.listUnlocks() ?? Promise.resolve([])]);
    return reply.send(replayResponseSchema.parse(buildReplay({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), genres: genreItems, year, timezoneOffsetMinutes, unlocks,
    })));
  });

  app.get('/stats/activity', async (request, reply) => {
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros de atividade inválidos.', issues: parsed.error.issues });
    const { timezoneOffsetMinutes } = parsed.data;
    const today = new Date(Date.now() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
    const year = parsed.data.year ?? Number(today.slice(0, 4));
    const [records, unlocks] = await Promise.all([sessions.listAll(), achievements?.listUnlocks() ?? Promise.resolve([])]);
    return reply.send(activityResponseSchema.parse(buildActivity({ sessions: records.map(toSession), year, today, timezoneOffsetMinutes, unlocks })));
  });

  app.get('/stats', async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ message: 'Parâmetros das estatísticas inválidos.', issues: query.error.issues });
    const [gameRecords, sessionRecords, platformItems, genreItems, platformLinks, playthroughRecords] = await Promise.all([
      games.list(), sessions.listAll(), platforms.list(), genres.list(),
      library?.gamePlatforms.listAll() ?? Promise.resolve([]),
      library?.playthroughs.listAll() ?? Promise.resolve([]),
    ]);
    const result = buildStats({
      games: gameRecords.map(toGame),
      sessions: sessionRecords.map(toSession),
      platforms: platformItems, genres: genreItems,
      gamePlatforms: platformLinks.map(toGamePlatform),
      playthroughs: playthroughRecords.map(toPlaythrough),
      ...(query.data.year === undefined ? {} : { year: query.data.year }),
    });
    return reply.send(statsResponseSchema.parse(result));
  });
}
