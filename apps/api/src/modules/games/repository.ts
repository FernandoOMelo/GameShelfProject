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
  platformId: string | null;
  genreIds: string[];
  status: 'DESIRED' | 'BACKLOG' | 'QUEUED' | 'PLAYING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  archived: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  rating: number | null;
  difficulty: 'C' | 'B' | 'A' | 'AA' | 'AAA' | null;
  gameType: string | null;
  completionCondition: string | null;
  favorite: boolean;
  gameOfYear: boolean;
  owned: boolean;
  startedAt: string | null;
  completedAt: string | null;
  estimatedMainHours: string | number | null;
  estimatedCompletionistHours: string | number | null;
  personalEstimatedHours: string | number | null;
  retroactivePlayedHours: string | number;
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
