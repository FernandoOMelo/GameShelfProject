import { asc, desc, eq, queueEntries, type Database } from '@gameshelf/database';
import { DrizzleGameRepository } from '../games/drizzle-game-repository.js';
import type { BacklogRepository, QueueRecord } from './repository.js';

export class DrizzleBacklogRepository implements BacklogRepository {
  constructor(private readonly db: Database) {}

  async listQueue(): Promise<QueueRecord[]> {
    const entries = await this.db.select().from(queueEntries).orderBy(asc(queueEntries.position), asc(queueEntries.addedAt));
    const result: QueueRecord[] = [];
    const gameRepository = new DrizzleGameRepository(this.db);
    for (const entry of entries) {
      const game = await gameRepository.find(entry.gameId);
      if (game) result.push({ game, position: entry.position, addedAt: entry.addedAt });
    }
    return result;
  }

  async addToQueue(gameId: string): Promise<void> {
    const [last] = await this.db.select({ position: queueEntries.position }).from(queueEntries)
      .orderBy(desc(queueEntries.position)).limit(1);
    await this.db.insert(queueEntries).values({ gameId, position: (last?.position ?? -1) + 1 });
  }

  async removeFromQueue(gameId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx.delete(queueEntries).where(eq(queueEntries.gameId, gameId)).returning({ id: queueEntries.id });
      if (deleted.length === 0) return false;
      const remaining = await tx.select({ gameId: queueEntries.gameId }).from(queueEntries)
        .orderBy(asc(queueEntries.position), asc(queueEntries.addedAt));
      for (const [position, entry] of remaining.entries()) {
        await tx.update(queueEntries).set({ position }).where(eq(queueEntries.gameId, entry.gameId));
      }
      return true;
    });
  }

  async reorderQueue(gameIds: string[]): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.select({ gameId: queueEntries.gameId }).from(queueEntries);
      if (existing.length !== gameIds.length || !gameIds.every((id) => existing.some((entry) => entry.gameId === id))) return false;
      for (const [position, gameId] of gameIds.entries()) {
        await tx.update(queueEntries).set({ position }).where(eq(queueEntries.gameId, gameId));
      }
      return true;
    });
  }
}
