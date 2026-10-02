import type { GameInput, GameUpdate } from '@gameshelf/contracts';

export type GameRecord = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  releaseYear: number | null;
  developer: string | null;
  publisher: string | null;
  franchiseId: string | null;
  platformIds: string[];
  genreIds: string[];
  status: 'BACKLOG' | 'QUEUED' | 'PLAYING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  estimatedMainHours: string | number | null;
  estimatedCompletionistHours: string | number | null;
  personalEstimatedHours: string | number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface GameRepository {
  list(): Promise<GameRecord[]>;
  find(id: string): Promise<GameRecord | undefined>;
  create(input: GameInput): Promise<GameRecord>;
  update(id: string, input: GameUpdate): Promise<GameRecord | undefined>;
  delete(id: string): Promise<boolean>;
}
