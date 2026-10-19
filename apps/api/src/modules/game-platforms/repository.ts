import type { GamePlatformInput, GamePlatformUpdate } from '@gameshelf/contracts';

export type GamePlatformRecord = {
  id: string;
  gameId: string;
  platformId: string;
  edition: string | null;
  format: 'PHYSICAL' | 'DIGITAL' | 'SUBSCRIPTION' | 'CLOUD' | null;
  owned: boolean;
  isPrimary: boolean;
  externalSource: string | null;
  externalId: string | null;
  externalAccountLabel: string | null;
  externalPlaytimeMinutes: number | null;
  externalLastPlayedAt: Date | null;
  externalSyncedAt: Date | null;
  externalPlaytimeImportedMinutes: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Proveniência externa de uma associação (ADR-024). Gravada apenas pela
 * importação, sempre separada do tempo registrado em sessões.
 */
export type ExternalProvenance = {
  source: string;
  externalId: string;
  accountLabel: string | null;
  playtimeMinutes: number | null;
  lastPlayedAt: Date | null;
  syncedAt: Date;
};

export interface GamePlatformRepository {
  listAll(): Promise<GamePlatformRecord[]>;
  listForGame(gameId: string): Promise<GamePlatformRecord[]>;
  find(gameId: string, id: string): Promise<GamePlatformRecord | undefined>;
  create(gameId: string, input: GamePlatformInput): Promise<GamePlatformRecord>;
  update(gameId: string, id: string, input: GamePlatformUpdate): Promise<GamePlatformRecord | undefined>;
  /** Desassocia a plataforma. Sessões e jornadas que a referenciam continuam existindo. */
  delete(gameId: string, id: string): Promise<boolean>;
  /** Associações já vinculadas a uma fonte externa, para a importação reencontrá-las. */
  listByExternalSource(source: string): Promise<GamePlatformRecord[]>;
  /**
   * Vincula a entrada externa ao jogo: reaproveita a associação sem edição que
   * já exista para a plataforma ou cria uma nova. Só os campos externos e, na
   * criação, a posse são gravados; edição, formato, principal e notas não.
   */
  attachExternal(gameId: string, platformId: string, external: ExternalProvenance): Promise<GamePlatformRecord>;
  /**
   * Atualiza somente os campos externos de uma associação já vinculada. Nada
   * declarado pelo usuário é tocado.
   */
  updateExternalSnapshot(id: string, external: ExternalProvenance): Promise<GamePlatformRecord | undefined>;
  /** Marca quantos minutos do tempo externo já foram lançados como retroativos. */
  markPlaytimeImported(id: string, importedMinutes: number): Promise<GamePlatformRecord | undefined>;
}
