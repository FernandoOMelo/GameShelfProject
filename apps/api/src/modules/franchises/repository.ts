import type { Franchise } from '@gameshelf/contracts';

export interface FranchiseRepository {
  list(): Promise<Franchise[]>;
  create(name: string): Promise<Franchise>;
}
