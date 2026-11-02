import type { Franchise } from '@gameshelf/contracts';

export interface FranchiseRepository {
  list(): Promise<Franchise[]>;
  find(id: string): Promise<Franchise | undefined>;
  create(name: string, igdbFranchiseId?: number | null): Promise<Franchise>;
  /** Preenche o id do IGDB numa franquia que ainda não o tinha (ADR-033). */
  setIgdbFranchiseId(id: string, igdbFranchiseId: number): Promise<Franchise | undefined>;
}
