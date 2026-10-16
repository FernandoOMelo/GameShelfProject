import { asc, eq, savedFilters, type Database } from '@gameshelf/database';
import type { LibraryFilterState } from '@gameshelf/contracts';
import type { SavedFilterRecord, SavedFilterRepository } from './repository.js';

export class DrizzleSavedFilterRepository implements SavedFilterRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<SavedFilterRecord[]> {
    const rows = await this.db.select().from(savedFilters).orderBy(asc(savedFilters.name));
    return rows.map(toRecord);
  }

  async find(id: string): Promise<SavedFilterRecord | undefined> {
    const [row] = await this.db.select().from(savedFilters).where(eq(savedFilters.id, id)).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async create(name: string, filters: LibraryFilterState): Promise<SavedFilterRecord> {
    const [row] = await this.db.insert(savedFilters).values({ name, filters }).returning();
    return toRecord(row);
  }

  async update(id: string, changes: { name?: string; filters?: LibraryFilterState }): Promise<SavedFilterRecord | undefined> {
    const [row] = await this.db.update(savedFilters)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(savedFilters.id, id)).returning();
    return row ? toRecord(row) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(savedFilters).where(eq(savedFilters.id, id)).returning({ id: savedFilters.id });
    return deleted.length > 0;
  }
}

function toRecord(row: typeof savedFilters.$inferSelect): SavedFilterRecord {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters as LibraryFilterState,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
