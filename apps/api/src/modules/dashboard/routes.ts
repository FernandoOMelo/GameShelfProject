import type { FastifyInstance } from 'fastify';
import { dashboardResponseSchema, gameSchema, queueItemSchema, sessionSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { BacklogRepository } from '../backlog/repository.js';
import type { PlanningSettingsRepository } from '../planning/repository.js';
import { buildDashboard } from './service.js';

export async function registerDashboardRoutes(
  app: FastifyInstance,
  games: GameRepository,
  sessions: SessionRepository,
  backlog: BacklogRepository,
  planning: PlanningSettingsRepository,
) {
  app.get('/dashboard', async (_request, reply) => {
    const [gameRecords, sessionRecords, queueRecords, weeklyMinutes] = await Promise.all([
      games.list(), sessions.listAll(), backlog.listQueue(), planning.getWeeklyMinutes(),
    ]);
    const gameResponses = gameRecords.map((game) => gameSchema.parse(serializeGame(game)));
    const sessionResponses = sessionRecords.map((session) => sessionSchema.parse(serializeSession(session)));
    const queueResponses = queueRecords.map((item) => queueItemSchema.parse({
      position: item.position, addedAt: item.addedAt.toISOString(), game: serializeGame(item.game),
    }));
    const result = buildDashboard({ games: gameResponses, sessions: sessionResponses, queue: queueResponses, weeklyMinutes });
    return reply.send(dashboardResponseSchema.parse(result));
  });
}

function serializeGame(game: Awaited<ReturnType<GameRepository['find']>> extends infer T ? Exclude<T, undefined> : never) {
  return {
    ...game,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(),
  };
}

function serializeSession(session: Awaited<ReturnType<SessionRepository['listAll']>>[number]) {
  return {
    ...session,
    startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
    durationMinutes: session.endedAt === null ? null : Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000),
    createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
  };
}
