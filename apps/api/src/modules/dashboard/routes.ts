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
  app.get<{ Querystring: { from?: string; to?: string; timezoneOffsetMinutes?: string } }>('/dashboard', async (request, reply) => {
    const { from, to, timezoneOffsetMinutes } = request.query;
    const offset = timezoneOffsetMinutes === undefined ? 0 : Number(timezoneOffsetMinutes);
    if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to)) || (!!from !== !!to) || (from && to && from > to)
      || !Number.isInteger(offset) || offset < -840 || offset > 840) {
      return reply.code(400).send({ error: 'Informe um período válido com data inicial e final.' });
    }
    const [gameRecords, sessionRecords, queueRecords, weeklyMinutes] = await Promise.all([
      games.list(), sessions.listAll(), backlog.listQueue(), planning.getWeeklyMinutes(),
    ]);
    const gameResponses = gameRecords.map((game) => gameSchema.parse(serializeGame(game)));
    const sessionResponses = sessionRecords.map((session) => sessionSchema.parse(serializeSession(session)));
    const queueResponses = queueRecords.map((item) => queueItemSchema.parse({
      position: item.position, addedAt: item.addedAt.toISOString(), game: serializeGame(item.game),
    }));
    const result = buildDashboard({ games: gameResponses, sessions: sessionResponses, queue: queueResponses, weeklyMinutes, range: { from, to, timezoneOffsetMinutes: offset } });
    return reply.send(dashboardResponseSchema.parse(result));
  });
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function serializeGame(game: Awaited<ReturnType<GameRepository['find']>> extends infer T ? Exclude<T, undefined> : never) {
  return {
    ...game,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    retroactivePlayedHours: Number(game.retroactivePlayedHours ?? 0),
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
