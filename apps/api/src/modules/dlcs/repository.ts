import type { DlcInput, DlcUpdate } from '@gameshelf/contracts';

export type DlcRecord = {
  id: string;
  gameId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  owned: boolean;
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  estimatedHours: string | number | null;
  playedHours: string | number;
  rawgId: number | null;
  rawgSlug: string | null;
  rawgName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface DlcRepository {
  listForGame(gameId: string): Promise<DlcRecord[]>;
  find(gameId: string, id: string): Promise<DlcRecord | undefined>;
  create(gameId: string, input: DlcInput): Promise<DlcRecord>;
  update(gameId: string, id: string, input: DlcUpdate): Promise<DlcRecord | undefined>;
  delete(gameId: string, id: string): Promise<boolean>;
}
