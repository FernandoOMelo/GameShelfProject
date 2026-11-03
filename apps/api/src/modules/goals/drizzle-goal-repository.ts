import { eq, goals, type Database } from '@gameshelf/database';
import type { GoalInput, GoalUpdate } from '@gameshelf/contracts';
import type { GoalRecord, GoalRepository } from './repository.js';

export class DrizzleGoalRepository implements GoalRepository {
  constructor(private readonly db: Database) {}

  list(): Promise<GoalRecord[]> {
    return this.db.select().from(goals) as Promise<GoalRecord[]>;
  }

  async create(input: GoalInput): Promise<GoalRecord> {
    const byPeriod = input.kind === 'COMPLETED_GAMES' || input.kind === 'PLAYED_HOURS';
    // Metas sem período ficam no ano da data limite (ou no ano corrente): é só
    // uma âncora para a ordenação, não restringe nada.
    const year = byPeriod ? input.year! : Number((input.dueDate ?? new Date().toISOString()).slice(0, 4));
    const [row] = await this.db.insert(goals).values({
      kind: input.kind,
      period: byPeriod ? input.period! : 'YEAR',
      year,
      month: byPeriod ? (input.month ?? 0) : 0,
      target: input.target ?? 1,
      title: input.title ?? null,
      description: input.description ?? null,
      listId: input.kind === 'COMPLETE_LIST' ? input.listId ?? null : null,
      dueDate: byPeriod ? null : input.dueDate ?? null,
    }).returning();
    return row as GoalRecord;
  }

  async update(id: string, input: GoalUpdate): Promise<GoalRecord | undefined> {
    const [row] = await this.db.update(goals).set({
      ...(input.target !== undefined && { target: input.target }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.done !== undefined && { done: input.done }),
      updatedAt: new Date(),
    }).where(eq(goals.id, id)).returning();
    return row as GoalRecord | undefined;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db.delete(goals).where(eq(goals.id, id)).returning({ id: goals.id });
    return rows.length > 0;
  }
}
