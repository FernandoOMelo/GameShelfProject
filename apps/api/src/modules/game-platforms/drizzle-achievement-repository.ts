import { asc, desc, eq, externalAchievements, type Database } from '@gameshelf/database';
import type { ExternalAchievementEntry } from '../integrations/external-library.js';
import type { ExternalAchievementRecord, ExternalAchievementRepository } from './achievement-repository.js';

export class DrizzleExternalAchievementRepository implements ExternalAchievementRepository {
  constructor(private readonly db: Database) {}

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
