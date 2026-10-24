import { asc, eq, gamePlatforms, platforms, sql, type Database } from '@gameshelf/database';
import type { PlatformRepository } from './repository.js';

export class DrizzlePlatformRepository implements PlatformRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select({ id: platforms.id, name: platforms.name, parentId: platforms.parentId })
      .from(platforms).orderBy(asc(platforms.name));
  }

  async create(name: string, parentId: string | null = null) {
    const [platform] = await this.db.insert(platforms).values({ name, parentId })
      .returning({ id: platforms.id, name: platforms.name, parentId: platforms.parentId });
    return platform;
  }

  async rename(id: string, name: string) {
    const [platform] = await this.db.update(platforms).set({ name }).where(eq(platforms.id, id))
      .returning({ id: platforms.id, name: platforms.name, parentId: platforms.parentId });
    return platform;
  }

  async setParent(id: string, parentId: string | null) {
    const [platform] = await this.db.update(platforms).set({ parentId }).where(eq(platforms.id, id))
      .returning({ id: platforms.id, name: platforms.name, parentId: platforms.parentId });
    return platform;
  }

  async countGameLinks(id: string) {
    const [result] = await this.db.select({ value: sql<number>`count(*)::int` }).from(gamePlatforms)
      .where(eq(gamePlatforms.platformId, id));
    return result?.value ?? 0;
  }

  async remove(id: string) {
    const deleted = await this.db.delete(platforms).where(eq(platforms.id, id)).returning({ id: platforms.id });
    return deleted.length > 0;
  }
}
