import { useEffect, useState } from 'react';
import type { ActivityResponse } from '@gameshelf/contracts';
import { apiUrl, formatCompactHours } from './shared';

const DAY_MS = 86_400_000;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function level(minutes: number, max: number): number {
  if (minutes <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((minutes / max) * 4));
}

export function ActivityHeatmap({ refreshKey }: { refreshKey: unknown }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    const query = new URLSearchParams({ year: String(year), timezoneOffsetMinutes: String(new Date().getTimezoneOffset()) });
    void fetch(`${apiUrl}/stats/activity?${query}`).then(async (response) => {
      const body = response.ok ? await response.json() as ActivityResponse : null;
      if (!active) return;
      if (body && Array.isArray(body.days)) setActivity(body); else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [year, refreshKey]);

  const minutesByDate = new Map((activity?.days ?? []).map((day) => [day.date, day.minutes]));
  const jan1 = Date.UTC(year, 0, 1);
  const totalDays = Math.round((Date.UTC(year + 1, 0, 1) - jan1) / DAY_MS);
  const leading = new Date(jan1).getUTCDay();
  const cells = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(jan1 + index * DAY_MS).toISOString().slice(0, 10);
    return { date, minutes: minutesByDate.get(date) ?? 0 };
  });
  const weeks = Math.ceil((leading + totalDays) / 7);
  const monthLabels = MONTHS.map((name, month) => ({ name, column: Math.floor((leading + Math.round((Date.UTC(year, month, 1) - jan1) / DAY_MS)) / 7) }));

  return <section className="panel" aria-labelledby="activity-title">
    <div className="activity-header">
      <h2 id="activity-title">Atividade</h2>
      <div className="activity-year">
        <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)}>‹</button>
        <strong>{year}</strong>
        <button type="button" aria-label="Próximo ano" disabled={year >= currentYear} onClick={() => setYear(year + 1)}>›</button>
      </div>
    </div>
    {failed ? <p className="dashboard-empty" role="alert">Não foi possível carregar a atividade.</p> : !activity ? <p role="status">Carregando atividade…</p> : <>
      <div className="activity-scroll">
        <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }} aria-hidden="true">
          {monthLabels.map((month) => <span key={month.name} style={{ gridColumn: month.column + 1 }}>{month.name}</span>)}
        </div>
        <div className="heatmap" role="img" aria-label={`Mapa de atividade de ${year}: ${activity.activeDays} dias jogados`} style={{ gridTemplateRows: 'repeat(7, 12px)' }}>
          {Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} className="heatmap-pad" />)}
          {cells.map((cell) => <span key={cell.date} className={`heatmap-cell heatmap-level-${level(cell.minutes, activity.maxDayMinutes)}`}
            title={`${new Date(`${cell.date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}: ${cell.minutes ? formatCompactHours(cell.minutes / 60) : 'sem sessões'}`} />)}
        </div>
      </div>
      <dl className="activity-summary">
        <div><dt>Dias jogados</dt><dd>{activity.activeDays}</dd></div>
        <div><dt>Horas no ano</dt><dd>{formatCompactHours(activity.totalMinutes / 60)}</dd></div>
        <div><dt>Sequência atual</dt><dd>{activity.currentStreak} {activity.currentStreak === 1 ? 'dia' : 'dias'}</dd></div>
        <div><dt>Maior sequência</dt><dd>{activity.longestStreak} {activity.longestStreak === 1 ? 'dia' : 'dias'}</dd></div>
      </dl>
      <small>Conta apenas sessões registradas; horas retroativas não têm data e ficam de fora.</small>
    </>}
  </section>;
}
