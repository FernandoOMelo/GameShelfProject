import type { ExternalAchievementRecord } from './achievement-repository.js';

export type AchievementActivityWindow = {
  startedAt: Date | null;
  endedAt: Date | null;
  /** Dias civis distintos (UTC) com pelo menos um desbloqueio. */
  days: number;
};

/**
 * Deriva a janela de atividade a partir dos desbloqueios. É uma delimitação,
 * não uma sessão: o primeiro e o último instante em que a fonte viu atividade e
 * quantos dias distintos tiveram desbloqueio. Conquista desbloqueada sem data
 * não entra na janela, porque não há como posicioná-la no tempo.
 */
export function deriveActivityWindow(
  achievements: ReadonlyArray<{ unlocked: boolean; unlockedAt: Date | null }>,
): AchievementActivityWindow {
  const instants = achievements
    .filter((achievement) => achievement.unlocked && achievement.unlockedAt !== null)
    .map((achievement) => achievement.unlockedAt!);
  if (instants.length === 0) return { startedAt: null, endedAt: null, days: 0 };
  const times = instants.map((instant) => instant.getTime());
  return {
    startedAt: new Date(Math.min(...times)),
    endedAt: new Date(Math.max(...times)),
    days: new Set(instants.map((instant) => instant.toISOString().slice(0, 10))).size,
  };
}

/**
 * Converte o espelho local de conquistas para o contrato da API e calcula o
 * resumo. Pontos só contam os desbloqueados: pontuação é o que se conquistou,
 * não o que existe para conquistar.
 */
export function toExternalAchievements(
  records: ExternalAchievementRecord[],
  refreshedAt: Date | null,
  refreshError: string | null = null,
) {
  const activity = deriveActivityWindow(records);
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
    refreshError,
    activityStartedAt: activity.startedAt?.toISOString() ?? null,
    activityEndedAt: activity.endedAt?.toISOString() ?? null,
    activityDays: activity.days,
  };
}
