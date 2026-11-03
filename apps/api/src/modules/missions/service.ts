import type { Game, Mission, Session } from '@gameshelf/contracts';
import type { MissionRecord } from './repository.js';

type ListInfo = { id: string; name: string; gameIds: string[] };

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Progresso das missões, calculado na leitura:
 * - LIST: jogos zerados da lista;
 * - GAMES_COUNT: jogos concluídos dentro da janela da missão;
 * - HOURS: horas de sessão dentro da janela da missão;
 * - CUSTOM: marcação manual.
 * A janela vai de `startsOn` até `dueDate` (ou sem fim).
 */
export function buildMissionProgress(missions: MissionRecord[], games: Game[], sessions: Session[], lists: ListInfo[]): Mission[] {
  const statusById = new Map(games.map((game) => [game.id, game.status as string]));
  return missions.map((mission) => {
    const inWindow = (date: string | null) => date !== null && date.slice(0, 10) >= mission.startsOn && (!mission.dueDate || date.slice(0, 10) <= mission.dueDate);
    const list = mission.listId ? lists.find((item) => item.id === mission.listId) : undefined;
    let current = 0;
    let target = mission.target ?? 1;
    if (mission.kind === 'LIST') {
      target = Math.max(list?.gameIds.length ?? 0, 1);
      current = list?.gameIds.filter((id) => statusById.get(id) === 'COMPLETED').length ?? 0;
    } else if (mission.kind === 'GAMES_COUNT') {
      current = games.filter((game) => game.status === 'COMPLETED' && inWindow(game.completedAt)).length;
    } else if (mission.kind === 'HOURS') {
      current = round1(sessions.filter((session) => inWindow(session.startedAt)).reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0) / 60);
    } else {
      current = mission.done ? 1 : 0;
      target = 1;
    }
    const achieved = current >= target;
    return {
      id: mission.id, title: mission.title, description: mission.description, kind: mission.kind,
      listId: mission.listId, listName: list?.name ?? null, target, current,
      percent: round1(Math.min(100, (current / target) * 100)),
      startsOn: mission.startsOn, dueDate: mission.dueDate, done: mission.kind === 'CUSTOM' ? mission.done : achieved,
      achieved, isPrimary: mission.isPrimary,
    };
  });
}
