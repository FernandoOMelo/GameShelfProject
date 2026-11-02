import { asc, eq, franchises, type Database } from '@gameshelf/database';
import type { FranchiseRepository } from './repository.js';

const columns = { id: franchises.id, name: franchises.name, igdbFranchiseId: franchises.igdbFranchiseId };

export class DrizzleFranchiseRepository implements FranchiseRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select(columns).from(franchises).orderBy(asc(franchises.name));
  }

  async find(id: string) {
    const [franchise] = await this.db.select(columns).from(franchises).where(eq(franchises.id, id));
    return franchise;
  }

  async create(name: string, igdbFranchiseId?: number | null) {
    const [franchise] = await this.db.insert(franchises).values({ name, igdbFranchiseId: igdbFranchiseId ?? null }).returning(columns);
    return franchise;
  }

  async setIgdbFranchiseId(id: string, igdbFranchiseId: number) {
    const [franchise] = await this.db.update(franchises).set({ igdbFranchiseId }).where(eq(franchises.id, id)).returning(columns);
    return franchise;
  }
}
