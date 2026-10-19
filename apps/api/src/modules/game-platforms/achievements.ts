import type { ExternalAchievementRecord } from './achievement-repository.js';

/**
 * Converte o espelho local de conquistas para o contrato da API e calcula o
 * resumo. Pontos só contam os desbloqueados: pontuação é o que se conquistou,
 * não o que existe para conquistar.
 */
export function toExternalAchievements(records: ExternalAchievementRecord[], refreshedAt: Date | null) {
  const achievements = records.map((record) => ({
    id: record.id,
    externalId: record.externalId,
    name: record.name,
    description: record.description,
    iconUrl: record.iconUrl,
    points: record.points,
    rarityPercent: record.rarityPercent === null ? null : Number(record.rarityPercent),
    unlocked: record.unlocked,
    unlockedAt: record.unlockedAt?.toISOString() ?? null,
    syncedAt: record.syncedAt.toISOString(),
  }));
  return {
    achievements,
    unlockedCount: achievements.filter((item) => item.unlocked).length,
    total: achievements.length,
    points: achievements.reduce((sum, item) => sum + (item.unlocked ? item.points ?? 0 : 0), 0),
    refreshedAt: refreshedAt?.toISOString() ?? null,
  };
}
