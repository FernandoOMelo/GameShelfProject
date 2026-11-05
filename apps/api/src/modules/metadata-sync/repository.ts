import type { GameMetadataCandidate, MetadataSyncStatus } from '@gameshelf/contracts';

export type MetadataSyncRecord = {
  gameId: string;
  status: MetadataSyncStatus;
  providerId: string | null;
  checkedTitle: string;
  checkedAt: Date;
  appliedFields: string[];
  candidates: GameMetadataCandidate[];
};

export interface MetadataSyncRepository {
  get(gameId: string): Promise<MetadataSyncRecord | undefined>;
  listAll(): Promise<MetadataSyncRecord[]>;
  upsert(record: MetadataSyncRecord): Promise<void>;
}
