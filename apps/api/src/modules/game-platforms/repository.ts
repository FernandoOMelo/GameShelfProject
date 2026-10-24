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
  externalActivityStartedAt: Date | null;
  externalActivityEndedAt: Date | null;
  externalActivityDays: number;
  externalPlaytimeImportedMinutes: number;
  countsTowardTotal: boolean;
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

/**
 * Janela de atividade derivada dos desbloqueios de conquista (ADR-030).
 * `days` conta dias civis distintos com pelo menos um desbloqueio; não é o
 * número de sessões e não vira sessão.
 */
export type ExternalActivityWindow = {
  startedAt: Date | null;
  endedAt: Date | null;
  days: number;
};

export type ExternalPlaytimeImportRecord = {
  id: string;
  gameId: string;
  gamePlatformId: string | null;
  platformName: string;
  source: string;
  importedMinutes: number;
  totalImportedMinutes: number;
  externalLastPlayedAt: Date | null;
  activityStartedAt: Date | null;
  activityEndedAt: Date | null;
  activityDays: number;
  importedAt: Date;
};

export type ExternalPlaytimeImportOutcome = {
  link: GamePlatformRecord;
  import: ExternalPlaytimeImportRecord;
  retroactivePlayedHours: number;
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
  /** Grava a janela de atividade conhecida na fonte, sem tocar no tempo. */
  updateExternalActivity(id: string, activity: ExternalActivityWindow): Promise<GamePlatformRecord | undefined>;
  /**
   * Lança tempo externo como horas retroativas de forma atômica: marca o que já
   * foi lançado, soma as horas no jogo e registra o lançamento no histórico.
   */
  applyExternalPlaytimeImport(gameId: string, id: string, input: {
    importedMinutes: number;
    totalImportedMinutes: number;
    retroactivePlayedHours: number;
    importedAt: Date;
  }): Promise<ExternalPlaytimeImportOutcome | undefined>;
  /** Histórico de lançamentos, do mais recente para o mais antigo. */
  listExternalPlaytimeImports(): Promise<ExternalPlaytimeImportRecord[]>;
}
