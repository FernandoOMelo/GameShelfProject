import { asc, franchises, type Database } from '@gameshelf/database';
import type { FranchiseRepository } from './repository.js';

export class DrizzleFranchiseRepository implements FranchiseRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select({ id: franchises.id, name: franchises.name })
      .from(franchises).orderBy(asc(franchises.name));
  }

  async create(name: string) {
    const [franchise] = await this.db.insert(franchises).values({ name }).returning({ id: franchises.id, name: franchises.name });
    return franchise;
  }
}
