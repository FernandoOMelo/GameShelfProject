import type { LibraryFilterState } from '@gameshelf/contracts';

export type SavedFilterRecord = {
  id: string;
  name: string;
  filters: LibraryFilterState;
  createdAt: Date;
  updatedAt: Date;
};

export interface SavedFilterRepository {
  list(): Promise<SavedFilterRecord[]>;
  find(id: string): Promise<SavedFilterRecord | undefined>;
  create(name: string, filters: LibraryFilterState): Promise<SavedFilterRecord>;
  update(id: string, changes: { name?: string; filters?: LibraryFilterState }): Promise<SavedFilterRecord | undefined>;
  delete(id: string): Promise<boolean>;
}
