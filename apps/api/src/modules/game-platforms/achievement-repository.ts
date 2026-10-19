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

export interface ExternalAchievementRepository {
  listForGamePlatform(gamePlatformId: string): Promise<ExternalAchievementRecord[]>;
  /**
   * Substitui o espelho local das conquistas daquela associação.
   *
   * Substituir, e não mesclar: a fonte é a dona desses dados, e uma conquista
   * que sumiu de lá não deve sobreviver aqui. Nada de origem local é perdido
   * porque nada de origem local vive nesta tabela.
   */
  replaceForGamePlatform(gamePlatformId: string, entries: ExternalAchievementEntry[], syncedAt: Date): Promise<ExternalAchievementRecord[]>;
}
