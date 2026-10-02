import type { GameRecord } from '../games/repository.js';

export type QueueRecord = { game: GameRecord; position: number; addedAt: Date };

export interface BacklogRepository {
  listQueue(): Promise<QueueRecord[]>;
  addToQueue(gameId: string): Promise<void>;
  removeFromQueue(gameId: string): Promise<boolean>;
  reorderQueue(gameIds: string[]): Promise<boolean>;
}
