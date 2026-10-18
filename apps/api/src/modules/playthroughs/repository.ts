import type { PlaythroughInput, PlaythroughStatus, PlaythroughUpdate } from '@gameshelf/contracts';

export type PlaythroughRecord = {
  id: string;
  gameId: string;
  sequence: number;
  label: string | null;
  status: PlaythroughStatus;
  primaryPlatformId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface PlaythroughRepository {
  listAll(): Promise<PlaythroughRecord[]>;
  listForGame(gameId: string): Promise<PlaythroughRecord[]>;
  find(gameId: string, id: string): Promise<PlaythroughRecord | undefined>;
  create(gameId: string, input: PlaythroughInput): Promise<PlaythroughRecord>;
  update(gameId: string, id: string, input: PlaythroughUpdate): Promise<PlaythroughRecord | undefined>;
  /** Remove a jornada; as sessões vinculadas permanecem, sem jornada. */
  delete(gameId: string, id: string): Promise<boolean>;
}
