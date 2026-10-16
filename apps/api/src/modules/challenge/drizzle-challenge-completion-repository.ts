import { challengeCompletions, desc, type Database } from '@gameshelf/database';
import type { ChallengeCompletionInput, ChallengeCompletionRecord, ChallengeCompletionRepository } from './repository.js';

export class DrizzleChallengeCompletionRepository implements ChallengeCompletionRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<ChallengeCompletionRecord[]> {
    const rows = await this.db.select().from(challengeCompletions).orderBy(desc(challengeCompletions.completedAt));
    return rows.map((row) => ({
      id: row.id, title: row.title, listId: row.listId, gamesCount: row.gamesCount, completedAt: row.completedAt,
    }));
  }

  async record(input: ChallengeCompletionInput): Promise<void> {
    await this.db.insert(challengeCompletions).values(input).onConflictDoNothing();
  }
}
