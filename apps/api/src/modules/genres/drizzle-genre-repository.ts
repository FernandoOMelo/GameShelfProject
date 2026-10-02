import { asc, genres, type Database } from '@gameshelf/database';
import type { GenreRepository } from './repository.js';

export class DrizzleGenreRepository implements GenreRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name));
  }

  async create(name: string) {
    const [genre] = await this.db.insert(genres).values({ name }).returning({ id: genres.id, name: genres.name });
    return genre;
  }
}
