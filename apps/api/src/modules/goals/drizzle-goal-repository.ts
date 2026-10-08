import { eq, goals, type Database } from '@gameshelf/database';
import type { GoalInput } from '@gameshelf/contracts';
import type { GoalRecord, GoalRepository } from './repository.js';

const columns = { id: goals.id, kind: goals.kind, period: goals.period, year: goals.year, month: goals.month, target: goals.target };

export class DrizzleGoalRepository implements GoalRepository {
  constructor(private readonly db: Database) {}

  list(): Promise<GoalRecord[]> {
    return this.db.select(columns).from(goals);
  }

  async create(input: GoalInput): Promise<GoalRecord> {
    const [row] = await this.db.insert(goals).values({ ...input, month: input.month ?? 0 }).returning(columns);
    return row!;
  }

  async updateTarget(id: string, target: number): Promise<GoalRecord | undefined> {
    const [row] = await this.db.update(goals).set({ target, updatedAt: new Date() }).where(eq(goals.id, id)).returning(columns);
    return row;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db.delete(goals).where(eq(goals.id, id)).returning({ id: goals.id });
    return rows.length > 0;
  }
}
