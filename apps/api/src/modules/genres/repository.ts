import type { Genre } from '@gameshelf/contracts';

export interface GenreRepository {
  list(): Promise<Genre[]>;
  create(name: string): Promise<Genre>;
}
