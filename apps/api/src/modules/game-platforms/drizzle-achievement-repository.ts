import { and, asc, desc, eq, externalAchievements, gamePlatforms, sql, type Database } from '@gameshelf/database';
import type { ExternalAchievementEntry } from '../integrations/external-library.js';
import type { AchievementUnlock, ExternalAchievementRecord, ExternalAchievementRepository } from './achievement-repository.js';

export class DrizzleExternalAchievementRepository implements ExternalAchievementRepository {
  constructor(private readonly db: Database) {}

  async listUnlocks(): Promise<AchievementUnlock[]> {
    const rows = await this.db.select({
      gameId: gamePlatforms.gameId, platformId: gamePlatforms.platformId, unlockedAt: externalAchievements.unlockedAt,
      name: externalAchievements.name, description: externalAchievements.description, iconUrl: externalAchievements.iconUrl,
    })
      .from(externalAchievements)
      .innerJoin(gamePlatforms, eq(gamePlatforms.id, externalAchievements.gamePlatformId))
      .where(and(eq(externalAchievements.unlocked, true)));
    return rows.flatMap((row) => row.unlockedAt ? [{ ...row, unlockedAt: row.unlockedAt }] : []);
  }

  async countsByGamePlatform(): Promise<Map<string, { total: number; unlocked: number }>> {
    const rows = await this.db.select({
      id: externalAchievements.gamePlatformId,
      total: sql<number>`count(*)::int`,
      unlocked: sql<number>`count(*) filter (where ${externalAchievements.unlocked})::int`,
    }).from(externalAchievements).groupBy(externalAchievements.gamePlatformId);
    return new Map(rows.map((row) => [row.id, { total: row.total, unlocked: row.unlocked }]));
  }

  async listForGamePlatform(gamePlatformId: string): Promise<ExternalAchievementRecord[]> {
    return this.db.select().from(externalAchievements)
      .where(eq(externalAchievements.gamePlatformId, gamePlatformId))
      // Desbloqueadas primeiro, as mais recentes antes; o nome desempata para a
      // ordem ser estável entre consultas.
      .orderBy(desc(externalAchievements.unlocked), desc(externalAchievements.unlockedAt), asc(externalAchievements.name));
  }

  async replaceForGamePlatform(
    gamePlatformId: string,
    entries: ExternalAchievementEntry[],
    syncedAt: Date,
  ): Promise<ExternalAchievementRecord[]> {
    return this.db.transaction(async (tx) => {
      await tx.delete(externalAchievements).where(eq(externalAchievements.gamePlatformId, gamePlatformId));
      if (entries.length) {
        await tx.insert(externalAchievements).values(entries.map((entry) => ({
          gamePlatformId,
          externalId: entry.externalId,
          name: entry.name,
          description: entry.description,
          iconUrl: entry.iconUrl,
          points: entry.points,
          rarityPercent: entry.rarityPercent === null ? null : String(entry.rarityPercent),
          unlocked: entry.unlocked,
          unlockedAt: entry.unlockedAt,
          syncedAt,
        })));
      }
      return tx.select().from(externalAchievements).where(eq(externalAchievements.gamePlatformId, gamePlatformId))
        .orderBy(desc(externalAchievements.unlocked), desc(externalAchievements.unlockedAt), asc(externalAchievements.name));
    });
  }
}
