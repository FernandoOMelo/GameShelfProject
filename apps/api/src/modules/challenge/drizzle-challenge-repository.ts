import { eq, mainChallenge, type Database } from '@gameshelf/database';
import type { MainChallengeRecord, MainChallengeRepository } from './repository.js';

export class DrizzleMainChallengeRepository implements MainChallengeRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<MainChallengeRecord | undefined> {
    const [row] = await this.db.select().from(mainChallenge).where(eq(mainChallenge.id, 1)).limit(1);
    return row ? { title: row.title, listId: row.listId } : undefined;
  }

  async set(input: MainChallengeRecord): Promise<void> {
    await this.db.insert(mainChallenge).values({ id: 1, ...input })
      .onConflictDoUpdate({ target: mainChallenge.id, set: { ...input, updatedAt: new Date() } });
  }

  async clear(): Promise<void> {
    await this.db.delete(mainChallenge).where(eq(mainChallenge.id, 1));
  }
}
