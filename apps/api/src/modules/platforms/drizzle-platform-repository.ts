import { asc, eq, platforms, type Database } from '@gameshelf/database';
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

  async setParent(id: string, parentId: string | null) {
    const [platform] = await this.db.update(platforms).set({ parentId }).where(eq(platforms.id, id))
      .returning({ id: platforms.id, name: platforms.name, parentId: platforms.parentId });
    return platform;
  }
}
