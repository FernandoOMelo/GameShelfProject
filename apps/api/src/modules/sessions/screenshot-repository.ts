export type ScreenshotRecord = { id: string; sessionId: string; url: string; createdAt: Date };

export interface ScreenshotRepository {
  listForSession(gameId: string, sessionId: string): Promise<ScreenshotRecord[]>;
  listForGame(gameId: string): Promise<ScreenshotRecord[]>;
  listAll(): Promise<ScreenshotRecord[]>;
  add(sessionId: string, url: string): Promise<ScreenshotRecord>;
  // Devolve o registro removido para que o chamador apague o arquivo.
  remove(gameId: string, sessionId: string, screenshotId: string): Promise<ScreenshotRecord | undefined>;
}
