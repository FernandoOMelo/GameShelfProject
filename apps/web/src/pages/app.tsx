import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DashboardResponse, Franchise, Game, GameInput, Genre, Platform, QueueItem, Session } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';

const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
const statuses: Game['status'][] = ['BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED'];
const priorities: Game['priority'][] = ['LOW', 'NORMAL', 'HIGH'];
const statusLabels: Record<Game['status'], string> = {
  BACKLOG: 'Backlog', QUEUED: 'Na fila', PLAYING: 'Jogando', PAUSED: 'Pausado', COMPLETED: 'Concluído', ABANDONED: 'Abandonado',
};

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Game['status'] | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Game['priority'] | 'ALL'>('ALL');
  const [activeView, setActiveView] = useState<'library' | 'queue' | 'dashboard'>('library');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadGames() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/games`);
      if (!response.ok) throw new Error('A API não conseguiu carregar sua biblioteca.');
      setGames(await response.json() as Game[]);
    } catch {
      setError('Não foi possível conectar à API. Confirme que a aplicação e o banco estão ativos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadGames(); }, []);
  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/queue`).then((response) => response.ok ? response.json() as Promise<QueueItem[]> : Promise.reject()),
      fetch(`${apiUrl}/dashboard`).then((response) => response.ok ? response.json() as Promise<DashboardResponse> : Promise.reject()),
    ]).then(([items, summary]) => { setQueue(items); setDashboard(summary); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    void fetch(`${apiUrl}/franchises`).then(async (response) => {
      if (!response.ok) throw new Error('Falha ao carregar franquias');
      setFranchises(await response.json() as Franchise[]);
    }).catch(() => setFranchises([]));
  }, []);
  useEffect(() => {
    if (!selectedGame) return;
    setSessionFeedback('');
    void fetch(`${apiUrl}/games/${selectedGame.id}/sessions`).then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar as sessões.');
      setSessions(await response.json() as Session[]);
    }).catch(() => {
      setSessions([]);
      setSessionFeedback('Não foi possível carregar o histórico de sessões.');
    });
  }, [selectedGame?.id]);
  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/platforms`).then((response) => response.ok ? response.json() as Promise<Platform[]> : Promise.reject()),
      fetch(`${apiUrl}/genres`).then((response) => response.ok ? response.json() as Promise<Genre[]> : Promise.reject()),
    ]).then(([platformItems, genreItems]) => {
      setPlatforms(platformItems);
      setGenres(genreItems);
    }).catch(() => {
      setPlatforms([]);
      setGenres([]);
    });
  }, []);

  const visibleGames = useMemo(() => games.filter((game) =>
    game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    && (statusFilter === 'ALL' || game.status === statusFilter)
    && (priorityFilter === 'ALL' || game.priority === priorityFilter)), [games, query, statusFilter, priorityFilter]);

  async function refreshPlanningViews() {
    const [queueResponse, dashboardResponse] = await Promise.all([fetch(`${apiUrl}/queue`), fetch(`${apiUrl}/dashboard`)]);
    if (queueResponse.ok) setQueue(await queueResponse.json() as QueueItem[]);
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json() as DashboardResponse);
  }

  async function addToQueue(game: Game) {
    const response = await fetch(`${apiUrl}/queue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameId: game.id }) });
    if (!response.ok) {
      const body = await response.json() as { error?: string };
      setError(body.error ?? 'Não foi possível adicionar o jogo à fila.');
      return;
    }
    setError('');
    await refreshPlanningViews();
  }

  async function removeFromQueue(gameId: string) {
    const response = await fetch(`${apiUrl}/queue/${gameId}`, { method: 'DELETE' });
    if (!response.ok) { setError('Não foi possível remover o jogo da fila.'); return; }
    await refreshPlanningViews();
  }

  async function moveQueueItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    const reordered = [...queue];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const response = await fetch(`${apiUrl}/queue/order`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameIds: reordered.map((item) => item.game.id) }) });
    if (!response.ok) { setError('A fila mudou. Atualize a página e tente novamente.'); return; }
    setQueue(await response.json() as QueueItem[]);
    await refreshPlanningViews();
  }

  async function deleteGame(game: Game) {
    if (!window.confirm(`Excluir ${game.title} e todo o histórico de sessões relacionado? Esta ação não pode ser desfeita.`)) return;
    const response = await fetch(`${apiUrl}/games/${game.id}`, { method: 'DELETE' });
    if (!response.ok) { setError('Não foi possível excluir o jogo.'); return; }
    setSelectedGame(null);
    await loadGames();
    await refreshPlanningViews();
  }

  async function submitGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const platformResult = await resolveCatalogNames(formData.get('platformNames'), platforms, 'platforms');
      const genreResult = await resolveCatalogNames(formData.get('genreNames'), genres, 'genres');
      setPlatforms(platformResult.items);
      setGenres(genreResult.items);
      const franchiseName = nullableString(formData.get('franchiseName'));
      let franchiseId: string | null = editing?.franchiseId ?? null;
      if (!franchiseName) {
        franchiseId = null;
      } else {
        const existing = franchises.find((franchise) => franchise.name.toLocaleLowerCase() === franchiseName.toLocaleLowerCase());
        if (existing) {
          franchiseId = existing.id;
        } else {
          const response = await fetch(`${apiUrl}/franchises`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: franchiseName }),
          });
          if (!response.ok) {
            const body = await response.json() as { error?: string };
            throw new Error(body.error ?? 'Não foi possível criar a franquia.');
          }
          const franchise = await response.json() as Franchise;
          franchiseId = franchise.id;
          setFranchises((items) => [...items, franchise]);
        }
      }
      const input: GameInput = {
      title: String(formData.get('title') ?? '').trim(),
      description: nullableString(formData.get('description')),
      coverUrl: nullableString(formData.get('coverUrl')),
      backgroundUrl: nullableString(formData.get('backgroundUrl')),
      releaseYear: numberOrNull(formData.get('releaseYear')),
      developer: nullableString(formData.get('developer')),
      publisher: nullableString(formData.get('publisher')),
      franchiseId,
      platformIds: platformResult.ids,
      genreIds: genreResult.ids,
      status: String(formData.get('status')) as Game['status'],
      priority: String(formData.get('priority')) as Game['priority'],
      estimatedMainHours: numberOrNull(formData.get('estimatedMainHours')),
      estimatedCompletionistHours: numberOrNull(formData.get('estimatedCompletionistHours')),
      personalEstimatedHours: numberOrNull(formData.get('personalEstimatedHours')),
      notes: nullableString(formData.get('notes')),
      };
      const response = await fetch(`${apiUrl}/games${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Não foi possível salvar o jogo.');
      }
      if (editing) setSelectedGame(await response.json() as Game);
      setDialogOpen(false);
      setEditing(null);
      await loadGames();
      await refreshPlanningViews();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o jogo.');
    } finally {
      setSaving(false);
    }
  }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGame) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startedAt = String(form.get('startedAt') ?? '');
    const endedAt = String(form.get('endedAt') ?? '');
    setSavingSession(true);
    setSessionFeedback('');
    try {
      const response = await fetch(`${apiUrl}/games/${selectedGame.id}/sessions${editingSession ? `/${editingSession.id}` : ''}`, {
        method: editingSession ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          startedAt: new Date(startedAt).toISOString(),
          endedAt: endedAt ? new Date(endedAt).toISOString() : null,
          progress: numberOrNull(form.get('progress')),
          location: nullableString(form.get('location')),
          notes: nullableString(form.get('notes')),
        }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Não foi possível salvar a sessão.');
      }
      const created = await response.json() as Session;
      setSessions((items) => editingSession
        ? items.map((session) => session.id === editingSession.id ? created : session)
        : [created, ...items]);
      setEditingSession(null);
      formElement.reset();
      await refreshPlanningViews();
      setSessionFeedback(editingSession ? 'Sessão atualizada.' : 'Sessão registrada.');
    } catch (cause) {
      setSessionFeedback(cause instanceof Error ? cause.message : 'Não foi possível salvar a sessão.');
    } finally {
      setSavingSession(false);
    }
  }

  async function deleteSession(session: Session) {
    if (!selectedGame || !window.confirm('Excluir esta sessão? Esta ação não pode ser desfeita.')) return;
    setSessionFeedback('');
    try {
      const response = await fetch(`${apiUrl}/games/${selectedGame.id}/sessions/${session.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Não foi possível excluir a sessão.');
      }
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (editingSession?.id === session.id) setEditingSession(null);
      await refreshPlanningViews();
      setSessionFeedback('Sessão excluída.');
    } catch (cause) {
      setSessionFeedback(cause instanceof Error ? cause.message : 'Não foi possível excluir a sessão.');
    }
  }

  function openEditor(game: Game | null = null) {
    setEditing(game);
    setDialogOpen(true);
  }

  function showDetails(game: Game) {
    setSelectedGame(game);
  }

  return (
    <main className="library-shell">
      <header className="library-header">
        <a className="brand" href="/" aria-label="GameShelf início"><span className="brand-mark">G</span><span>Game<span className="brand-accent">Shelf</span></span></a>
        <nav className="main-nav" aria-label="Navegação principal"><button type="button" aria-current={activeView === 'library' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('library'); }}>Biblioteca</button><button type="button" aria-current={activeView === 'queue' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('queue'); }}>Fila <span>{queue.length}</span></button><button type="button" aria-current={activeView === 'dashboard' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('dashboard'); }}>Painel</button></nav>
        <span className="local-badge"><span /> LOCAL</span>
      </header>
      {selectedGame ? <section className="details-page" aria-labelledby="details-title">
        <button className="back-link" type="button" onClick={() => setSelectedGame(null)}>← Voltar à biblioteca</button>
        <div className="details-layout">
          <div className="details-cover">{selectedGame.coverUrl ? <img src={selectedGame.coverUrl} alt={`Capa de ${selectedGame.title}`} /> : <span aria-hidden="true">▧</span>}</div>
          <div className="details-content">
            <p className="eyebrow">DETALHES DO JOGO</p>
            <h1 id="details-title">{selectedGame.title}</h1>
            <p className="details-byline">{[selectedGame.releaseYear, selectedGame.developer, selectedGame.publisher, franchises.find((franchise) => franchise.id === selectedGame.franchiseId)?.name].filter(Boolean).join(' · ') || 'Metadata ainda não informada'}</p>
            <div className="details-badges"><span className={`status-pill status-${selectedGame.status.toLowerCase()}`}>{statusLabels[selectedGame.status]}</span><span className="priority-badge">Prioridade {selectedGame.priority === 'HIGH' ? 'alta' : selectedGame.priority === 'LOW' ? 'baixa' : 'normal'}</span></div>
            {selectedGame.description && <section className="details-section"><h2>Descrição</h2><p>{selectedGame.description}</p></section>}
            <section className="details-section"><h2>Plataformas e gêneros</h2><p>{[
              selectedGame.platformIds.map((id) => platforms.find((platform) => platform.id === id)?.name).filter(Boolean).join(', '),
              selectedGame.genreIds.map((id) => genres.find((genre) => genre.id === id)?.name).filter(Boolean).join(', '),
            ].filter(Boolean).join(' · ') || 'Não informados'}</p></section>
            <section className="details-section"><h2>Estimativas de duração</h2><dl className="estimate-list">
              <div><dt>História principal</dt><dd>{formatHours(selectedGame.estimatedMainHours)}</dd></div>
              <div><dt>Completista</dt><dd>{formatHours(selectedGame.estimatedCompletionistHours)}</dd></div>
              <div><dt>Pessoal</dt><dd>{formatHours(selectedGame.personalEstimatedHours)}</dd></div>
            </dl></section>
            <section className="details-section session-section"><h2>Sessões</h2>
              <form key={editingSession?.id ?? 'new-session'} className="session-form" onSubmit={submitSession}>
                <label className="form-field">Início<input name="startedAt" type="datetime-local" required defaultValue={toDateTimeLocal(editingSession ? new Date(editingSession.startedAt) : new Date(Date.now() - 60 * 60_000))} /></label>
                <label className="form-field">Término<input name="endedAt" type="datetime-local" defaultValue={editingSession?.endedAt ? toDateTimeLocal(new Date(editingSession.endedAt)) : editingSession ? '' : toDateTimeLocal(new Date())} /><small>Deixe vazio para manter a sessão em andamento.</small></label>
                <label className="form-field">Progresso (%)<input name="progress" type="number" min="0" max="100" step="1" defaultValue={editingSession?.progress ?? ''} /></label>
                <label className="form-field">Onde parou<input name="location" maxLength={200} defaultValue={editingSession?.location ?? ''} /></label>
                <label className="form-field form-wide">Notas<textarea name="notes" rows={2} maxLength={10000} defaultValue={editingSession?.notes ?? ''} /></label>
                <div className="form-wide session-actions"><Button type="submit" disabled={savingSession}>{savingSession ? 'Salvando…' : editingSession ? 'Salvar sessão' : 'Registrar sessão'}</Button>{editingSession && <button type="button" className="cancel-button" onClick={() => setEditingSession(null)}>Cancelar edição</button>}</div>
              </form>
              {sessionFeedback && <p role="status" className="session-feedback">{sessionFeedback}</p>}
              {sessions.length === 0 ? <p className="session-empty">Nenhuma sessão registrada.</p> : <ol className="session-list">{sessions.map((session) => <li key={session.id}>
                <div><strong>{formatDateTime(session.startedAt)}</strong><span>{formatDuration(session.durationMinutes)}</span></div>
                <p>{[session.location, session.progress === null ? null : `${session.progress}%`].filter(Boolean).join(' · ') || 'Sem progresso informado'}</p>
                {session.notes && <p>{session.notes}</p>}
                <div className="session-item-actions"><button type="button" className="session-edit" onClick={() => setEditingSession(session)}>Editar sessão</button><button type="button" className="session-delete" onClick={() => void deleteSession(session)}>Excluir sessão</button></div>
              </li>)}</ol>}
            </section>
            {selectedGame.notes && <section className="details-section"><h2>Notas pessoais</h2><p>{selectedGame.notes}</p></section>}
            <div className="game-detail-actions"><Button type="button" onClick={() => openEditor(selectedGame)}>Editar jogo</Button><button type="button" className="session-delete" onClick={() => void deleteGame(selectedGame)}>Excluir jogo</button></div>
          </div>
        </div>
      </section> : activeView === 'dashboard' ? <DashboardView dashboard={dashboard} queue={queue} onRefresh={refreshPlanningViews} onSelectGame={showDetails} onOpenQueue={() => setActiveView('queue')} /> : activeView === 'queue' ? <QueueView queue={queue} onMove={moveQueueItem} onRemove={removeFromQueue} onSelectGame={showDetails} /> : <>
      <section className="library-heading">
        <div><p className="eyebrow">SUA COLEÇÃO</p><h1>Biblioteca</h1><p className="library-subtitle">Seus jogos, reunidos em um só lugar.</p></div>
        <Button type="button" onClick={() => openEditor()}>＋ Adicionar jogo</Button>
      </section>
      <section className="library-tools" aria-label="Ferramentas da biblioteca">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar jogos" placeholder="Buscar na biblioteca" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="filter-field">Status<select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Game['status'] | 'ALL')}><option value="ALL">Todos</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label className="filter-field">Prioridade<select aria-label="Filtrar por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Game['priority'] | 'ALL')}><option value="ALL">Todas</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority === 'LOW' ? 'Baixa' : priority === 'HIGH' ? 'Alta' : 'Normal'}</option>)}</select></label>
        <span className="game-count">{games.length} {games.length === 1 ? 'jogo' : 'jogos'}</span>
      </section>
      {error && <div className="notice" role="alert">{error}<button type="button" onClick={() => void loadGames()}>Tentar novamente</button></div>}
      {loading ? <p className="empty-state">Carregando biblioteca…</p> : visibleGames.length === 0 ? (
        <section className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h2>{query ? 'Nenhum jogo encontrado' : 'Sua biblioteca começa aqui'}</h2><p>{query ? 'Tente buscar por outro título.' : 'Adicione seu primeiro jogo para começar a organizar sua coleção.'}</p>{!query && <Button type="button" onClick={() => openEditor()}>Adicionar primeiro jogo</Button>}</section>
      ) : (
        <section className="game-grid" aria-label="Jogos da biblioteca">{visibleGames.map((game) => <div className="game-card-wrap" key={game.id}><button className="game-card" type="button" onClick={() => showDetails(game)} aria-label={`Ver detalhes de ${game.title}`}>
          <span className="game-cover">{game.coverUrl ? <img src={game.coverUrl} alt="" /> : <span aria-hidden="true">▧</span>}<span className={`status-pill status-${game.status.toLowerCase()}`}>{statusLabels[game.status]}</span></span>
          <span className="game-card-title">{game.title}</span><span className="game-card-meta">{[game.releaseYear, game.developer].filter(Boolean).join(' · ') || 'Detalhes não informados'}</span>
        </button><button type="button" className="queue-toggle" disabled={game.status === 'COMPLETED' || game.status === 'ABANDONED'} onClick={() => void (queue.some((item) => item.game.id === game.id) ? removeFromQueue(game.id) : addToQueue(game))}>{queue.some((item) => item.game.id === game.id) ? 'Na fila · Remover' : '＋ Adicionar à fila'}</button></div>)}</section>
      )}
      </>}
      {dialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}><section className="game-dialog" role="dialog" aria-modal="true" aria-labelledby="game-dialog-title"><header><div><p className="eyebrow">BIBLIOTECA</p><h2 id="game-dialog-title">{editing ? 'Editar jogo' : 'Adicionar jogo'}</h2></div><button className="dialog-close" type="button" aria-label="Fechar" onClick={() => setDialogOpen(false)}>×</button></header>
        <form onSubmit={submitGame}><label className="form-field form-wide">Título<input name="title" required maxLength={200} defaultValue={editing?.title ?? ''} autoFocus /></label>
          <label className="form-field">Desenvolvedora<input name="developer" maxLength={200} defaultValue={editing?.developer ?? ''} /></label><label className="form-field">Publicadora<input name="publisher" maxLength={200} defaultValue={editing?.publisher ?? ''} /></label>
          <label className="form-field">Ano<input name="releaseYear" type="number" min="1" max="9999" defaultValue={editing?.releaseYear ?? ''} /></label><label className="form-field">Capa (URL)<input name="coverUrl" type="url" defaultValue={editing?.coverUrl ?? ''} /></label><label className="form-field form-wide">Imagem de fundo (URL)<input name="backgroundUrl" type="url" defaultValue={editing?.backgroundUrl ?? ''} /></label>
          <label className="form-field form-wide">Franquia<input name="franchiseName" maxLength={200} defaultValue={franchises.find((franchise) => franchise.id === editing?.franchiseId)?.name ?? ''} placeholder="Ex.: The Legend of Zelda" /></label>
          <label className="form-field form-wide">Plataformas<input name="platformNames" defaultValue={editing?.platformIds.map((id) => platforms.find((platform) => platform.id === id)?.name).filter(Boolean).join(', ') ?? ''} placeholder="Ex.: PC, PlayStation 5" /><small>Separe vários nomes por vírgula.</small></label>
          <label className="form-field form-wide">Gêneros<input name="genreNames" defaultValue={editing?.genreIds.map((id) => genres.find((genre) => genre.id === id)?.name).filter(Boolean).join(', ') ?? ''} placeholder="Ex.: RPG, Ação" /><small>Separe vários nomes por vírgula.</small></label>
          <label className="form-field">Status<select name="status" defaultValue={editing?.status ?? 'BACKLOG'}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label><label className="form-field">Prioridade<select name="priority" defaultValue={editing?.priority ?? 'NORMAL'}>{priorities.map((priority) => <option value={priority} key={priority}>{priority === 'LOW' ? 'Baixa' : priority === 'HIGH' ? 'Alta' : 'Normal'}</option>)}</select></label>
          <label className="form-field">Estimativa principal (h)<input name="estimatedMainHours" type="number" min="0" step="0.25" defaultValue={editing?.estimatedMainHours ?? ''} /></label><label className="form-field">Estimativa completista (h)<input name="estimatedCompletionistHours" type="number" min="0" step="0.25" defaultValue={editing?.estimatedCompletionistHours ?? ''} /></label>
          <label className="form-field">Estimativa pessoal (h)<input name="personalEstimatedHours" type="number" min="0" step="0.25" defaultValue={editing?.personalEstimatedHours ?? ''} /></label><label className="form-field form-wide">Descrição<textarea name="description" rows={2} maxLength={10000} defaultValue={editing?.description ?? ''} /></label>
          <label className="form-field form-wide">Notas<textarea name="notes" rows={2} maxLength={10000} defaultValue={editing?.notes ?? ''} /></label>
          <footer className="dialog-actions"><button className="cancel-button" type="button" onClick={() => setDialogOpen(false)}>Cancelar</button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar jogo'}</Button></footer>
        </form></section></div>}
    </main>
  );
}

function DashboardView({ dashboard, queue, onRefresh, onSelectGame, onOpenQueue }: {
  dashboard: DashboardResponse | null;
  queue: QueueItem[];
  onRefresh: () => Promise<void>;
  onSelectGame: (game: Game) => void;
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

  return <section className="dashboard-page" aria-labelledby="dashboard-title">
    <p className="eyebrow">VISÃO GERAL</p><h1 id="dashboard-title">Seu ritmo de jogo</h1>
    {dashboard ? <>
      <div className="dashboard-stats">
        <StatCard label="Jogos na biblioteca" value={String(dashboard.gameCount)} />
        <StatCard label="Em andamento" value={String(dashboard.playingCount)} />
        <StatCard label="Concluídos" value={String(dashboard.completedCount)} />
        <StatCard label="Abandonados" value={String(dashboard.abandonedCount)} />
        <StatCard label="Tempo jogado" value={formatHours(dashboard.totalPlayedHours)} />
        <StatCard label="Horas restantes no backlog" value={formatHours(dashboard.backlogRemainingHours)} />
        <StatCard label="Horas disponíveis por semana" value={formatHours(dashboard.weeklyHours)} />
      </div>
      {dashboard.currentGame ? <section className="current-game-panel">{dashboard.currentGame.game.coverUrl && <img className="current-game-cover" src={dashboard.currentGame.game.coverUrl} alt={`Capa de ${dashboard.currentGame.game.title}`} />}<div><p className="eyebrow">CONTINUAR JOGANDO</p><h2>{dashboard.currentGame.game.title}</h2><p>{dashboard.currentGame.playedHours} h jogadas{dashboard.currentGame.progress === null ? '' : ` · ${dashboard.currentGame.progress}%`}</p>{dashboard.currentGame.lastSession && <p>Última sessão: {formatDateTime(dashboard.currentGame.lastSession.startedAt)}</p>}{dashboard.currentGame.lastSession?.location && <p>Parou em: {dashboard.currentGame.lastSession.location}</p>}{dashboard.currentGame.remainingHours !== null && <p>{dashboard.currentGame.remainingHours} h estimadas restantes</p>}</div><Button type="button" onClick={() => onSelectGame(dashboard.currentGame!.game)}>Registrar sessão</Button></section> : <p className="dashboard-empty">Nenhum jogo marcado como em andamento.</p>}
      <section className="dashboard-bottom"><div><div className="section-heading"><h2>Próximos da fila</h2><button type="button" className="session-edit" onClick={onOpenQueue}>Ver fila completa</button></div>{queue.length ? <ol className="dashboard-queue">{queue.slice(0, 3).map((item) => <li key={item.game.id}><button type="button" onClick={() => onSelectGame(item.game)}>{item.position + 1}. {item.game.title}</button></li>)}</ol> : <p className="dashboard-empty">Sua fila está vazia.</p>}<p>{dashboard.queueRemainingHours} h estimadas na fila{dashboard.estimatedQueueWeeks === null ? '' : ` · cerca de ${dashboard.estimatedQueueWeeks} semanas`}</p></div>
      <form className="weekly-goal-form" onSubmit={(event) => void saveWeeklyGoal(event)}><h2>Meta semanal</h2><label className="form-field">Minutos disponíveis por semana<input aria-label="Minutos disponíveis por semana" type="number" min="0" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} /></label><Button type="submit">Salvar meta</Button>{feedback && <p role="status">{feedback}</p>}</form></section>
    </> : <p role="status">Carregando painel…</p>}
  </section>;
}

function QueueView({ queue, onMove, onRemove, onSelectGame }: {
  queue: QueueItem[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (gameId: string) => void;
  onSelectGame: (game: Game) => void;
}) {
  return <section className="queue-page" aria-labelledby="queue-title"><p className="eyebrow">SEU PRÓXIMO PASSO</p><h1 id="queue-title">Fila de jogos</h1><p className="library-subtitle">Organize o que pretende jogar. A posição da fila é independente da prioridade.</p>
    {queue.length ? <ol className="queue-list">{queue.map((item, index) => <li key={item.game.id}><span className="queue-position">{index + 1}</span><button type="button" className="queue-game-link" onClick={() => onSelectGame(item.game)}><strong>{item.game.title}</strong><span>{item.game.personalEstimatedHours ?? item.game.estimatedMainHours ?? 'Sem estimativa'}{item.game.personalEstimatedHours !== null || item.game.estimatedMainHours !== null ? ' h estimadas' : ''}</span></button><div className="queue-actions"><button type="button" aria-label={`Mover ${item.game.title} para cima`} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button><button type="button" aria-label={`Mover ${item.game.title} para baixo`} disabled={index === queue.length - 1} onClick={() => onMove(index, 1)}>↓</button><button type="button" className="session-delete" onClick={() => onRemove(item.game.id)}>Remover</button></div></li>)}</ol> : <p className="dashboard-empty">Fila vazia. Adicione jogos pela biblioteca.</p>}
  </section>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong></article>;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  const result = String(value ?? '').trim();
  return result || null;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const result = String(value ?? '').trim();
  return result ? Number(result) : null;
}

function formatHours(value: number | null): string {
  return value === null ? 'Não informada' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} h`;
}

function toDateTimeLocal(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Em andamento';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

async function resolveCatalogNames<T extends { id: string; name: string }>(
  value: FormDataEntryValue | null,
  catalog: T[],
  endpoint: 'platforms' | 'genres',
): Promise<{ ids: string[]; items: T[] }> {
  const items = [...catalog];
  const ids: string[] = [];
  const names = String(value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  for (const name of names) {
    let item = items.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!item) {
      const response = await fetch(`${apiUrl}/${endpoint}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
      });
      if (response.status === 409) {
        const refreshed = await fetch(`${apiUrl}/${endpoint}`);
        if (!refreshed.ok) throw new Error(`Não foi possível carregar ${endpoint}.`);
        const latest = await refreshed.json() as T[];
        items.splice(0, items.length, ...latest);
        item = items.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      } else if (response.ok) {
        item = await response.json() as T;
        items.push(item);
      } else {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? `Não foi possível criar ${endpoint}.`);
      }
    }
    if (item && !ids.includes(item.id)) ids.push(item.id);
  }
  return { ids, items };
}
