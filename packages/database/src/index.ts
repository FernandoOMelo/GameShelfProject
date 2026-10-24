import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;
export { games, franchises, platforms, genres, gameGenres, sessions, queueEntries, gameLists, gameListEntries, planningSettings, mainChallenge, challengeCompletions, savedFilters, goals, sessionScreenshots, gamePlatforms, playthroughs, externalGameMatches, externalAchievements, externalPlaytimeImports } from './schema/index.js';
export { and, asc, desc, eq, inArray, isNull, sql };
