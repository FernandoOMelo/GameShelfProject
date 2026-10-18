import { and, asc, eq, playthroughs, type Database } from '@gameshelf/database';
import type { PlaythroughInput, PlaythroughUpdate } from '@gameshelf/contracts';
import type { PlaythroughRecord, PlaythroughRepository } from './repository.js';
import { nextSequence } from './service.js';

export class DrizzlePlaythroughRepository implements PlaythroughRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<PlaythroughRecord[]> {
    return this.db.select().from(playthroughs).orderBy(asc(playthroughs.gameId), asc(playthroughs.sequence));
  }

  async listForGame(gameId: string): Promise<PlaythroughRecord[]> {
    return this.db.select().from(playthroughs).where(eq(playthroughs.gameId, gameId)).orderBy(asc(playthroughs.sequence));
  }

  async find(gameId: string, id: string): Promise<PlaythroughRecord | undefined> {
    const [row] = await this.db.select().from(playthroughs)
      .where(and(eq(playthroughs.gameId, gameId), eq(playthroughs.id, id))).limit(1);
    return row;
  }

  async create(gameId: string, input: PlaythroughInput): Promise<PlaythroughRecord> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.select({ sequence: playthroughs.sequence }).from(playthroughs).where(eq(playthroughs.gameId, gameId));
      const [row] = await tx.insert(playthroughs)
        .values({ gameId, sequence: nextSequence(existing), ...toDatabaseInput(input) }).returning();
      return row;
    });
  }

  async update(gameId: string, id: string, input: PlaythroughUpdate): Promise<PlaythroughRecord | undefined> {
    const [row] = await this.db.update(playthroughs).set({ ...toDatabaseInput(input), updatedAt: new Date() })
      .where(and(eq(playthroughs.gameId, gameId), eq(playthroughs.id, id))).returning();
    return row;
  }

  async delete(gameId: string, id: string): Promise<boolean> {
    const deleted = await this.db.delete(playthroughs)
      .where(and(eq(playthroughs.gameId, gameId), eq(playthroughs.id, id))).returning({ id: playthroughs.id });
    return deleted.length > 0;
  }
}

function toDatabaseInput(input: PlaythroughUpdate) {
  return {
    ...(input.label !== undefined && { label: input.label?.trim() || null }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.primaryPlatformId !== undefined && { primaryPlatformId: input.primaryPlatformId }),
    ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
    ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
    ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
  };
}
