import type { ExternalAchievement, GameAchievementsResponse, MergedAchievement, RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';

/** Heurísticas pt/en para a conquista que representa "terminei o jogo": platina,
 * zerar todos os troféus/conquistas, ou 100% de conclusão. */
const COMPLETION_PATTERNS = [
  /platin/i, /todos os troféus/i, /todas as conquistas/i, /all trophies/i, /all achievements/i,
  /conquiste? (todos|tudo)/i, /complet[ea]? (o jogo|the game) (a )?100/i, /100\s*%/,
];

function normalizeName(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function rarityTier(percent: number | null): MergedAchievement['rarityTier'] {
  if (percent === null) return 'COMMON';
  if (percent < 5) return 'ULTRA_RARE';
  if (percent < 20) return 'RARE';
  if (percent < 50) return 'UNCOMMON';
  return 'COMMON';
}

function isCompletionTrophy(name: string, description: string | null): boolean {
  const text = `${name} ${description ?? ''}`;
  return COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Cruza o catálogo RAWG (fonte de ícone/descrição/raridade) com os
 * desbloqueios pessoais espelhados do Achievist, por nome normalizado.
 * Item sem correspondência e ainda bloqueado é tratado como secreto: nome e
 * descrição ficam ocultos até desbloquear (ADR-028 — a fonte é dona do dado
 * de desbloqueio, aqui só decidimos o que mostrar).
 */
export function mergeAchievements(catalog: RawgAchievement[], external: ExternalAchievement[]): MergedAchievement[] {
  const externalByName = new Map(external.map((item) => [normalizeName(item.name), item]));
  return catalog.map((item) => {
    const match = externalByName.get(normalizeName(item.name));
    const unlocked = match?.unlocked ?? false;
    const secret = !match && !unlocked;
    return {
      id: item.id,
      name: secret ? null : item.name,
      description: secret ? null : item.description,
      iconUrl: match?.iconUrl ?? item.imageUrl,
      rarityPercent: item.percent,
      rarityTier: rarityTier(item.percent),
      unlocked,
      unlockedAt: match?.unlockedAt ?? null,
      secret,
      isCompletionTrophy: isCompletionTrophy(item.name, item.description),
    };
  });
}

export function buildAchievementsResponse(linkedGame: RawgAchievementCandidate | null, catalog: RawgAchievement[], external: ExternalAchievement[]): GameAchievementsResponse {
  const achievements = mergeAchievements(catalog, external);
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const completionTrophy = achievements.find((item) => item.isCompletionTrophy) ?? null;
  const rarityBreakdown = achievements.reduce(
    (acc, item) => {
      if (item.rarityTier === 'COMMON') acc.common += 1;
      else if (item.rarityTier === 'UNCOMMON') acc.uncommon += 1;
      else if (item.rarityTier === 'RARE') acc.rare += 1;
      else acc.ultraRare += 1;
      return acc;
    },
    { common: 0, uncommon: 0, rare: 0, ultraRare: 0 },
  );
  return {
    catalogAvailable: linkedGame !== null,
    linkedGame,
    total: achievements.length,
    unlockedCount,
    percent: achievements.length === 0 ? 0 : Math.round((unlockedCount / achievements.length) * 1000) / 10,
    achievements,
    completionTrophyId: completionTrophy?.id ?? null,
    rarityBreakdown,
  };
}
