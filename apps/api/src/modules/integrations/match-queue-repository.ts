export type ExternalMatchStatus = 'PENDING' | 'IGNORED';

export type ExternalMatchRecord = {
  id: string;
  source: string;
  externalId: string;
  title: string;
  platformName: string;
  accountLabel: string | null;
  playtimeMinutes: number | null;
  lastPlayedAt: Date | null;
  status: ExternalMatchStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

/** Retrato de uma entrada externa ainda sem vínculo confirmado. */
export type ExternalMatchSnapshot = {
  source: string;
  externalId: string;
  title: string;
  platformName: string;
  accountLabel: string | null;
  playtimeMinutes: number | null;
  lastPlayedAt: Date | null;
};

/**
 * Fila de correspondências a confirmar (ADR-024). Só guarda o que ainda não
 * virou associação: confirmar remove a linha, porque o vínculo passa a viver em
 * `game_platforms`; ignorar mantém a linha para que a próxima sincronização não
 * proponha a mesma entrada de novo.
 */
export interface ExternalMatchQueueRepository {
  listForSource(source: string): Promise<ExternalMatchRecord[]>;
  find(id: string): Promise<ExternalMatchRecord | undefined>;
  /** Insere ou atualiza o retrato pela chave (source, externalId), sem tocar no status. */
  upsert(snapshot: ExternalMatchSnapshot, seenAt: Date): Promise<ExternalMatchRecord>;
  ignore(id: string): Promise<ExternalMatchRecord | undefined>;
  delete(id: string): Promise<boolean>;
  deleteByExternalId(source: string, externalId: string): Promise<boolean>;
}
