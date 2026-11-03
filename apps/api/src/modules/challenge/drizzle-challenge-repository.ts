import { and, eq, missions, type Database } from '@gameshelf/database';
import type { MainChallengeRecord, MainChallengeRepository } from './repository.js';

/**
 * O desafio único passou a ser a missão principal do tipo LIST (ADR-040). Este
 * repositório mantém a interface antiga (`/challenge`, backup, detecção de
 * conclusão) sobre a tabela de missões.
 */
export class DrizzleMainChallengeRepository implements MainChallengeRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<MainChallengeRecord | undefined> {
    const [row] = await this.db.select().from(missions).where(and(eq(missions.isPrimary, true), eq(missions.kind, 'LIST'))).limit(1);
    return row?.listId ? { title: row.title, listId: row.listId } : undefined;
  }

  async listAll(): Promise<MainChallengeRecord[]> {
    const rows = await this.db.select().from(missions).where(eq(missions.kind, 'LIST'));
    return rows.flatMap((row) => row.listId ? [{ title: row.title, listId: row.listId }] : []);
  }

  async set(input: MainChallengeRecord): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(missions).set({ isPrimary: false }).where(eq(missions.isPrimary, true));
      await tx.insert(missions).values({ title: input.title, kind: 'LIST', listId: input.listId, isPrimary: true });
    });
  }

  async clear(): Promise<void> {
    await this.db.delete(missions).where(and(eq(missions.isPrimary, true), eq(missions.kind, 'LIST')));
  }
}
