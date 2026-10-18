import './config/load-env.js';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createDatabase } from '@gameshelf/database';
import { DrizzleGameRepository } from './modules/games/drizzle-game-repository.js';
import { DrizzleFranchiseRepository } from './modules/franchises/drizzle-franchise-repository.js';
import { DrizzlePlatformRepository } from './modules/platforms/drizzle-platform-repository.js';
import { DrizzleGenreRepository } from './modules/genres/drizzle-genre-repository.js';
import { DrizzleSessionRepository } from './modules/sessions/drizzle-session-repository.js';
import { DrizzleGamePlatformRepository } from './modules/game-platforms/drizzle-game-platform-repository.js';
import { DrizzlePlaythroughRepository } from './modules/playthroughs/drizzle-playthrough-repository.js';
import { DrizzleBacklogRepository } from './modules/backlog/drizzle-backlog-repository.js';
import { DrizzleGameListRepository } from './modules/game-lists/drizzle-game-list-repository.js';
import { DrizzlePlanningSettingsRepository } from './modules/planning/drizzle-planning-settings-repository.js';
import { DrizzleMainChallengeRepository } from './modules/challenge/drizzle-challenge-repository.js';
import { DrizzleChallengeCompletionRepository } from './modules/challenge/drizzle-challenge-completion-repository.js';
import { DrizzleSavedFilterRepository } from './modules/saved-filters/drizzle-saved-filter-repository.js';
import { DrizzleGoalRepository } from './modules/goals/drizzle-goal-repository.js';
import { DrizzleScreenshotRepository } from './modules/sessions/drizzle-screenshot-repository.js';
import { DrizzleBackupImporter } from './modules/backup/drizzle-backup-importer.js';
import { DrizzleExternalMatchQueueRepository } from './modules/integrations/drizzle-match-queue-repository.js';
import { AchievistClient } from './modules/integrations/achievist/client.js';
import { IgdbMetadataProvider } from './modules/games/igdb-metadata-provider.js';
import { HltbTimeEstimateProvider } from './modules/games/hltb-time-estimate-provider.js';
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
  gamePlatformRepository: new DrizzleGamePlatformRepository(database.db),
  playthroughRepository: new DrizzlePlaythroughRepository(database.db),
  backlogRepository: new DrizzleBacklogRepository(database.db),
  gameListRepository: new DrizzleGameListRepository(database.db),
  mainChallengeRepository: new DrizzleMainChallengeRepository(database.db),
  challengeCompletionRepository: new DrizzleChallengeCompletionRepository(database.db),
  savedFilterRepository: new DrizzleSavedFilterRepository(database.db),
  goalRepository: new DrizzleGoalRepository(database.db),
  backupImporter: new DrizzleBackupImporter(database.db),
  screenshotRepository: new DrizzleScreenshotRepository(database.db),
  planningSettingsRepository: new DrizzlePlanningSettingsRepository(database.db),
  imageStorage: new LocalImageStorage(resolve(apiDirectory, env.MEDIA_STORAGE_PATH)),
  ...(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET && {
    metadataProvider: new IgdbMetadataProvider(env.IGDB_CLIENT_ID, env.IGDB_CLIENT_SECRET),
  }),
  externalMatchQueueRepository: new DrizzleExternalMatchQueueRepository(database.db),
  // Sem as credenciais do Achievist a integração fica desligada (ADR-024).
  ...(env.ACHIEVIST_BASE_URL && env.ACHIEVIST_USERNAME && env.ACHIEVIST_PASSWORD && {
    externalLibraryProvider: new AchievistClient(env.ACHIEVIST_BASE_URL, env.ACHIEVIST_USERNAME, env.ACHIEVIST_PASSWORD),
  }),
  timeEstimateProvider: new HltbTimeEstimateProvider(),
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
