import type { AchievementGroup, ExternalAchievement, GameAchievementsResponse, MergedAchievement, RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';

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
 * Monta a lista de conquistas do jogo. A RAWG só cataloga as conquistas do
 * Steam (em inglês, sem idioma configurável) e não informa secretas; o
 * Achievist espelha o catálogo completo da plataforma do usuário (ex.: os 61
 * troféus do PSN, no idioma da conta, com desbloqueios). Por isso:
 * - com dados do Achievist, eles são a lista e a RAWG só completa ícone,
 *   descrição e raridade que faltarem, casando por nome;
 * - sem dados do Achievist, a lista é o catálogo da RAWG, sem secretas;
 * - secreta = ainda bloqueada e sem descrição na fonte (a PSN omite os
 *   detalhes até desbloquear).
 */
export function mergeAchievements(catalog: RawgAchievement[], external: ExternalAchievement[]): MergedAchievement[] {
  if (external.length === 0) {
    return catalog.map((item) => ({
      id: item.id, name: item.name, description: item.description, iconUrl: item.imageUrl, rarityPercent: item.percent,
      rarityTier: rarityTier(item.percent), unlocked: false, unlockedAt: null, secret: false,
      isCompletionTrophy: isCompletionTrophy(item.name, item.description),
    }));
  }
  const catalogByName = new Map(catalog.map((item) => [normalizeName(item.name), item]));
  const unique = new Map<string, ExternalAchievement>();
  for (const item of external) {
    const key = normalizeName(item.name);
    const current = unique.get(key);
    if (!current || (!current.unlocked && item.unlocked)) unique.set(key, item);
  }
  return [...unique.values()].map((item) => {
    const reference = catalogByName.get(normalizeName(item.name));
    const description = item.description ?? reference?.description ?? null;
    const secret = !item.unlocked && description === null;
    const rarityPercent = item.rarityPercent ?? reference?.percent ?? null;
    return {
      id: item.id,
      name: secret ? null : item.name,
      description: secret ? null : description,
      iconUrl: item.iconUrl ?? reference?.imageUrl ?? null,
      rarityPercent,
      rarityTier: rarityTier(rarityPercent),
      unlocked: item.unlocked,
      unlockedAt: item.unlockedAt,
      secret,
      isCompletionTrophy: isCompletionTrophy(item.name, description),
    };
  });
}

export type ExternalAchievementGroup = {
  /** Id da associação de plataforma (game_platforms). */
  id: string;
  platformId: string;
  name: string;
  items: ExternalAchievement[];
};

function summarize(achievements: MergedAchievement[]) {
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  return {
    total: achievements.length,
    unlockedCount,
    percent: achievements.length === 0 ? 0 : Math.round((unlockedCount / achievements.length) * 1000) / 10,
    completionTrophyId: achievements.find((item) => item.isCompletionTrophy)?.id ?? null,
  };
}

/**
 * Monta a resposta de conquistas do jogo. Cada plataforma com conquistas
 * espelhadas vira um grupo próprio — a mesma conquista do mesmo jogo em duas
 * plataformas são dois troféus distintos e nunca se fundem. Sem nenhuma fonte
 * pessoal, o catálogo RAWG forma um único grupo. Os totais da raiz somam os
 * grupos.
 */
export function buildAchievementsResponse(linkedGame: RawgAchievementCandidate | null, catalog: RawgAchievement[], externalGroups: ExternalAchievementGroup[]): GameAchievementsResponse {
  const populated = externalGroups.filter((group) => group.items.length > 0);
  const groups: AchievementGroup[] = populated.length === 0
    ? (catalog.length === 0 ? [] : [{ id: 'catalog', platformId: null, name: 'Catálogo RAWG', ...summarize(mergeAchievements(catalog, [])), achievements: mergeAchievements(catalog, []) }])
    : populated.map((group) => {
      const achievements = mergeAchievements(catalog, group.items);
      return { id: group.id, platformId: group.platformId, name: group.name, ...summarize(achievements), achievements };
    });
  const achievements = groups.flatMap((group) => group.achievements);
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
    catalogAvailable: linkedGame !== null || populated.length > 0,
    linkedGame,
    ...summarize(achievements),
    achievements,
    groups,
    rarityBreakdown,
  };
}
