import {
  franchises, gameGenres, gameListEntries, gameLists, games, genres, goals, mainChallenge, planningSettings, platforms,
  queueEntries, sessions, sessionScreenshots, type Database,
} from '@gameshelf/database';
import type { BackupData } from '@gameshelf/contracts';
import { LibraryNotEmptyError, type BackupImporter } from './importer.js';

// Postgres limita os parâmetros de uma consulta (65535); jogos têm ~28 colunas.
const CHUNK = 500;

export class DrizzleBackupImporter implements BackupImporter {
  constructor(private readonly db: Database) {}

  async importAll(data: BackupData): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const table of [games, franchises, platforms, genres, gameLists, goals]) {
        const [existing] = await tx.select({ id: table.id }).from(table).limit(1);
        if (existing) throw new LibraryNotEmptyError();
      }

      const insert = async <Row extends object>(rows: Row[], write: (chunk: Row[]) => Promise<unknown>) => {
        for (let start = 0; start < rows.length; start += CHUNK) await write(rows.slice(start, start + CHUNK));
      };
      const date = (value: string) => new Date(value);
      const numeric = (value: number | null) => value === null ? null : String(value);

      // Os objetos de entrada trazem campos extras (genreIds, gameIds); o Drizzle grava só as colunas da tabela.
      await insert(data.franchises, (rows) => tx.insert(franchises).values(rows));
      await insert(data.platforms, (rows) => tx.insert(platforms).values(rows));
      await insert(data.genres, (rows) => tx.insert(genres).values(rows));
      await insert(data.games, (rows) => tx.insert(games).values(rows.map((game) => ({
        ...game,
        estimatedMainHours: numeric(game.estimatedMainHours),
        estimatedCompletionistHours: numeric(game.estimatedCompletionistHours),
        personalEstimatedHours: numeric(game.personalEstimatedHours),
        retroactivePlayedHours: String(game.retroactivePlayedHours),
        createdAt: date(game.createdAt), updatedAt: date(game.updatedAt),
      }))));
      await insert(data.games.flatMap((game) => game.genreIds.map((genreId) => ({ gameId: game.id, genreId }))), (rows) => tx.insert(gameGenres).values(rows));
      await insert(data.sessions, (rows) => tx.insert(sessions).values(rows.map((session) => ({
        ...session, startedAt: date(session.startedAt), endedAt: session.endedAt ? date(session.endedAt) : null,
        createdAt: date(session.createdAt), updatedAt: date(session.updatedAt),
      }))));
      await insert(data.screenshots, (rows) => tx.insert(sessionScreenshots).values(rows.map((item) => ({ ...item, createdAt: date(item.createdAt) }))));
      await insert(data.queue, (rows) => tx.insert(queueEntries).values(rows.map((item) => ({ ...item, addedAt: date(item.addedAt) }))));
      await insert(data.lists, (rows) => tx.insert(gameLists).values(rows.map((list) => ({
        ...list, createdAt: date(list.createdAt), updatedAt: date(list.updatedAt),
      }))));
      await insert(data.lists.flatMap((list) => list.gameIds.map((gameId) => ({ listId: list.id, gameId }))), (rows) => tx.insert(gameListEntries).values(rows));
      await insert(data.goals, (rows) => tx.insert(goals).values(rows));
      await tx.insert(planningSettings).values({ id: 1, weeklyMinutes: data.weeklyMinutes })
        .onConflictDoUpdate({ target: planningSettings.id, set: { weeklyMinutes: data.weeklyMinutes, updatedAt: new Date() } });
      if (data.challenge) {
        await tx.insert(mainChallenge).values({ id: 1, ...data.challenge })
          .onConflictDoUpdate({ target: mainChallenge.id, set: { ...data.challenge, updatedAt: new Date() } });
      }
    });
  }
}
