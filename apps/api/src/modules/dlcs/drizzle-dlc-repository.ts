import { and, dlcs, eq, type Database } from '@gameshelf/database';
import type { DlcInput, DlcUpdate } from '@gameshelf/contracts';
import type { DlcRecord, DlcRepository } from './repository.js';

export class DrizzleDlcRepository implements DlcRepository {
  constructor(private readonly db: Database) {}

  async listForGame(gameId: string): Promise<DlcRecord[]> {
    return this.db.select().from(dlcs).where(eq(dlcs.gameId, gameId)).orderBy(dlcs.releaseDate, dlcs.name);
  }

  async find(gameId: string, id: string): Promise<DlcRecord | undefined> {
    const [row] = await this.db.select().from(dlcs).where(and(eq(dlcs.gameId, gameId), eq(dlcs.id, id)));
    return row;
  }

  async create(gameId: string, input: DlcInput): Promise<DlcRecord> {
    const [row] = await this.db.insert(dlcs).values({
      gameId, name: input.name, description: input.description ?? null, coverUrl: input.coverUrl ?? null,
      releaseDate: input.releaseDate ?? null, owned: input.owned ?? false, status: input.status ?? 'NOT_STARTED',
      estimatedHours: input.estimatedHours === undefined || input.estimatedHours === null ? null : String(input.estimatedHours),
      playedHours: input.playedHours === undefined ? '0' : String(input.playedHours),
      rawgId: input.rawgId ?? null, rawgSlug: input.rawgSlug ?? null, rawgName: input.rawgName ?? null,
      linkedGameId: input.linkedGameId ?? null,
    }).returning();
    return row!;
  }

  async update(gameId: string, id: string, input: DlcUpdate): Promise<DlcRecord | undefined> {
    const [row] = await this.db.update(dlcs).set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.coverUrl !== undefined && { coverUrl: input.coverUrl }),
      ...(input.releaseDate !== undefined && { releaseDate: input.releaseDate }),
      ...(input.owned !== undefined && { owned: input.owned }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.estimatedHours !== undefined && { estimatedHours: input.estimatedHours === null ? null : String(input.estimatedHours) }),
      ...(input.playedHours !== undefined && { playedHours: String(input.playedHours) }),
      ...(input.rawgId !== undefined && { rawgId: input.rawgId }),
      ...(input.rawgSlug !== undefined && { rawgSlug: input.rawgSlug }),
      ...(input.rawgName !== undefined && { rawgName: input.rawgName }),
      ...(input.linkedGameId !== undefined && { linkedGameId: input.linkedGameId }),
      updatedAt: new Date(),
    }).where(and(eq(dlcs.gameId, gameId), eq(dlcs.id, id))).returning();
    return row;
  }

  async delete(gameId: string, id: string): Promise<boolean> {
    const rows = await this.db.delete(dlcs).where(and(eq(dlcs.gameId, gameId), eq(dlcs.id, id))).returning({ id: dlcs.id });
    return rows.length > 0;
  }
}
