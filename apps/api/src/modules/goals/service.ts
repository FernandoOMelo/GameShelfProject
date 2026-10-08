import type { Game, GoalProgress, Session } from '@gameshelf/contracts';
import { buildDashboard } from '../dashboard/service.js';
import type { GoalRecord } from './repository.js';

type Input = { goals: GoalRecord[]; games: Game[]; sessions: Session[]; today: string; timezoneOffsetMinutes?: number };

const DAY_MS = 86_400_000;

// Progresso calculado a cada leitura (ADR-011): zerados e horas usam o mesmo recorte do painel.
export function buildGoalProgress({ goals, games, sessions, today, timezoneOffsetMinutes = 0 }: Input): GoalProgress[] {
  return [...goals]
    .sort((a, b) => b.year - a.year || b.month - a.month || a.kind.localeCompare(b.kind))
    .map((goal) => {
      const { from, to } = periodOf(goal);
      const { periodStats } = buildDashboard({ games, sessions, queue: [], weeklyMinutes: 0, range: { from, to, timezoneOffsetMinutes } });
      const current = goal.kind === 'COMPLETED_GAMES' ? periodStats.gamesCompleted : periodStats.playedHours;
      const percent = round1(Math.min(100, (current / goal.target) * 100));
      const elapsedPercent = elapsed(from, to, today);
      const achieved = current >= goal.target;
      return {
        id: goal.id, kind: goal.kind, period: goal.period, year: goal.year, month: goal.period === 'MONTH' ? goal.month : null,
        target: goal.target, current, percent, elapsedPercent, achieved, onTrack: achieved || percent >= elapsedPercent,
      };
    });
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
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / DAY_MS;
  return round1(((day(today) - day(from) + 1) / (day(to) - day(from) + 1)) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
