import { and, asc, eq, gamePlatforms, isNull, type Database } from '@gameshelf/database';
import type { GamePlatformInput, GamePlatformUpdate } from '@gameshelf/contracts';
import type { ExternalProvenance, GamePlatformRecord, GamePlatformRepository } from './repository.js';

export class DrizzleGamePlatformRepository implements GamePlatformRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<GamePlatformRecord[]> {
    return this.db.select().from(gamePlatforms).orderBy(asc(gamePlatforms.gameId), asc(gamePlatforms.createdAt));
  }

  async listForGame(gameId: string): Promise<GamePlatformRecord[]> {
    return this.db.select().from(gamePlatforms).where(eq(gamePlatforms.gameId, gameId))
      .orderBy(asc(gamePlatforms.createdAt), asc(gamePlatforms.id));
  }

  async find(gameId: string, id: string): Promise<GamePlatformRecord | undefined> {
    const [row] = await this.db.select().from(gamePlatforms)
      .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.id, id))).limit(1);
    return row;
  }

  async create(gameId: string, input: GamePlatformInput): Promise<GamePlatformRecord> {
    return this.db.transaction(async (tx) => {
      if (input.isPrimary) await clearPrimary(tx, gameId);
      const [row] = await tx.insert(gamePlatforms)
        .values({ ...toDatabaseInput(input), gameId, platformId: input.platformId }).returning();
      return row;
    });
  }

  async update(gameId: string, id: string, input: GamePlatformUpdate): Promise<GamePlatformRecord | undefined> {
    return this.db.transaction(async (tx) => {
      if (input.isPrimary) await clearPrimary(tx, gameId);
      const [row] = await tx.update(gamePlatforms).set({ ...toDatabaseInput(input), updatedAt: new Date() })
        .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.id, id))).returning();
      return row;
    });
  }

  async delete(gameId: string, id: string): Promise<boolean> {
    const deleted = await this.db.delete(gamePlatforms)
      .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.id, id))).returning({ id: gamePlatforms.id });
    return deleted.length > 0;
  }

  async listByExternalSource(source: string): Promise<GamePlatformRecord[]> {
    return this.db.select().from(gamePlatforms).where(eq(gamePlatforms.externalSource, source))
      .orderBy(asc(gamePlatforms.gameId), asc(gamePlatforms.createdAt));
  }

  async attachExternal(gameId: string, platformId: string, external: ExternalProvenance): Promise<GamePlatformRecord> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(gamePlatforms)
        .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.platformId, platformId), isNull(gamePlatforms.edition)))
        .limit(1);
      if (existing) {
        const [row] = await tx.update(gamePlatforms).set({ ...toExternalColumns(external), updatedAt: new Date() })
          .where(eq(gamePlatforms.id, existing.id)).returning();
        return row;
      }
      // A associação nasce com posse: a entrada vem da biblioteca da conta
      // externa, e a criação só acontece quando o usuário confirma o vínculo.
      const [row] = await tx.insert(gamePlatforms)
        .values({ gameId, platformId, owned: true, ...toExternalColumns(external) }).returning();
      return row;
    });
  }

  async updateExternalSnapshot(id: string, external: ExternalProvenance): Promise<GamePlatformRecord | undefined> {
    const [row] = await this.db.update(gamePlatforms).set({ ...toExternalColumns(external), updatedAt: new Date() })
      .where(eq(gamePlatforms.id, id)).returning();
    return row;
  }
}

function toExternalColumns(external: ExternalProvenance) {
  return {
    externalSource: external.source,
    externalId: external.externalId,
    externalAccountLabel: external.accountLabel,
    externalPlaytimeMinutes: external.playtimeMinutes,
    externalLastPlayedAt: external.lastPlayedAt,
    externalSyncedAt: external.syncedAt,
  };
}

// Só uma associação por jogo pode ser a principal; o índice parcial no banco
// rejeitaria a segunda, então a anterior é desmarcada na mesma transação.
async function clearPrimary(tx: Pick<Database, 'update'>, gameId: string) {
  await tx.update(gamePlatforms).set({ isPrimary: false })
    .where(and(eq(gamePlatforms.gameId, gameId), eq(gamePlatforms.isPrimary, true)));
}

function toDatabaseInput(input: GamePlatformUpdate) {
  return {
    ...(input.platformId !== undefined && { platformId: input.platformId }),
    ...(input.edition !== undefined && { edition: input.edition?.trim() || null }),
    ...(input.format !== undefined && { format: input.format }),
    ...(input.owned !== undefined && { owned: input.owned }),
    ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
    ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
  };
}
