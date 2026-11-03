import type { Game, GoalProgress, Session } from '@gameshelf/contracts';
import { buildDashboard } from '../dashboard/service.js';
import type { GoalRecord } from './repository.js';

type ListInfo = { id: string; name: string; gameIds: string[] };
type Input = {
  goals: GoalRecord[];
  games: Game[];
  sessions: Session[];
  lists?: ListInfo[];
  today: string;
  timezoneOffsetMinutes?: number;
};

const DAY_MS = 86_400_000;
const day = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / DAY_MS;

// Progresso calculado a cada leitura (ADR-011/040): zerados e horas usam o mesmo
// recorte do painel; as demais metas leem lista, sessões e a marcação manual.
export function buildGoalProgress({ goals, games, sessions, lists = [], today, timezoneOffsetMinutes = 0 }: Input): GoalProgress[] {
  const statusById = new Map(games.map((game) => [game.id, game.status as string]));
  return [...goals]
    .sort((a, b) => b.year - a.year || b.month - a.month || a.kind.localeCompare(b.kind) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((goal) => {
      const base = {
        id: goal.id, kind: goal.kind, period: goal.period, year: goal.year, month: goal.period === 'MONTH' ? goal.month : null,
        title: goal.title, description: goal.description, listId: goal.listId, dueDate: goal.dueDate, done: goal.done,
      };
      if (goal.kind === 'COMPLETED_GAMES' || goal.kind === 'PLAYED_HOURS') {
        const { from, to } = periodOf(goal);
        const { periodStats } = buildDashboard({ games, sessions, queue: [], weeklyMinutes: 0, range: { from, to, timezoneOffsetMinutes } });
        const current = goal.kind === 'COMPLETED_GAMES' ? periodStats.gamesCompleted : periodStats.playedHours;
        return finish({ ...base, listName: null, target: goal.target, current }, elapsed(from, to, today));
      }
      const created = goal.createdAt.toISOString().slice(0, 10);
      const elapsedPercent = goal.dueDate ? elapsed(created, goal.dueDate < created ? created : goal.dueDate, today) : 0;
      if (goal.kind === 'COMPLETE_LIST') {
        const list = lists.find((item) => item.id === goal.listId);
        const total = list?.gameIds.length ?? 0;
        const completed = list?.gameIds.filter((id) => statusById.get(id) === 'COMPLETED').length ?? 0;
        return finish({ ...base, listName: list?.name ?? null, target: Math.max(total, 1), current: completed }, elapsedPercent, goal.dueDate !== null);
      }
      if (goal.kind === 'SESSION_HOURS') {
        // A maior sessão encerrada dentro da janela da meta: horas seguidas, não somadas.
        const longest = sessions
          .filter((session) => session.endedAt !== null && session.durationMinutes !== null
            && session.startedAt.slice(0, 10) >= created && (!goal.dueDate || session.startedAt.slice(0, 10) <= goal.dueDate))
          .reduce((max, session) => Math.max(max, session.durationMinutes ?? 0), 0);
        return finish({ ...base, listName: null, target: goal.target, current: round1(longest / 60) }, elapsedPercent, goal.dueDate !== null);
      }
      return finish({ ...base, listName: null, target: 1, current: goal.done ? 1 : 0 }, elapsedPercent, goal.dueDate !== null);
    });
}

function finish(
  goal: Omit<GoalProgress, 'percent' | 'elapsedPercent' | 'achieved' | 'onTrack'>,
  elapsedPercent: number,
  paced = true,
): GoalProgress {
  const percent = round1(Math.min(100, (goal.current / goal.target) * 100));
  const achieved = goal.current >= goal.target;
  // Sem data limite não há ritmo a cobrar.
  return { ...goal, percent, elapsedPercent, achieved, onTrack: achieved || !paced || percent >= elapsedPercent };
}

function periodOf(goal: GoalRecord): { from: string; to: string } {
  if (goal.period === 'YEAR') return { from: `${goal.year}-01-01`, to: `${goal.year}-12-31` };
  const lastDay = new Date(Date.UTC(goal.year, goal.month, 0)).getUTCDate();
  const month = String(goal.month).padStart(2, '0');
  return { from: `${goal.year}-${month}-01`, to: `${goal.year}-${month}-${String(lastDay).padStart(2, '0')}` };
}

function elapsed(from: string, to: string, today: string): number {
  if (today < from) return 0;
  if (today > to) return 100;
  return round1(((day(today) - day(from) + 1) / (day(to) - day(from) + 1)) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
