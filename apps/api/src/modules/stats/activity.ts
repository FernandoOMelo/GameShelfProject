import type { ActivityResponse, Session } from '@gameshelf/contracts';

type Input = { sessions: Session[]; year: number; today: string; timezoneOffsetMinutes?: number };

const DAY_MS = 86_400_000;

// Minutos por dia a partir das sessões encerradas, atribuídos ao dia local de início.
// Sequências consideram todo o histórico; o heatmap apenas o ano pedido.
export function buildActivity({ sessions, year, today, timezoneOffsetMinutes = 0 }: Input): ActivityResponse {
  const minutesByDay = new Map<string, number>();
  for (const session of sessions) {
    if (session.durationMinutes === null || session.durationMinutes <= 0) continue;
    const localStart = new Date(Date.parse(session.startedAt) - timezoneOffsetMinutes * 60_000);
    const day = localStart.toISOString().slice(0, 10);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + session.durationMinutes);
  }

  const days = [...minutesByDay].filter(([date]) => date.startsWith(`${year}-`))
    .map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date));

  const activeDates = [...minutesByDay.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  for (const [index, date] of activeDates.entries()) {
    run = index > 0 && dayNumber(date) - dayNumber(activeDates[index - 1]!) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  // A sequência atual continua válida se o último dia jogado foi hoje ou ontem.
  let currentStreak = 0;
  let cursor = minutesByDay.has(today) ? dayNumber(today) : dayNumber(today) - 1;
  while (minutesByDay.has(dateOf(cursor))) { currentStreak += 1; cursor -= 1; }

  return {
    year, days,
    activeDays: days.length,
    totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    maxDayMinutes: days.reduce((max, day) => Math.max(max, day.minutes), 0),
    currentStreak, longestStreak,
  };
}

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function dateOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
