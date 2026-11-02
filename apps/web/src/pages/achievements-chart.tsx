import { useEffect, useState, type MouseEvent } from 'react';
import type { AchievementSeriesResponse } from '@gameshelf/contracts';
import { buildCumulativeSeries, niceMax, type SeriesRange } from './achievement-series';
import { apiUrl } from './shared';

const W = 800;
const H = 240;
const PAD = { left: 44, right: 14, top: 12, bottom: 28 };
const integer = new Intl.NumberFormat('pt-BR');
const rangeLabels: Record<SeriesRange, string> = { ALL: 'Todo o período', '12M': 'Últimos 12 meses', YEAR: 'Este ano' };

/**
 * Conquistas desbloqueadas ao longo do tempo, acumuladas, a partir das datas que
 * o Achievist informa. Só conta os jogos vinculados à biblioteca, e não gera
 * horas jogadas: é um retrato de atividade, não de tempo.
 */
export function AchievementsChart({ refreshKey }: { refreshKey?: unknown }) {
  const [series, setSeries] = useState<AchievementSeriesResponse | null>(null);
  const [range, setRange] = useState<SeriesRange>('ALL');
  const [hover, setHover] = useState<{ ratio: number } | null>(null);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ timezoneOffsetMinutes: String(new Date().getTimezoneOffset()) });
    void fetch(`${apiUrl}/stats/achievements?${query}`).then(async (response) => {
      const body = response.ok ? await response.json() as AchievementSeriesResponse : null;
      if (active && body && Array.isArray(body.days)) setSeries(body);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey]);

  if (!series || series.total === 0) return null;

  const { points, start, end, max } = buildCumulativeSeries(series.days, range);
  const top = niceMax(max);
  const x = (time: number) => PAD.left + ((time - start) / Math.max(end - start, 1)) * (W - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / top) * (H - PAD.top - PAD.bottom);
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.time).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.at(-1)!.time).toFixed(1)},${y(0)} L${x(points[0]!.time).toFixed(1)},${y(0)} Z`;
  const yTicks = [0, 1, 2, 3, 4].map((step) => (top / 4) * step);
  const xTicks = Array.from({ length: 6 }, (_, index) => start + ((end - start) / 5) * index);
  const tickLabel = (time: number) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(time)).replace(' de ', '/').replace('.', '');
  const last = points.at(-1)!.value;

  // O mouse vira uma posição no eixo do tempo; o valor é o acumulado naquele dia.
  const plotWidth = W - PAD.left - PAD.right;
  const hoverX = hover ? Math.min(W - PAD.right, Math.max(PAD.left, hover.ratio * W)) : null;
  const hoverTime = hoverX === null ? null : start + ((hoverX - PAD.left) / plotWidth) * (end - start);
  const hoverValue = hoverTime === null ? null : ([...points].reverse().find((point) => point.time <= hoverTime)?.value ?? points[0]!.value);
  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) setHover({ ratio: (event.clientX - rect.left) / rect.width });
  };

  return <section className="panel achievements-chart" aria-labelledby="ach-chart-title">
    <div className="activity-header">
      <h2 id="ach-chart-title">Conquistas ao longo do tempo</h2>
      <select aria-label="Período do gráfico de conquistas" value={range} onChange={(event) => setRange(event.target.value as SeriesRange)}>
        {(Object.keys(rangeLabels) as SeriesRange[]).map((key) => <option key={key} value={key}>{rangeLabels[key]}</option>)}
      </select>
    </div>
    <div className="achievements-chart-plot">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${integer.format(last)} conquistas acumuladas no período`} className="achievements-chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id="ach-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" /></linearGradient></defs>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="achievements-chart-grid" />
        <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="achievements-chart-tick">{integer.format(Math.round(tick))}</text>
      </g>)}
      {xTicks.map((tick) => <text key={tick} x={x(tick)} y={H - 8} textAnchor="middle" className="achievements-chart-tick">{tickLabel(tick)}</text>)}
      <path d={area} fill="url(#ach-area)" />
      <path d={line} fill="none" stroke="#5b8def" strokeWidth="2" strokeLinejoin="round" />
      {hoverX !== null && hoverValue !== null && <g pointerEvents="none">
        <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={H - PAD.bottom} className="achievements-chart-cursor" />
        <circle cx={hoverX} cy={y(hoverValue)} r="4.5" className="achievements-chart-dot" />
      </g>}
    </svg>
    {hoverX !== null && hoverValue !== null && hoverTime !== null && <div
      className={`achievements-chart-tooltip${hoverX / W > 0.7 ? ' is-left' : ''}`} role="status"
      style={{ left: `${(hoverX / W) * 100}%`, top: `${(y(hoverValue) / H) * 100}%` }}>
      <strong>{new Date(hoverTime).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
      <span>conquistas : {integer.format(hoverValue)}</span>
    </div>}
    </div>
    <small>{integer.format(series.total)} conquistas com data, dos jogos vinculados da biblioteca. Mostra atividade, não horas jogadas.</small>
  </section>;
}
