import './config/load-env.js';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createDatabase } from '@gameshelf/database';
import { DrizzleGameRepository } from './modules/games/drizzle-game-repository.js';
import { DrizzleFranchiseRepository } from './modules/franchises/drizzle-franchise-repository.js';
import { DrizzlePlatformRepository } from './modules/platforms/drizzle-platform-repository.js';
import { DrizzleGenreRepository } from './modules/genres/drizzle-genre-repository.js';
import { DrizzleSessionRepository } from './modules/sessions/drizzle-session-repository.js';
import { DrizzleBacklogRepository } from './modules/backlog/drizzle-backlog-repository.js';
import { DrizzlePlanningSettingsRepository } from './modules/planning/drizzle-planning-settings-repository.js';

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatória para iniciar a API.');
}

const database = createDatabase(env.DATABASE_URL);
const app = buildApp({
  gameRepository: new DrizzleGameRepository(database.db),
  franchiseRepository: new DrizzleFranchiseRepository(database.db),
  platformRepository: new DrizzlePlatformRepository(database.db),
  genreRepository: new DrizzleGenreRepository(database.db),
  sessionRepository: new DrizzleSessionRepository(database.db),
  backlogRepository: new DrizzleBacklogRepository(database.db),
  planningSettingsRepository: new DrizzlePlanningSettingsRepository(database.db),
  webOrigin: env.WEB_ORIGIN,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().finally(() => database?.close());
  });
}

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  await database?.close();
  process.exitCode = 1;
}
