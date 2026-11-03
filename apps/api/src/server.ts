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
import { DrizzleExternalAchievementRepository } from './modules/game-platforms/drizzle-achievement-repository.js';
import { IntegrationHealthTracker } from './modules/integrations/health.js';
import { DrizzleMissionRepository } from './modules/missions/drizzle-mission-repository.js';
import { DrizzleGameMergeRepository } from './modules/games/drizzle-game-merge-repository.js';
import { DrizzleRawgAchievementRepository, RawgClient } from './modules/game-platforms/rawg-achievements.js';
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
import { DrizzleDlcRepository } from './modules/dlcs/drizzle-dlc-repository.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatória para iniciar a API.');
}

const database = createDatabase(env.DATABASE_URL);

// Saúde das integrações para a tela de Configurações (ADR-040).
const health = new IntegrationHealthTracker();
const metadataProvider = env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET
  ? health.track('igdb', new IgdbMetadataProvider(env.IGDB_CLIENT_ID, env.IGDB_CLIENT_SECRET), ['search', 'franchiseGames'])
  : undefined;
const rawgProvider = env.RAWG_API_KEY ? health.track('rawg', new RawgClient(env.RAWG_API_KEY), ['search', 'achievements']) : undefined;
const externalProvider = env.ACHIEVIST_BASE_URL && env.ACHIEVIST_USERNAME && env.ACHIEVIST_PASSWORD
  ? health.track('achievist', new AchievistClient(env.ACHIEVIST_BASE_URL, env.ACHIEVIST_USERNAME, env.ACHIEVIST_PASSWORD), ['fetchLibrary', 'fetchAchievements', 'ping'])
  : undefined;
health.register({
  key: 'igdb', name: 'IGDB (metadados)', envVars: ['IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'], configured: Boolean(metadataProvider),
  check: metadataProvider ? async () => `Busca respondeu com ${(await metadataProvider.search('zelda')).length} resultado(s).` : undefined,
});
health.register({
  key: 'rawg', name: 'RAWG (catálogo de conquistas)', envVars: ['RAWG_API_KEY'], configured: Boolean(rawgProvider),
  check: rawgProvider ? async () => `Busca respondeu com ${(await rawgProvider.search('zelda')).length} resultado(s).` : undefined,
});
health.register({
  key: 'achievist', name: 'Achievist (biblioteca e conquistas)', envVars: ['ACHIEVIST_BASE_URL', 'ACHIEVIST_USERNAME', 'ACHIEVIST_PASSWORD'], configured: Boolean(externalProvider),
  check: externalProvider?.ping ? async () => `Autenticou com ${(await externalProvider.ping!()).accounts} conta(s).` : undefined,
});

const app = buildApp({
  integrationHealth: health,
  missionRepository: new DrizzleMissionRepository(database.db),
  gameRepository: new DrizzleGameRepository(database.db),
  gameMergeRepository: new DrizzleGameMergeRepository(database.db),
  franchiseRepository: new DrizzleFranchiseRepository(database.db),
  platformRepository: new DrizzlePlatformRepository(database.db),
  genreRepository: new DrizzleGenreRepository(database.db),
  sessionRepository: new DrizzleSessionRepository(database.db),
  gamePlatformRepository: new DrizzleGamePlatformRepository(database.db),
  externalAchievementRepository: new DrizzleExternalAchievementRepository(database.db),
  rawgAchievementRepository: new DrizzleRawgAchievementRepository(database.db),
  dlcRepository: new DrizzleDlcRepository(database.db),
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
  ...(metadataProvider && { metadataProvider }),
  ...(rawgProvider && { rawgAchievementProvider: rawgProvider }),
  externalMatchQueueRepository: new DrizzleExternalMatchQueueRepository(database.db),
  // Sem as credenciais do Achievist a integração fica desligada (ADR-024).
  ...(externalProvider && { externalLibraryProvider: externalProvider }),
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
