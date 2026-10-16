import { and, asc, desc, eq, sessions, type Database } from '@gameshelf/database';
import type { SessionInput } from '@gameshelf/contracts';
import type { SessionRecord, SessionRepository } from './repository.js';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async listForGame(gameId: string): Promise<SessionRecord[]> {
    return this.db.select().from(sessions).where(eq(sessions.gameId, gameId))
      .orderBy(desc(sessions.startedAt), asc(sessions.id));
  }

  async listAll(): Promise<SessionRecord[]> {
    return this.db.select().from(sessions).orderBy(desc(sessions.startedAt), asc(sessions.id));
  }

  async findForGame(gameId: string, sessionId: string): Promise<SessionRecord | undefined> {
    const [session] = await this.db.select().from(sessions)
      .where(and(eq(sessions.gameId, gameId), eq(sessions.id, sessionId))).limit(1);
    return session;
  }

  async create(gameId: string, input: SessionInput): Promise<SessionRecord> {
    const [session] = await this.db.insert(sessions).values({ gameId, ...toDatabaseInput(input) }).returning();
    return session;
  }

  async update(gameId: string, sessionId: string, input: SessionInput): Promise<SessionRecord | undefined> {
    const [session] = await this.db.update(sessions).set({ ...toDatabaseInput(input), updatedAt: new Date() })
      .where(and(eq(sessions.gameId, gameId), eq(sessions.id, sessionId))).returning();
    return session;
  }

  async delete(gameId: string, sessionId: string): Promise<boolean> {
    const deleted = await this.db.delete(sessions)
      .where(and(eq(sessions.gameId, gameId), eq(sessions.id, sessionId))).returning({ id: sessions.id });
    return deleted.length > 0;
  }
}

function toDatabaseInput(input: SessionInput) {
  return {
    startedAt: new Date(input.startedAt),
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
    progress: input.progress ?? null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    keyDecisions: input.keyDecisions?.trim() || null,
    tips: input.tips?.trim() || null,
  };
}
