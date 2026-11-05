import { eq, gameMetadataSync, type Database } from '@gameshelf/database';
import { gameMetadataCandidatesSchema, metadataSyncStatusSchema } from '@gameshelf/contracts';
import { z } from 'zod';
import type { MetadataSyncRecord, MetadataSyncRepository } from './repository.js';

const fieldsSchema = z.array(z.string());

export class DrizzleMetadataSyncRepository implements MetadataSyncRepository {
  constructor(private readonly db: Database) {}

  async get(gameId: string): Promise<MetadataSyncRecord | undefined> {
    const [row] = await this.db.select().from(gameMetadataSync).where(eq(gameMetadataSync.gameId, gameId)).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async listAll(): Promise<MetadataSyncRecord[]> {
    return (await this.db.select().from(gameMetadataSync)).map(toRecord);
  }

  async upsert(record: MetadataSyncRecord): Promise<void> {
    const values = {
      gameId: record.gameId, status: record.status, providerId: record.providerId, checkedTitle: record.checkedTitle,
      checkedAt: record.checkedAt, appliedFields: record.appliedFields, candidates: record.candidates, updatedAt: new Date(),
    };
    await this.db.insert(gameMetadataSync).values(values).onConflictDoUpdate({ target: gameMetadataSync.gameId, set: values });
  }
}

function toRecord(row: typeof gameMetadataSync.$inferSelect): MetadataSyncRecord {
  return {
    gameId: row.gameId, status: metadataSyncStatusSchema.parse(row.status), providerId: row.providerId, checkedTitle: row.checkedTitle,
    checkedAt: row.checkedAt, appliedFields: fieldsSchema.parse(row.appliedFields),
    // Candidatos antigos que deixaram de passar na validação são descartados em vez de quebrar a tela.
    candidates: gameMetadataCandidatesSchema.catch([]).parse(row.candidates),
  };
}
