import type { SessionInput } from '@gameshelf/contracts';

export type SessionRecord = {
  id: string;
  gameId: string;
  startedAt: Date;
  endedAt: Date | null;
  progress: number | null;
  location: string | null;
  notes: string | null;
  keyDecisions: string | null;
  tips: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface SessionRepository {
  listForGame(gameId: string): Promise<SessionRecord[]>;
  listAll(): Promise<SessionRecord[]>;
  findForGame(gameId: string, sessionId: string): Promise<SessionRecord | undefined>;
  create(gameId: string, input: SessionInput): Promise<SessionRecord>;
  update(gameId: string, sessionId: string, input: SessionInput): Promise<SessionRecord | undefined>;
  delete(gameId: string, sessionId: string): Promise<boolean>;
}
