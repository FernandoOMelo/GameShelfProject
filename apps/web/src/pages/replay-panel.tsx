import { useEffect, useState } from 'react';
import type { ReplayResponse } from '@gameshelf/contracts';
import { apiUrl, formatCompactHours } from './shared';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function ReplayPanel({ refreshKey, onOpenGame }: { refreshKey: unknown; onOpenGame: (gameId: string) => void }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    const query = new URLSearchParams({ year: String(year), timezoneOffsetMinutes: String(new Date().getTimezoneOffset()) });
    void fetch(`${apiUrl}/stats/replay?${query}`).then(async (response) => {
      const body = response.ok ? await response.json() as ReplayResponse : null;
      if (!active) return;
      if (body && typeof body.totalMinutes === 'number') setReplay(body); else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [year, refreshKey]);

  const empty = replay !== null && replay.sessionCount === 0 && replay.completedCount === 0;

  return <section className="panel" aria-labelledby="replay-title">
    <div className="activity-header">
      <h2 id="replay-title">Replay do ano</h2>
      <div className="activity-year">
        <button type="button" aria-label="Replay do ano anterior" onClick={() => setYear(year - 1)}>‹</button>
        <strong>{year}</strong>
        <button type="button" aria-label="Replay do próximo ano" disabled={year >= currentYear} onClick={() => setYear(year + 1)}>›</button>
      </div>
    </div>
    {failed ? <p className="dashboard-empty" role="alert">Não foi possível carregar o replay.</p> : !replay ? <p role="status">Carregando replay…</p> : empty ? <p className="dashboard-empty">Nada registrado em {year}.</p> : <>
      <dl className="activity-summary">
        <div><dt>Horas jogadas</dt><dd>{formatCompactHours(replay.totalMinutes / 60)}</dd></div>
        <div><dt>Sessões</dt><dd>{replay.sessionCount}</dd></div>
        <div><dt>Dias jogados</dt><dd>{replay.activeDays}</dd></div>
        <div><dt>Jogos zerados</dt><dd>{replay.completedCount}</dd></div>
      </dl>
      <ul className="replay-highlights">
        {replay.mostPlayedGame && <li><span>Jogo mais jogado</span><button type="button" onClick={() => onOpenGame(replay.mostPlayedGame!.id)}>{replay.mostPlayedGame.title}</button><em>{formatCompactHours(replay.mostPlayedGame.minutes / 60)}</em></li>}
        {replay.topGenre && <li><span>Gênero mais jogado</span><strong>{replay.topGenre.name}</strong><em>{formatCompactHours(replay.topGenre.minutes / 60)}</em></li>}
        {replay.busiestMonth && <li><span>Mês mais ativo</span><strong>{MONTHS[replay.busiestMonth.month - 1]}</strong><em>{formatCompactHours(replay.busiestMonth.minutes / 60)}</em></li>}
        {replay.longestSession && <li><span>Maior sessão</span><button type="button" onClick={() => onOpenGame(replay.longestSession!.gameId)}>{replay.longestSession.title}</button><em>{formatCompactHours(replay.longestSession.minutes / 60)} em {new Date(`${replay.longestSession.date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</em></li>}
        {replay.gameOfYear && <li><span>Jogo do ano</span><button type="button" onClick={() => onOpenGame(replay.gameOfYear!.id)}>{replay.gameOfYear.title}</button></li>}
      </ul>
    </>}
  </section>;
}
