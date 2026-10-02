import Fastify from 'fastify';
import { healthResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from './modules/games/repository.js';
import { registerGameRoutes } from './modules/games/routes.js';
import type { FranchiseRepository } from './modules/franchises/repository.js';
import { registerFranchiseRoutes } from './modules/franchises/routes.js';
import type { PlatformRepository } from './modules/platforms/repository.js';
import { registerPlatformRoutes } from './modules/platforms/routes.js';
import type { GenreRepository } from './modules/genres/repository.js';
import { registerGenreRoutes } from './modules/genres/routes.js';
import type { SessionRepository } from './modules/sessions/repository.js';
import { registerSessionRoutes } from './modules/sessions/routes.js';
import type { BacklogRepository } from './modules/backlog/repository.js';
import { registerBacklogRoutes } from './modules/backlog/routes.js';
import type { PlanningSettingsRepository } from './modules/planning/repository.js';
import { registerPlanningRoutes } from './modules/planning/routes.js';
import { registerDashboardRoutes } from './modules/dashboard/routes.js';

export function buildApp(options: { gameRepository?: GameRepository; franchiseRepository?: FranchiseRepository; platformRepository?: PlatformRepository; genreRepository?: GenreRepository; sessionRepository?: SessionRepository; backlogRepository?: BacklogRepository; planningSettingsRepository?: PlanningSettingsRepository; webOrigin?: string } = {}) {
  const app = Fastify({ logger: true });
  const webOrigin = options.webOrigin ?? 'http://localhost:5173';
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === webOrigin) {
      reply.header('access-control-allow-origin', webOrigin);
      reply.header('vary', 'Origin');
      reply.header('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      reply.header('access-control-allow-headers', 'content-type');
    }
    if (request.method === 'OPTIONS') {
      return reply.code(origin === webOrigin ? 204 : 403).send();
    }
  });

  app.get('/health', async (_request, reply) => {
    const body = healthResponseSchema.parse({ status: 'ok', service: 'gameshelf-api' });
    return reply.code(200).send(body);
  });

  if (options.gameRepository) app.register((instance) => registerGameRoutes(instance, options.gameRepository!));
  if (options.franchiseRepository) app.register((instance) => registerFranchiseRoutes(instance, options.franchiseRepository!));
  if (options.platformRepository) app.register((instance) => registerPlatformRoutes(instance, options.platformRepository!));
  if (options.genreRepository) app.register((instance) => registerGenreRoutes(instance, options.genreRepository!));
  if (options.gameRepository && options.sessionRepository) {
    app.register((instance) => registerSessionRoutes(instance, options.gameRepository!, options.sessionRepository!));
  }
  if (options.gameRepository && options.backlogRepository) {
    app.register((instance) => registerBacklogRoutes(instance, options.gameRepository!, options.backlogRepository!));
  }
  if (options.planningSettingsRepository) app.register((instance) => registerPlanningRoutes(instance, options.planningSettingsRepository!));
  if (options.gameRepository && options.sessionRepository && options.backlogRepository && options.planningSettingsRepository) {
    app.register((instance) => registerDashboardRoutes(instance, options.gameRepository!, options.sessionRepository!, options.backlogRepository!, options.planningSettingsRepository!));
  }

  return app;
}
