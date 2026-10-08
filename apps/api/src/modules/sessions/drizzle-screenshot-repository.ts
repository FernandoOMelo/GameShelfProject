import { and, asc, eq, inArray, sessions, sessionScreenshots, type Database } from '@gameshelf/database';
import type { ScreenshotRecord, ScreenshotRepository } from './screenshot-repository.js';

const columns = { id: sessionScreenshots.id, sessionId: sessionScreenshots.sessionId, url: sessionScreenshots.url, createdAt: sessionScreenshots.createdAt };

export class DrizzleScreenshotRepository implements ScreenshotRepository {
  constructor(private readonly db: Database) {}

  async listForSession(gameId: string, sessionId: string): Promise<ScreenshotRecord[]> {
    return this.db.select(columns).from(sessionScreenshots)
      .innerJoin(sessions, eq(sessions.id, sessionScreenshots.sessionId))
      .where(and(eq(sessions.gameId, gameId), eq(sessions.id, sessionId)))
      .orderBy(asc(sessionScreenshots.createdAt), asc(sessionScreenshots.id));
  }

  async listForGame(gameId: string): Promise<ScreenshotRecord[]> {
    const ids = await this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.gameId, gameId));
    if (!ids.length) return [];
    return this.db.select(columns).from(sessionScreenshots)
      .where(inArray(sessionScreenshots.sessionId, ids.map((row) => row.id)))
      .orderBy(asc(sessionScreenshots.createdAt), asc(sessionScreenshots.id));
  }

  async listAll(): Promise<ScreenshotRecord[]> {
    return this.db.select(columns).from(sessionScreenshots).orderBy(asc(sessionScreenshots.createdAt), asc(sessionScreenshots.id));
  }

  async add(sessionId: string, url: string): Promise<ScreenshotRecord> {
    const [row] = await this.db.insert(sessionScreenshots).values({ sessionId, url }).returning(columns);
    return row!;
  }

  async remove(gameId: string, sessionId: string, screenshotId: string): Promise<ScreenshotRecord | undefined> {
    const owned = (await this.listForSession(gameId, sessionId)).find((item) => item.id === screenshotId);
    if (!owned) return undefined;
    await this.db.delete(sessionScreenshots).where(eq(sessionScreenshots.id, screenshotId));
    return owned;
  }
}
