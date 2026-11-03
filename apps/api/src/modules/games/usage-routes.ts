import type { FastifyInstance } from 'fastify';
import { gameUsageSchema } from '@gameshelf/contracts';
import type { GameRepository } from './repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { GamePlatformRepository } from '../game-platforms/repository.js';
import type { ExternalAchievementRepository } from '../game-platforms/achievement-repository.js';
import { buildGameUsage } from './usage.js';
import { toSession } from '../shared/serialize.js';

export async function registerGameUsageRoutes(
  app: FastifyInstance,
  games: GameRepository,
  sessions: SessionRepository,
  gamePlatforms: GamePlatformRepository,
  achievements?: ExternalAchievementRepository,
) {
  app.get('/games/usage', async (_request, reply) => {
    const [gameRecords, sessionRecords, links, counts] = await Promise.all([
      games.list(), sessions.listAll(), gamePlatforms.listAll(), achievements?.countsByGamePlatform() ?? Promise.resolve(new Map<string, { total: number; unlocked: number }>()),
    ]);
    return reply.send(buildGameUsage({ games: gameRecords, sessions: sessionRecords.map(toSession), links, counts }).map((item) => gameUsageSchema.parse(item)));
  });
}
