import { asc, platforms, type Database } from '@gameshelf/database';
import type { PlatformRepository } from './repository.js';

export class DrizzlePlatformRepository implements PlatformRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select({ id: platforms.id, name: platforms.name }).from(platforms).orderBy(asc(platforms.name));
  }

  async create(name: string) {
    const [platform] = await this.db.insert(platforms).values({ name }).returning({ id: platforms.id, name: platforms.name });
    return platform;
  }
}
