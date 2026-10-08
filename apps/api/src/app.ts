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
import type { GameMetadataProvider } from './modules/games/metadata-provider.js';
import { registerMetadataRoutes } from './modules/games/metadata-routes.js';
import type { GameImageStorage } from './modules/games/image-storage.js';
import { registerMediaRoutes } from './modules/games/media-routes.js';
import type { GameListRepository } from './modules/game-lists/repository.js';
import { registerGameListRoutes } from './modules/game-lists/routes.js';
import { registerSuggestionRoutes } from './modules/backlog/suggestions-routes.js';
import type { GoalRepository } from './modules/goals/repository.js';
import { registerGoalRoutes } from './modules/goals/routes.js';
import type { ScreenshotRepository } from './modules/sessions/screenshot-repository.js';
import { registerScreenshotRoutes } from './modules/sessions/screenshot-routes.js';
import { registerStatsRoutes } from './modules/stats/routes.js';
import type { MainChallengeRepository } from './modules/challenge/repository.js';
import { registerChallengeRoutes } from './modules/challenge/routes.js';

export function buildApp(options: { gameRepository?: GameRepository; gameListRepository?: GameListRepository; mainChallengeRepository?: MainChallengeRepository; goalRepository?: GoalRepository; screenshotRepository?: ScreenshotRepository; franchiseRepository?: FranchiseRepository; platformRepository?: PlatformRepository; genreRepository?: GenreRepository; sessionRepository?: SessionRepository; backlogRepository?: BacklogRepository; planningSettingsRepository?: PlanningSettingsRepository; metadataProvider?: GameMetadataProvider; imageStorage?: GameImageStorage; webOrigin?: string } = {}) {
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

  app.register((instance) => registerMetadataRoutes(instance, options.metadataProvider));

  if (options.gameRepository) app.register((instance) => registerGameRoutes(instance, options.gameRepository!, options.imageStorage, options.backlogRepository, options.screenshotRepository));
  if (options.gameRepository && options.gameListRepository) app.register((instance) => registerGameListRoutes(instance, options.gameRepository!, options.gameListRepository!));
  if (options.imageStorage) app.register((instance) => registerMediaRoutes(instance, options.imageStorage!));
  if (options.franchiseRepository) app.register((instance) => registerFranchiseRoutes(instance, options.franchiseRepository!));
  if (options.platformRepository) app.register((instance) => registerPlatformRoutes(instance, options.platformRepository!));
  if (options.genreRepository) app.register((instance) => registerGenreRoutes(instance, options.genreRepository!));
  if (options.gameRepository && options.sessionRepository) {
    app.register((instance) => registerSessionRoutes(instance, options.gameRepository!, options.sessionRepository!, options.screenshotRepository && options.imageStorage ? { screenshots: options.screenshotRepository, storage: options.imageStorage } : undefined));
  }
  if (options.gameRepository && options.backlogRepository) {
    app.register((instance) => registerBacklogRoutes(instance, options.gameRepository!, options.backlogRepository!, options.gameListRepository));
  }
  if (options.gameRepository && options.sessionRepository && options.backlogRepository) {
    app.register((instance) => registerSuggestionRoutes(instance, options.gameRepository!, options.sessionRepository!, options.backlogRepository!));
  }
  if (options.planningSettingsRepository) app.register((instance) => registerPlanningRoutes(instance, options.planningSettingsRepository!));
  if (options.gameRepository && options.sessionRepository && options.backlogRepository && options.planningSettingsRepository) {
    app.register((instance) => registerDashboardRoutes(instance, options.gameRepository!, options.sessionRepository!, options.backlogRepository!, options.planningSettingsRepository!));
  }
  if (options.gameRepository && options.sessionRepository && options.platformRepository && options.genreRepository) {
    app.register((instance) => registerStatsRoutes(instance, options.gameRepository!, options.sessionRepository!, options.platformRepository!, options.genreRepository!));
  }
  if (options.gameRepository && options.gameListRepository && options.mainChallengeRepository) {
    app.register((instance) => registerChallengeRoutes(instance, options.gameRepository!, options.gameListRepository!, options.mainChallengeRepository!));
  }

  if (options.gameRepository && options.sessionRepository && options.screenshotRepository && options.imageStorage) {
    app.register((instance) => registerScreenshotRoutes(instance, options.gameRepository!, options.sessionRepository!, options.screenshotRepository!, options.imageStorage!));
  }
  if (options.gameRepository && options.sessionRepository && options.goalRepository) {
    app.register((instance) => registerGoalRoutes(instance, options.gameRepository!, options.sessionRepository!, options.goalRepository!));
  }

  return app;
}
