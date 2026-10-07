import { and, asc, eq, gameLists, gameListEntries, type Database } from '@gameshelf/database';
import type { GameListRepository, GameListRecord } from './repository.js';

export class DrizzleGameListRepository implements GameListRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<GameListRecord[]> {
    const records = await this.db.select().from(gameLists).orderBy(asc(gameLists.name));
    return Promise.all(records.map((record) => this.withGames(record)));
  }

  async find(id: string): Promise<GameListRecord | undefined> {
    const [record] = await this.db.select().from(gameLists).where(eq(gameLists.id, id)).limit(1);
    return record ? this.withGames(record) : undefined;
  }

  async create(name: string): Promise<GameListRecord> {
    const [record] = await this.db.insert(gameLists).values({ name }).returning();
    return { ...record, gameIds: [] };
  }

  async rename(id: string, name: string): Promise<GameListRecord | undefined> {
    const [record] = await this.db.update(gameLists).set({ name, updatedAt: new Date() })
      .where(eq(gameLists.id, id)).returning();
    return record ? this.withGames(record) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(gameLists).where(eq(gameLists.id, id)).returning({ id: gameLists.id });
    return deleted.length > 0;
  }

  async addGame(listId: string, gameId: string): Promise<void> {
    await this.db.insert(gameListEntries).values({ listId, gameId });
  }

  async removeGame(listId: string, gameId: string): Promise<boolean> {
    const deleted = await this.db.delete(gameListEntries).where(and(eq(gameListEntries.listId, listId), eq(gameListEntries.gameId, gameId)))
      .returning({ gameId: gameListEntries.gameId });
    return deleted.length > 0;
  }

  private async withGames(record: Omit<GameListRecord, 'gameIds'>): Promise<GameListRecord> {
    const entries = await this.db.select({ gameId: gameListEntries.gameId }).from(gameListEntries)
      .where(eq(gameListEntries.listId, record.id)).orderBy(asc(gameListEntries.addedAt));
    return { ...record, gameIds: entries.map((entry) => entry.gameId) };
  }
}
