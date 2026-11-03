import { desc, eq, missions, sql, type Database } from '@gameshelf/database';
import type { MissionInput, MissionUpdate } from '@gameshelf/contracts';
import type { MissionRecord, MissionRepository } from './repository.js';

export class DrizzleMissionRepository implements MissionRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<MissionRecord[]> {
    return await this.db.select().from(missions).orderBy(desc(missions.isPrimary), missions.createdAt) as MissionRecord[];
  }

  async create(input: MissionInput): Promise<MissionRecord> {
    return this.db.transaction(async (tx) => {
      const [existingPrimary] = await tx.select({ id: missions.id }).from(missions).where(eq(missions.isPrimary, true)).limit(1);
      const primary = input.isPrimary === true || (input.isPrimary === undefined && !existingPrimary);
      if (primary) await tx.update(missions).set({ isPrimary: false }).where(eq(missions.isPrimary, true));
      const [row] = await tx.insert(missions).values({
        title: input.title,
        description: input.description ?? null,
        kind: input.kind,
        listId: input.kind === 'LIST' ? input.listId ?? null : null,
        target: input.kind === 'GAMES_COUNT' || input.kind === 'HOURS' ? input.target ?? null : null,
        ...(input.startsOn && { startsOn: input.startsOn }),
        dueDate: input.dueDate ?? null,
        isPrimary: primary,
      }).returning();
      return row as MissionRecord;
    });
  }

  async update(id: string, input: MissionUpdate): Promise<MissionRecord | undefined> {
    return this.db.transaction(async (tx) => {
      if (input.isPrimary) await tx.update(missions).set({ isPrimary: false }).where(sql`${missions.isPrimary} AND ${missions.id} <> ${id}`);
      const [row] = await tx.update(missions).set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.target !== undefined && { target: input.target }),
        ...(input.listId !== undefined && { listId: input.listId }),
        ...(input.startsOn !== undefined && { startsOn: input.startsOn }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.done !== undefined && { done: input.done }),
        ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
        updatedAt: new Date(),
      }).where(eq(missions.id, id)).returning();
      return row as MissionRecord | undefined;
    });
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db.delete(missions).where(eq(missions.id, id)).returning({ id: missions.id });
    return rows.length > 0;
  }
}
