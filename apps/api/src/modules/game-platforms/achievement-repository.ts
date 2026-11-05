import type { ExternalAchievementEntry } from '../integrations/external-library.js';

export type ExternalAchievementRecord = {
  id: string;
  gamePlatformId: string;
  externalId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  points: number | null;
  rarityPercent: string | number | null;
  unlocked: boolean;
  unlockedAt: Date | null;
  syncedAt: Date;
};

export type AchievementUnlock = {
  gameId: string;
  platformId: string;
  unlockedAt: Date;
  name: string;
  description: string | null;
  iconUrl: string | null;
  /** Pontos e raridade (% de jogadores) quando a fonte informa; usados pelos relatórios. */
  points?: number | null;
  rarityPercent?: number | null;
};

export interface ExternalAchievementRepository {
  /** Todos os desbloqueios com data, de todos os jogos, para linha do tempo e gráficos. */
  listUnlocks(): Promise<AchievementUnlock[]>;
  listForGamePlatform(gamePlatformId: string): Promise<ExternalAchievementRecord[]>;
  /** Totais e desbloqueadas por associação, sem carregar as conquistas (cartões da biblioteca). */
  countsByGamePlatform(): Promise<Map<string, { total: number; unlocked: number }>>;
  /**
   * Substitui o espelho local das conquistas daquela associação.
   *
   * Substituir, e não mesclar: a fonte é a dona desses dados, e uma conquista
   * que sumiu de lá não deve sobreviver aqui. Nada de origem local é perdido
   * porque nada de origem local vive nesta tabela.
   */
  replaceForGamePlatform(gamePlatformId: string, entries: ExternalAchievementEntry[], syncedAt: Date): Promise<ExternalAchievementRecord[]>;
}
