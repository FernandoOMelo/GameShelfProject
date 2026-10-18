import { useEffect, useState, type FormEvent } from 'react';
import type { DashboardResponse, Game, GameListSummary, MainChallenge, Platform, QueueItem, Session } from '@gameshelf/contracts';
import { Button, Panel, StatCard } from '@gameshelf/ui';
import { AchievistSyncPanel } from './achievist-sync-panel';
import { BackupCard } from './backup-card';
import { GoalsCard } from './goals-card';
import { apiUrl, formatCompactHours, formatDateTime, formatElapsed, formatHours, statusColors } from './shared';

export type DashboardPeriod = '7d' | 'month' | 'year' | 'custom' | 'all';
export type LibraryFilter = { status?: Game['status']; completedYear?: string };

const statusSegments: Array<{ status: keyof typeof statusColors; label: string; count: (dashboard: DashboardResponse) => number }> = [
  { status: 'PLAYING', label: 'Jogando', count: (d) => d.playingCount },
  { status: 'PAUSED', label: 'Pausados', count: (d) => d.pausedCount },
  { status: 'COMPLETED', label: 'Zerados', count: (d) => d.completedCount },
  { status: 'ABANDONED', label: 'Abandonados', count: (d) => d.abandonedCount },
  { status: 'BACKLOG', label: 'Na biblioteca', count: (d) => d.backlogCount },
  { status: 'DESIRED', label: 'Desejados', count: (d) => d.desiredCount },
];

/**
 * Texto curto de comparação com o período anterior. Sem base de comparação
 * (período anterior zerado) o indicador é omitido em vez de exibir ∞.
 */
function formatPeriodDelta(current: number, previous: number): string | undefined {
  if (previous <= 0) return undefined;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return 'igual ao período anterior';
  return `${percent > 0 ? '▲' : '▼'} ${Math.abs(percent)}% vs. período anterior`;
}

export function DashboardView({ dashboard, previousPeriodStats, queue, now, period, customPeriod, games, platforms, onPeriodChange, onCustomPeriodChange, onRefresh, onSelectGame, onStartSession, onFinishSession, onPauseGame, onPrepareStatus, onOpenQueue, onFilterLibrary }: {
  dashboard: DashboardResponse | null;
  /** Indicadores do período imediatamente anterior, quando existe comparação. */
  previousPeriodStats?: DashboardResponse['periodStats'] | null;
  queue: QueueItem[];
  now: number;
  period: DashboardPeriod;
  customPeriod: { from: string; to: string };
  games: Game[];
  platforms: Platform[];
  onPeriodChange: (period: DashboardPeriod) => void;
  onCustomPeriodChange: (value: { from: string; to: string }) => void;
  onRefresh: () => Promise<void>;
  onSelectGame: (game: Game) => void;
  onStartSession: (game: Game) => Promise<void>;
  onFinishSession: (game: Game, session: Session) => Promise<void>;
  onPauseGame: (game: Game) => void;
  onPrepareStatus: (game: Game, status: Game['status']) => void;
  onOpenQueue: () => void;
  onFilterLibrary?: (filter: LibraryFilter) => void;
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
  const delta = (current: number, previous: number | undefined) => (previous === undefined ? undefined : formatPeriodDelta(current, previous));
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
        <StatCard label="Horas jogadas no período" value={formatHours(periodStats.playedHours)} delta={delta(periodStats.playedHours, previousPeriodStats?.playedHours)} accent />
        <StatCard label="Sessões no período" value={String(periodStats.sessions)} delta={delta(periodStats.sessions, previousPeriodStats?.sessions)} />
        <StatCard label="Jogos jogados no período" value={String(periodStats.gamesPlayed)} delta={delta(periodStats.gamesPlayed, previousPeriodStats?.gamesPlayed)} />
        <StatCard label="Jogos zerados no período" value={String(periodStats.gamesCompleted)} delta={delta(periodStats.gamesCompleted, previousPeriodStats?.gamesCompleted)} onClick={onFilterLibrary && (() => onFilterLibrary({ status: 'COMPLETED' }))} />
      </div>

      <div className="kpi-grid kpi-grid-secondary" aria-label="Resumo geral">
        <StatCard label="Tempo jogado · todo período" value={formatCompactHours(dashboard.totalPlayedHours)} />
        <StatCard label="Horas restantes no backlog" value={formatCompactHours(dashboard.backlogRemainingHours)} onClick={onFilterLibrary && (() => onFilterLibrary({ status: 'BACKLOG' }))} />
        <StatCard label="Horas disponíveis por semana" value={formatCompactHours(dashboard.weeklyHours)} />
        <StatCard label="Em andamento" value={String(dashboard.playingCount)} onClick={onFilterLibrary && (() => onFilterLibrary({ status: 'PLAYING' }))} />
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
        <Panel title="Biblioteca por estado" titleId="status-panel-title">
          <p className="panel-figure"><strong>{dashboard.gameCount}</strong> jogos no catálogo{dashboard.archivedCount > 0 ? ` · ${dashboard.archivedCount} arquivados` : ''}</p>
          <div className="stacked-bar" role="img" aria-label="Distribuição dos jogos por estado">{segments.filter((segment) => segment.value > 0).map((segment) => <span key={segment.status} title={`${segment.label}: ${segment.value}`} style={{ flexGrow: segment.value, background: statusColors[segment.status] }} />)}{segmentTotal === 0 && <span className="stacked-empty" />}</div>
          <ul className="legend-list">{segments.filter((segment) => segment.value > 0).map((segment) => <li key={segment.status}>{onFilterLibrary
            ? <button type="button" className="legend-link" aria-label={`${segment.label}: ${segment.value}. Ver na biblioteca`} onClick={() => onFilterLibrary({ status: segment.status })}><span className="legend-swatch" style={{ background: statusColors[segment.status] }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.value}</strong></button>
            : <><span className="legend-swatch" style={{ background: statusColors[segment.status] }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.value}</strong></>}</li>)}{segmentTotal === 0 && <li className="legend-empty">Nenhum jogo na biblioteca ainda.</li>}</ul>
        </Panel>

        <Panel title="Zerados por ano" titleId="year-panel-title">
          {byYear.length ? <ol className="bar-chart" aria-label="Jogos zerados por ano">{byYear.map((entry) => <li key={entry.year} title={`${entry.year}: ${entry.gameCount} jogos zerados`}>{onFilterLibrary
            ? <button type="button" className="bar-link" aria-label={`${entry.year}: ${entry.gameCount} jogos zerados. Ver na biblioteca`} onClick={() => onFilterLibrary({ status: 'COMPLETED', completedYear: String(entry.year) })}><span className="bar-value">{entry.gameCount}</span><span className="bar" style={{ height: `${Math.max(4, (entry.gameCount / maxYear) * 100)}%` }} /><span className="bar-label">{entry.year}</span></button>
            : <><span className="bar-value">{entry.gameCount}</span><span className="bar" style={{ height: `${Math.max(4, (entry.gameCount / maxYear) * 100)}%` }} /><span className="bar-label">{entry.year}</span></>}</li>)}</ol> : <p className="dashboard-empty">Nenhuma conclusão com data registrada.</p>}
          <small>Cada jogo conta uma vez por período, mesmo que tenha sido zerado em mais de uma plataforma.</small>
        </Panel>
      </div>

      <div className="dashboard-bento">
        <BacklogForecast forecast={dashboard.backlogForecast} remainingHours={dashboard.backlogRemainingHours} onSelectGame={onSelectGame} />
        <GoalsCard />
        <ChallengeCard />
      </div>

      <section className="dashboard-bottom">
        <Panel title="Próximos da fila" actions={<button type="button" className="session-edit" onClick={onOpenQueue}>Ver fila completa</button>}>{queue.length ? <ol className="dashboard-queue">{queue.slice(0, 3).map((item) => <li key={item.game.id}><button type="button" onClick={() => onSelectGame(item.game)}>{item.position + 1}. {item.game.title}</button></li>)}</ol> : <p className="dashboard-empty">Sua fila está vazia.</p>}<p>{dashboard.queueRemainingHours} h estimadas na fila{dashboard.estimatedQueueWeeks === null ? '' : ` · cerca de ${dashboard.estimatedQueueWeeks} semanas`}</p></Panel>
        <form className="weekly-goal-form panel" onSubmit={(event) => void saveWeeklyGoal(event)}><h2>Meta semanal</h2><label className="form-field">Minutos disponíveis por semana<input aria-label="Minutos disponíveis por semana" type="number" min="0" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} /></label><Button type="submit">Salvar meta</Button>{feedback && <p role="status">{feedback}</p>}</form>
      </section>

      <AchievistSyncPanel games={games} platforms={platforms} onLinked={() => void onRefresh()} />

      <BackupCard onImported={() => window.location.reload()} />
    </>}
  </section>;
}

function BacklogForecast({ forecast, remainingHours, onSelectGame }: { forecast: DashboardResponse['backlogForecast']; remainingHours: number; onSelectGame: (game: Game) => void }) {
  const months = forecast.estimatedMonths;
  return <Panel title="Previsão do backlog" titleId="forecast-title">
    {months === null
      ? <p className="dashboard-empty">Defina a meta semanal para ver quando o backlog acaba.</p>
      : <p className="panel-figure">No seu ritmo, as {formatCompactHours(remainingHours)} restantes levam cerca de <strong>{months.toLocaleString('pt-BR')} {months === 1 ? 'mês' : 'meses'}</strong> ({forecast.estimatedWeeks?.toLocaleString('pt-BR')} semanas).</p>}
    {forecast.gamesWithoutEstimate > 0 && <small>{forecast.gamesWithoutEstimate} {forecast.gamesWithoutEstimate === 1 ? 'jogo sem estimativa não entra' : 'jogos sem estimativa não entram'} na conta.</small>}
    <h3 className="forecast-subtitle">Parados há mais tempo</h3>
    {forecast.stalledGames.length
      ? <ul className="rank-list">{forecast.stalledGames.map((entry) => <li key={entry.game.id}><button type="button" onClick={() => onSelectGame(entry.game)}>{entry.game.title}</button><span>{entry.daysStalled} dias{entry.remainingHours === null ? '' : ` · faltam ${formatCompactHours(entry.remainingHours)}`}</span></li>)}</ul>
      : <p className="dashboard-empty">Nenhum jogo em andamento ou pausado parado há 30 dias ou mais.</p>}
    <small>Candidatos a pausar de vez ou abandonar: jogos em andamento ou pausados sem sessão recente.</small>
  </Panel>;
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

  return <Panel className="challenge-card" title="Missão principal" titleId="challenge-title" actions={!editing ? <button type="button" className="session-edit" onClick={() => { setTitle(challenge?.title ?? ''); setListId(challenge?.listId ?? lists[0]?.id ?? ''); setEditing(true); }}>{challenge ? 'Editar missão' : 'Definir missão'}</button> : undefined}>
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
  </Panel>;
}
