import { useEffect, useState, type FormEvent } from 'react';
import type { DashboardResponse, Game, GameListSummary, MainChallenge, QueueItem, Session } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { GoalsCard } from './goals-card';
import { apiUrl, formatCompactHours, formatDateTime, formatElapsed, formatHours, statusColors } from './shared';

export type DashboardPeriod = '7d' | 'month' | 'year' | 'custom' | 'all';

const statusSegments: Array<{ status: keyof typeof statusColors; label: string; count: (dashboard: DashboardResponse) => number }> = [
  { status: 'PLAYING', label: 'Jogando', count: (d) => d.playingCount },
  { status: 'PAUSED', label: 'Pausados', count: (d) => d.pausedCount },
  { status: 'COMPLETED', label: 'Zerados', count: (d) => d.completedCount },
  { status: 'ABANDONED', label: 'Abandonados', count: (d) => d.abandonedCount },
  { status: 'BACKLOG', label: 'Na biblioteca', count: (d) => d.backlogCount },
  { status: 'DESIRED', label: 'Desejados', count: (d) => d.desiredCount },
];

export function DashboardView({ dashboard, queue, now, period, customPeriod, onPeriodChange, onCustomPeriodChange, onRefresh, onSelectGame, onStartSession, onFinishSession, onPauseGame, onPrepareStatus, onOpenQueue }: {
  dashboard: DashboardResponse | null;
  queue: QueueItem[];
  now: number;
  period: DashboardPeriod;
  customPeriod: { from: string; to: string };
  onPeriodChange: (period: DashboardPeriod) => void;
  onCustomPeriodChange: (value: { from: string; to: string }) => void;
  onRefresh: () => Promise<void>;
  onSelectGame: (game: Game) => void;
  onStartSession: (game: Game) => Promise<void>;
  onFinishSession: (game: Game, session: Session) => Promise<void>;
  onPauseGame: (game: Game) => void;
  onPrepareStatus: (game: Game, status: Game['status']) => void;
  onOpenQueue: () => void;
}) {
  const [weeklyMinutes, setWeeklyMinutes] = useState(String(dashboard?.weeklyHours ? Math.round(dashboard.weeklyHours * 60) : 0));
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (dashboard) setWeeklyMinutes(String(Math.round(dashboard.weeklyHours * 60))); }, [dashboard?.weeklyHours]);

  async function saveWeeklyGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/planning/settings`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weeklyMinutes: Number(weeklyMinutes) }),
    });
    if (!response.ok) { setFeedback('Não foi possível salvar a meta semanal.'); return; }
    await onRefresh();
    setFeedback('Meta semanal salva.');
  }

  const periodStats = dashboard?.periodStats ?? { playedHours: 0, sessions: 0, gamesPlayed: 0, gamesCompleted: 0 };
  const playingGames = dashboard?.playingGames ?? (dashboard?.currentGame ? [{ ...dashboard.currentGame, activeSession: dashboard.currentGame.activeSession ?? null }] : []);
  const byYear = [...(dashboard?.completionByYear ?? [])].sort((a, b) => a.year - b.year).slice(-10);
  const maxYear = Math.max(1, ...byYear.map((entry) => entry.gameCount));
  const segments = dashboard ? statusSegments.map((segment) => ({ ...segment, value: segment.count(dashboard) })) : [];
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);

  return <section className="dashboard-page" aria-labelledby="dashboard-title">
    <div className="dashboard-hero">
      <div><p className="eyebrow">VISÃO GERAL</p><h1 id="dashboard-title">Seu ritmo de jogo</h1><p className="library-subtitle">O que está em andamento, quanto já foi jogado e o que vem pela frente.</p></div>
      <div className="dashboard-period"><label className="filter-field">Período<select aria-label="Período do painel" value={period} onChange={(event) => onPeriodChange(event.target.value as DashboardPeriod)}><option value="7d">Últimos 7 dias</option><option value="month">Mês atual</option><option value="year">Ano atual</option><option value="custom">Personalizado</option><option value="all">Todo o período</option></select></label>{period === 'custom' && <><label className="filter-field">De<input aria-label="Data inicial do período" type="date" value={customPeriod.from} onChange={(event) => onCustomPeriodChange({ ...customPeriod, from: event.target.value })} /></label><label className="filter-field">Até<input aria-label="Data final do período" type="date" value={customPeriod.to} onChange={(event) => onCustomPeriodChange({ ...customPeriod, to: event.target.value })} /></label></>}</div>
    </div>
    {!dashboard ? <p role="status">Carregando painel…</p> : <>
      <div className="kpi-grid" aria-label="Indicadores do período">
        <Kpi label="Horas jogadas no período" value={formatHours(periodStats.playedHours)} accent />
        <Kpi label="Sessões no período" value={String(periodStats.sessions)} />
        <Kpi label="Jogos jogados no período" value={String(periodStats.gamesPlayed)} />
        <Kpi label="Jogos zerados no período" value={String(periodStats.gamesCompleted)} />
      </div>

      <section className="playing-now"><h2>Jogando agora</h2>
        {playingGames.length ? <div className="playing-grid">{playingGames.map((entry) => {
          const percent = entry.progress ?? (entry.estimatedHours ? Math.min(100, Math.round((entry.playedHours / entry.estimatedHours) * 100)) : null);
          return <article className="current-game-panel" key={entry.game.id}>
            {entry.game.coverUrl ? <img className="current-game-cover" src={entry.game.coverUrl} alt={`Capa de ${entry.game.title}`} /> : <span className="current-game-cover current-game-placeholder" aria-hidden="true">▧</span>}
            <div className="current-game-body">
              <button className="dashboard-game-title" type="button" onClick={() => onSelectGame(entry.game)}><h3>{entry.game.title}</h3></button>
              <p>{entry.playedHours} h jogadas{entry.progress === null ? '' : ` · ${entry.progress}%`}</p>
              {percent !== null && <div className="progress-track" role="img" aria-label={`Progresso ${percent}%`}><span style={{ width: `${percent}%` }} /></div>}
              {entry.activeSession ? <p className="session-live-duration">Sessão ativa · {formatElapsed(entry.activeSession.startedAt, now)}</p> : entry.lastSession && <p>Última sessão: {formatDateTime(entry.lastSession.startedAt)}</p>}
              {entry.lastSession?.location && <p>Parou em: {entry.lastSession.location}</p>}
              {entry.remainingHours !== null && <p>{entry.remainingHours} h estimadas restantes</p>}
              <div className="dashboard-game-actions"><Button type="button" onClick={() => entry.activeSession ? void onFinishSession(entry.game, entry.activeSession) : void onStartSession(entry.game)}>{entry.activeSession ? 'Encerrar sessão' : 'Continuar jogando'}</Button><button type="button" className="session-edit" onClick={() => onPauseGame(entry.game)}>Pausar</button><button type="button" className="session-edit" onClick={() => onPrepareStatus(entry.game, 'COMPLETED')}>Marcar zerado</button><button type="button" className="session-edit" onClick={() => onPrepareStatus(entry.game, 'ABANDONED')}>Abandonar</button><button type="button" className="session-edit" onClick={() => onSelectGame(entry.game)}>Abrir detalhes</button></div>
            </div>
          </article>;
        })}</div> : <p className="dashboard-empty">Nenhum jogo marcado como em andamento.</p>}
      </section>

      <div className="dashboard-columns">
        <section className="panel" aria-labelledby="status-panel-title">
          <h2 id="status-panel-title">Biblioteca por estado</h2>
          <p className="panel-figure"><strong>{dashboard.gameCount}</strong> jogos no catálogo{dashboard.archivedCount > 0 ? ` · ${dashboard.archivedCount} arquivados` : ''}</p>
          <div className="stacked-bar" role="img" aria-label="Distribuição dos jogos por estado">{segments.filter((segment) => segment.value > 0).map((segment) => <span key={segment.status} title={`${segment.label}: ${segment.value}`} style={{ flexGrow: segment.value, background: statusColors[segment.status] }} />)}{segmentTotal === 0 && <span className="stacked-empty" />}</div>
          <ul className="legend-list">{segments.map((segment) => <li key={segment.status}><span className="legend-swatch" style={{ background: statusColors[segment.status] }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.value}</strong></li>)}</ul>
        </section>

        <section className="panel" aria-labelledby="year-panel-title">
          <h2 id="year-panel-title">Zerados por ano</h2>
          {byYear.length ? <ol className="bar-chart" aria-label="Jogos zerados por ano">{byYear.map((entry) => <li key={entry.year} title={`${entry.year}: ${entry.gameCount} jogos zerados`}><span className="bar-value">{entry.gameCount}</span><span className="bar" style={{ height: `${Math.max(4, (entry.gameCount / maxYear) * 100)}%` }} /><span className="bar-label">{entry.year}</span></li>)}</ol> : <p className="dashboard-empty">Nenhuma conclusão com data registrada.</p>}
          <small>Cada jogo conta uma vez por período, mesmo que tenha sido zerado em mais de uma plataforma.</small>
        </section>
      </div>

      <div className="kpi-grid kpi-grid-secondary" aria-label="Resumo geral">
        <Kpi label="Tempo jogado · todo período" value={formatCompactHours(dashboard.totalPlayedHours)} />
        <Kpi label="Horas restantes no backlog" value={formatCompactHours(dashboard.backlogRemainingHours)} />
        <Kpi label="Horas disponíveis por semana" value={formatCompactHours(dashboard.weeklyHours)} />
        <Kpi label="Em andamento" value={String(dashboard.playingCount)} />
      </div>

      <BacklogForecast forecast={dashboard.backlogForecast} remainingHours={dashboard.backlogRemainingHours} onSelectGame={onSelectGame} />

      <GoalsCard />

      <ChallengeCard />

      <section className="dashboard-bottom">
        <div className="panel"><div className="section-heading"><h2>Próximos da fila</h2><button type="button" className="session-edit" onClick={onOpenQueue}>Ver fila completa</button></div>{queue.length ? <ol className="dashboard-queue">{queue.slice(0, 3).map((item) => <li key={item.game.id}><button type="button" onClick={() => onSelectGame(item.game)}>{item.position + 1}. {item.game.title}</button></li>)}</ol> : <p className="dashboard-empty">Sua fila está vazia.</p>}<p>{dashboard.queueRemainingHours} h estimadas na fila{dashboard.estimatedQueueWeeks === null ? '' : ` · cerca de ${dashboard.estimatedQueueWeeks} semanas`}</p></div>
        <form className="weekly-goal-form panel" onSubmit={(event) => void saveWeeklyGoal(event)}><h2>Meta semanal</h2><label className="form-field">Minutos disponíveis por semana<input aria-label="Minutos disponíveis por semana" type="number" min="0" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} /></label><Button type="submit">Salvar meta</Button>{feedback && <p role="status">{feedback}</p>}</form>
      </section>
    </>}
  </section>;
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <article className={`stat-card${accent ? ' stat-card-accent' : ''}`}><span>{label}</span><strong>{value}</strong></article>;
}

function BacklogForecast({ forecast, remainingHours, onSelectGame }: { forecast: DashboardResponse['backlogForecast']; remainingHours: number; onSelectGame: (game: Game) => void }) {
  const months = forecast.estimatedMonths;
  return <section className="panel" aria-labelledby="forecast-title">
    <h2 id="forecast-title">Previsão do backlog</h2>
    {months === null
      ? <p className="dashboard-empty">Defina a meta semanal para ver quando o backlog acaba.</p>
      : <p className="panel-figure">No seu ritmo, as {formatCompactHours(remainingHours)} restantes levam cerca de <strong>{months.toLocaleString('pt-BR')} {months === 1 ? 'mês' : 'meses'}</strong> ({forecast.estimatedWeeks?.toLocaleString('pt-BR')} semanas).</p>}
    {forecast.gamesWithoutEstimate > 0 && <small>{forecast.gamesWithoutEstimate} {forecast.gamesWithoutEstimate === 1 ? 'jogo sem estimativa não entra' : 'jogos sem estimativa não entram'} na conta.</small>}
    <h3 className="forecast-subtitle">Parados há mais tempo</h3>
    {forecast.stalledGames.length
      ? <ul className="rank-list">{forecast.stalledGames.map((entry) => <li key={entry.game.id}><button type="button" onClick={() => onSelectGame(entry.game)}>{entry.game.title}</button><span>{entry.daysStalled} dias{entry.remainingHours === null ? '' : ` · faltam ${formatCompactHours(entry.remainingHours)}`}</span></li>)}</ul>
      : <p className="dashboard-empty">Nenhum jogo em andamento ou pausado parado há 30 dias ou mais.</p>}
    <small>Candidatos a pausar de vez ou abandonar: jogos em andamento ou pausados sem sessão recente.</small>
  </section>;
}

function ChallengeCard() {
  const [challenge, setChallenge] = useState<MainChallenge | null>(null);
  const [lists, setLists] = useState<GameListSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [challengeResponse, listsResponse] = await Promise.all([fetch(`${apiUrl}/challenge`), fetch(`${apiUrl}/lists`)]);
      const body = challengeResponse.ok ? await challengeResponse.json() as MainChallenge | null : null;
      setChallenge(body && typeof body === 'object' && 'title' in body ? body : null);
      const items = listsResponse.ok ? await listsResponse.json() as GameListSummary[] : [];
      setLists(Array.isArray(items) ? items : []);
    } catch { setChallenge(null); }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/challenge`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, listId }) });
    if (!response.ok) { setMessage('Não foi possível salvar a missão.'); return; }
    setMessage('');
    setEditing(false);
    await load();
  }

  async function clear() {
    const response = await fetch(`${apiUrl}/challenge`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível remover a missão.'); return; }
    setEditing(false);
    await load();
  }

  return <section className="panel challenge-card" aria-labelledby="challenge-title">
    <div className="section-heading"><h2 id="challenge-title">Missão principal</h2>{!editing && <button type="button" className="session-edit" onClick={() => { setTitle(challenge?.title ?? ''); setListId(challenge?.listId ?? lists[0]?.id ?? ''); setEditing(true); }}>{challenge ? 'Editar missão' : 'Definir missão'}</button>}</div>
    {editing ? <form className="challenge-form" onSubmit={(event) => void save(event)}>
      <label className="form-field">Objetivo<input aria-label="Objetivo da missão" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Zerar todos os clássicos do SNES" /></label>
      <label className="form-field">Lista acompanhada<select aria-label="Lista da missão" required value={listId} onChange={(event) => setListId(event.target.value)}><option value="">Selecione uma lista</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.gameCount})</option>)}</select></label>
      <div className="challenge-actions"><Button type="submit" disabled={!listId}>Salvar missão</Button><button type="button" className="cancel-button" onClick={() => setEditing(false)}>Cancelar</button>{challenge && <button type="button" className="session-delete" onClick={() => void clear()}>Remover missão</button>}</div>
      {lists.length === 0 && <small>Crie uma lista na aba Listas para acompanhá-la como missão.</small>}
    </form> : challenge ? <>
      <p className="challenge-title">{challenge.title}</p>
      <p className="panel-figure"><strong>{challenge.completedGames} / {challenge.totalGames}</strong> zerados ({String(challenge.percent).replace('.', ',')}%) · lista {challenge.listName}</p>
      <div className="progress-track progress-track-large" role="img" aria-label={`Missão ${challenge.percent}% completa`}><span style={{ width: `${challenge.percent}%` }} /></div>
    </> : <p className="dashboard-empty">Defina um objetivo de longo prazo acompanhando uma lista de jogos.</p>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
