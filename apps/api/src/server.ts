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
import { DrizzleGameListRepository } from './modules/game-lists/drizzle-game-list-repository.js';
import { DrizzlePlanningSettingsRepository } from './modules/planning/drizzle-planning-settings-repository.js';
import { DrizzleMainChallengeRepository } from './modules/challenge/drizzle-challenge-repository.js';
import { IgdbMetadataProvider } from './modules/games/igdb-metadata-provider.js';
import { LocalImageStorage } from './modules/games/image-storage.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
  gameListRepository: new DrizzleGameListRepository(database.db),
  mainChallengeRepository: new DrizzleMainChallengeRepository(database.db),
  planningSettingsRepository: new DrizzlePlanningSettingsRepository(database.db),
  imageStorage: new LocalImageStorage(resolve(apiDirectory, env.MEDIA_STORAGE_PATH)),
  ...(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET && {
    metadataProvider: new IgdbMetadataProvider(env.IGDB_CLIENT_ID, env.IGDB_CLIENT_SECRET),
  }),
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
