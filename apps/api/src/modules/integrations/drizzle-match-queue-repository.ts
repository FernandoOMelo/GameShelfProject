import { and, asc, eq, externalGameMatches, type Database } from '@gameshelf/database';
import type {
  ExternalMatchQueueRepository, ExternalMatchRecord, ExternalMatchSnapshot,
} from './match-queue-repository.js';

export class DrizzleExternalMatchQueueRepository implements ExternalMatchQueueRepository {
  constructor(private readonly db: Database) {}

  async listForSource(source: string): Promise<ExternalMatchRecord[]> {
    return this.db.select().from(externalGameMatches)
      .where(eq(externalGameMatches.source, source))
      .orderBy(asc(externalGameMatches.title), asc(externalGameMatches.id));
  }

  async find(id: string): Promise<ExternalMatchRecord | undefined> {
    const [row] = await this.db.select().from(externalGameMatches).where(eq(externalGameMatches.id, id)).limit(1);
    return row;
  }

  // O status fica fora do `set`: uma entrada que o usuário já mandou ignorar
  // continua ignorada depois de qualquer sincronização.
  async upsert(snapshot: ExternalMatchSnapshot, seenAt: Date): Promise<ExternalMatchRecord> {
    const [row] = await this.db.insert(externalGameMatches)
      .values({ ...snapshot, firstSeenAt: seenAt, lastSeenAt: seenAt })
      .onConflictDoUpdate({
        target: [externalGameMatches.source, externalGameMatches.externalId],
        set: {
          title: snapshot.title, platformName: snapshot.platformName, accountLabel: snapshot.accountLabel,
          playtimeMinutes: snapshot.playtimeMinutes, lastPlayedAt: snapshot.lastPlayedAt, lastSeenAt: seenAt,
        },
      })
      .returning();
    return row;
  }

  async ignore(id: string): Promise<ExternalMatchRecord | undefined> {
    const [row] = await this.db.update(externalGameMatches).set({ status: 'IGNORED' })
      .where(eq(externalGameMatches.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(externalGameMatches)
      .where(eq(externalGameMatches.id, id)).returning({ id: externalGameMatches.id });
    return deleted.length > 0;
  }

  async deleteByExternalId(source: string, externalId: string): Promise<boolean> {
    const deleted = await this.db.delete(externalGameMatches)
      .where(and(eq(externalGameMatches.source, source), eq(externalGameMatches.externalId, externalId)))
      .returning({ id: externalGameMatches.id });
    return deleted.length > 0;
  }
}
