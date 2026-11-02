export type AchievementDay = { date: string; count: number };
export type SeriesRange = 'ALL' | '12M' | 'YEAR';
export type SeriesPoint = { time: number; value: number };

const DAY_MS = 86_400_000;
const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Curva acumulada de conquistas dentro da janela escolhida. O acumulado antes da
 * janela vira o ponto de partida, para a curva não "zerar" ao recortar o período.
 */
export function buildCumulativeSeries(days: AchievementDay[], range: SeriesRange, now: Date = new Date()): { points: SeriesPoint[]; start: number; end: number; max: number } {
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const first = days.length ? dayTime(days[0]!.date) : end;
  const start = range === 'ALL' ? first
    : range === '12M' ? end - 365 * DAY_MS
      : Date.UTC(now.getFullYear(), 0, 1);
  let running = 0;
  const points: SeriesPoint[] = [];
  for (const day of days) {
    const time = dayTime(day.date);
    if (time < start) { running += day.count; continue; }
    if (points.length === 0) points.push({ time: start, value: running });
    // Degrau: o valor anterior vale até a véspera do dia do desbloqueio.
    points.push({ time: time - 1, value: running });
    running += day.count;
    points.push({ time, value: running });
  }
  if (points.length === 0) points.push({ time: start, value: running });
  points.push({ time: Math.max(end, start), value: running });
  return { points, start, end: Math.max(end, start + DAY_MS), max: Math.max(running, 1) };
}

/** Teto "redondo" do eixo vertical, para a escala ter marcações legíveis. */
export function niceMax(value: number): number {
  const quarter = Math.max(value, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(quarter));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= quarter) ?? 10 * magnitude;
  return Math.ceil(step) * 4;
}
