import { eq, planningSettings, type Database } from '@gameshelf/database';
import type { PlanningSettingsRepository } from './repository.js';

export class DrizzlePlanningSettingsRepository implements PlanningSettingsRepository {
  constructor(private readonly db: Database) {}

  async getWeeklyMinutes(): Promise<number> {
    const [settings] = await this.db.select().from(planningSettings).where(eq(planningSettings.id, 1)).limit(1);
    return settings?.weeklyMinutes ?? 0;
  }

  async setWeeklyMinutes(weeklyMinutes: number): Promise<void> {
    await this.db.insert(planningSettings).values({ id: 1, weeklyMinutes })
      .onConflictDoUpdate({ target: planningSettings.id, set: { weeklyMinutes, updatedAt: new Date() } });
  }
}
