import type { FastifyInstance } from 'fastify';
import { comparisonReportQuerySchema, comparisonReportSchema, achievementsReportQuerySchema, achievementsReportSchema, backlogReportSchema, completionsReportQuerySchema, completionsReportSchema, playtimeReportQuerySchema, playtimeReportSchema, playthroughsReportQuerySchema, playthroughsReportSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GenreRepository } from '../genres/repository.js';
import type { PlaythroughRepository } from '../playthroughs/repository.js';
import type { GamePlatformRepository } from '../game-platforms/repository.js';
import type { ExternalAchievementRepository } from '../game-platforms/achievement-repository.js';
import { buildAchievementsReport } from './achievements.js';
import { toGame, toPlaythrough, toSession } from '../shared/serialize.js';
import { buildBacklogReport } from './backlog.js';
import { buildComparisonReport } from './comparison.js';
import { buildCompletionsReport } from './completions.js';
import { buildPlaythroughsReport } from './playthroughs.js';
import { buildPlaytimeReport } from './playtime.js';

/** Cada relatório tem a própria rota e os próprios filtros (ADR-041). */
export async function registerReportRoutes(app: FastifyInstance, games: GameRepository, sessions: SessionRepository, platforms: PlatformRepository, genres: GenreRepository, playthroughs?: PlaythroughRepository, achievements?: { gamePlatforms: GamePlatformRepository; store: ExternalAchievementRepository }) {
  app.get('/reports/playtime', async (request, reply) => {
    const parsed = playtimeReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do relatório de tempo de jogo inválidos.', issues: parsed.error.issues });
    const [gameRecords, sessionRecords, platformItems, genreItems] = await Promise.all([games.list(), sessions.listAll(), platforms.list(), genres.list()]);
    return reply.send(playtimeReportSchema.parse(buildPlaytimeReport({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), platforms: platformItems, genres: genreItems, ...parsed.data,
    })));
  });

  app.get('/reports/completions', async (request, reply) => {
    const parsed = completionsReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do relatório de conclusões inválidos.', issues: parsed.error.issues });
    const [gameRecords, sessionRecords] = await Promise.all([games.list(), sessions.listAll()]);
    const { from, to, reference, sort, page, pageSize } = parsed.data;
    return reply.send(completionsReportSchema.parse(buildCompletionsReport({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), reference, sort, page, pageSize,
      ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }),
    })));
  });

  app.get('/reports/backlog', async (_request, reply) => {
    const [gameRecords, sessionRecords, platformItems, genreItems] = await Promise.all([games.list(), sessions.listAll(), platforms.list(), genres.list()]);
    return reply.send(backlogReportSchema.parse(buildBacklogReport({ games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), platforms: platformItems, genres: genreItems })));
  });

  app.get('/reports/comparison', async (request, reply) => {
    const parsed = comparisonReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do comparativo inválidos.', issues: parsed.error.issues });
    const { aFrom, aTo, bFrom, bTo, timezoneOffsetMinutes } = parsed.data;
    const [gameRecords, sessionRecords, journeyRecords, unlocks] = await Promise.all([
      games.list(), sessions.listAll(), playthroughs?.listAll() ?? Promise.resolve([]), achievements?.store.listUnlocks() ?? Promise.resolve(undefined),
    ]);
    return reply.send(comparisonReportSchema.parse(buildComparisonReport({
      games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), playthroughs: journeyRecords.map(toPlaythrough), timezoneOffsetMinutes,
      a: { from: aFrom, to: aTo }, b: { from: bFrom, to: bTo }, ...(unlocks === undefined ? {} : { unlocks }),
    })));
  });

  if (achievements) {
    app.get('/reports/achievements', async (request, reply) => {
      const parsed = achievementsReportQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do relatório de conquistas inválidos.', issues: parsed.error.issues });
      const [gameRecords, platformItems, links, unlocks, totals] = await Promise.all([
        games.list(), platforms.list(), achievements.gamePlatforms.listAll(), achievements.store.listUnlocks(), achievements.store.countsByGamePlatform(),
      ]);
      const { from, to, timezoneOffsetMinutes } = parsed.data;
      return reply.send(achievementsReportSchema.parse(buildAchievementsReport({
        games: gameRecords.map(toGame), platforms: platformItems, unlocks, timezoneOffsetMinutes,
        counts: links.flatMap((link) => { const count = totals.get(link.id); return count ? [{ gameId: link.gameId, ...count }] : []; }),
        ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }),
      })));
    });
  }

  if (playthroughs) {
    app.get('/reports/playthroughs', async (request, reply) => {
      const parsed = playthroughsReportQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ message: 'Parâmetros do relatório de jornadas inválidos.', issues: parsed.error.issues });
      const [gameRecords, sessionRecords, journeyRecords, platformItems] = await Promise.all([games.list(), sessions.listAll(), playthroughs.listAll(), platforms.list()]);
      const { from, to } = parsed.data;
      return reply.send(playthroughsReportSchema.parse(buildPlaythroughsReport({
        games: gameRecords.map(toGame), sessions: sessionRecords.map(toSession), playthroughs: journeyRecords.map(toPlaythrough), platforms: platformItems,
        ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }),
      })));
    });
  }
}
