import type { Game, Session, TimelineAchievement, TimelineEvent } from '@gameshelf/contracts';

/** Um desbloqueio de conquista com data, vindo do espelho do Achievist. */
export type Unlock = {
  gameId: string;
  unlockedAt: Date;
  platformId?: string | null;
  name?: string | null;
  description?: string | null;
  iconUrl?: string | null;
};

const SESSION_TOLERANCE_MS = 30 * 60_000;
const MAX_ICONS = 24;

function localDay(instant: Date, offsetMinutes: number): string {
  return new Date(instant.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

const toAchievement = (unlock: Unlock): TimelineAchievement => ({
  name: unlock.name ?? null, description: unlock.description ?? null, iconUrl: unlock.iconUrl ?? null, unlockedAt: unlock.unlockedAt.toISOString(),
});

/**
 * Liga cada conquista a uma sessão registrada à mão. A sessão é a fonte do tempo;
 * a conquista só a enriquece. Regra: o desbloqueio cai na janela da sessão (com
 * 30 min de folga, porque o horário da sessão é digitado) ou, se nenhuma janela
 * casar, no mesmo dia local de uma única sessão do jogo. Com mais de uma sessão
 * candidata no dia a ligação não é adivinhada: a conquista fica solta.
 */
export function assignUnlocksToSessions(unlocks: Unlock[], sessions: Session[], offsetMinutes: number): { bySession: Map<string, Unlock[]>; loose: Unlock[] } {
  const bySession = new Map<string, Unlock[]>();
  const loose: Unlock[] = [];
  const ended = sessions.filter((session) => session.endedAt !== null);
  for (const unlock of unlocks) {
    const at = unlock.unlockedAt.getTime();
    const mine = ended.filter((session) => session.gameId === unlock.gameId);
    const inWindow = mine.filter((session) => at >= Date.parse(session.startedAt) - SESSION_TOLERANCE_MS && at <= Date.parse(session.endedAt!) + SESSION_TOLERANCE_MS);
    const sameDay = mine.filter((session) => localDay(new Date(session.startedAt), offsetMinutes) === localDay(unlock.unlockedAt, offsetMinutes));
    const target = inWindow.length > 0
      ? inWindow.sort((a, b) => Math.abs(Date.parse(a.startedAt) - at) - Math.abs(Date.parse(b.startedAt) - at))[0]
      : sameDay.length === 1 ? sameDay[0] : undefined;
    if (!target) { loose.push(unlock); continue; }
    bySession.set(target.id, [...(bySession.get(target.id) ?? []), unlock]);
  }
  for (const list of bySession.values()) list.sort((a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime());
  return { bySession, loose };
}

/** Achievements de uma sessão, no formato do contrato da linha do tempo. */
export function sessionAchievements(unlocks: Unlock[] | undefined): TimelineAchievement[] {
  return (unlocks ?? []).slice(0, MAX_ICONS).map(toAchievement);
}

/**
 * Eventos da linha do tempo para conquistas sem sessão: um por jogo e dia local,
 * com a contagem e os primeiros ícones. Agrupar evita centenas de linhas para uma
 * sessão de caça a troféus. O evento fica no instante do último desbloqueio do dia.
 */
export function achievementTimelineEvents(unlocks: Unlock[], games: Game[], offsetMinutes: number): TimelineEvent[] {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const groups = new Map<string, { gameId: string; date: string; unlocks: Unlock[]; last: Date }>();
  for (const unlock of unlocks) {
    if (!gamesById.has(unlock.gameId)) continue;
    const date = localDay(unlock.unlockedAt, offsetMinutes);
    const key = `${unlock.gameId}|${date}`;
    const group = groups.get(key);
    if (group) {
      group.unlocks.push(unlock);
      if (unlock.unlockedAt > group.last) group.last = unlock.unlockedAt;
    } else groups.set(key, { gameId: unlock.gameId, date, unlocks: [unlock], last: unlock.unlockedAt });
  }
  return [...groups.values()].map((group): TimelineEvent => {
    const game = gamesById.get(group.gameId)!;
    const ordered = [...group.unlocks].sort((a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime());
    return {
      type: 'ACHIEVEMENTS_UNLOCKED', at: group.last.toISOString(), date: group.date,
      gameId: game.id, gameTitle: game.title, coverUrl: game.coverUrl, count: group.unlocks.length,
      platformId: ordered[0]?.platformId ?? null, achievements: sessionAchievements(ordered),
    };
  });
}

/** Conquistas desbloqueadas por dia local, em ordem cronológica. */
export function achievementDays(unlocks: Unlock[], offsetMinutes: number): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const unlock of unlocks) {
    const date = localDay(unlock.unlockedAt, offsetMinutes);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}
