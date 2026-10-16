import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { DashboardResponse, Franchise, Game, GameInput, GameList, GameListSummary, GameMetadataCandidate, GameTimeEstimate, Genre, LibraryFilterState, LibrarySort, Platform, QueueItem, SavedFilter, Session } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';

import { apiUrl, difficultyLabels, formatDateTime, formatElapsed, formatHours, formatDuration } from './shared';
import { DashboardView, type LibraryFilter } from './dashboard-view';
import { StatsView } from './stats-view';
import { enqueueFailureMessage, OfflineBanner, useOfflineSessions } from './offline-banner';
import { isNetworkFailure } from './offline-sessions';
import { SessionScreenshots } from './session-screenshots';
import { NextGameSuggestion } from './next-game-suggestion';
import { TimelineView } from './timeline-view';
const statuses: Game['status'][] = ['DESIRED', 'BACKLOG', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED'];
const priorities: Game['priority'][] = ['LOW', 'NORMAL', 'HIGH'];
const sortLabels: Record<LibrarySort, string> = { TITLE: 'Título', STARTED_DESC: 'Início mais recente', COMPLETED_DESC: 'Conclusão mais recente' };
function compareDateDesc(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}
function sortGames(games: Game[], sortBy: LibrarySort): Game[] {
  if (sortBy === 'TITLE') return games;
  const field = sortBy === 'STARTED_DESC' ? 'startedAt' : 'completedAt';
  return [...games].sort((a, b) => compareDateDesc(a[field], b[field]) || a.title.localeCompare(b.title));
}
type JournalField = { key: 'location' | 'notes' | 'keyDecisions' | 'tips'; label: string };
const journalFields: JournalField[] = [
  { key: 'location', label: 'Onde parei' },
  { key: 'notes', label: 'Resumo da história' },
  { key: 'keyDecisions', label: 'Decisões importantes' },
  { key: 'tips', label: 'Dicas e lembretes' },
];
const recapFields = journalFields.filter((field) => field.key !== 'location');
function journalEntries(session: Session, fields: JournalField[]) {
  return fields.flatMap(({ key, label }) => session[key] ? [{ label, value: session[key]! }] : []);
}
function latestJournal(sessions: Session[]) {
  return journalFields.flatMap(({ key, label }) => {
    const source = sessions.find((session) => session[key]);
    return source ? [{ label, value: source[key]!, at: source.startedAt }] : [];
  });
}
type DashboardPeriod = '7d' | 'month' | 'year' | 'custom' | 'all';
const todayLocal = () => todayLocalDate(new Date());
function todayLocalDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function periodBounds(period: DashboardPeriod, customFrom: string, customTo: string): { from?: string; to?: string } {
  const today = new Date();
  if (period === 'all') return {};
  if (period === 'custom') return { from: customFrom, to: customTo };
  if (period === '7d') { const from = new Date(today); from.setDate(from.getDate() - 6); return { from: todayLocalDate(from), to: todayLocal() }; }
  if (period === 'year') return { from: `${today.getFullYear()}-01-01`, to: todayLocal() };
  return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: todayLocal() };
}
function initialDashboardPeriod(): DashboardPeriod {
  try {
    const value = window.localStorage.getItem('gameshelf-dashboard-period');
    return value === '7d' || value === 'year' || value === 'custom' || value === 'all' ? value : 'month';
  } catch { return 'month'; }
}
function initialCustomPeriod() {
  try {
    const saved = window.localStorage.getItem('gameshelf-dashboard-custom-period');
    if (saved) {
      const value = JSON.parse(saved) as { from?: string; to?: string };
      if (value.from && value.to) return { from: value.from, to: value.to };
    }
  } catch { /* Keep the current month when storage is unavailable or invalid. */ }
  return { from: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`, to: todayLocal() };
}
const statusLabels: Record<Game['status'], string> = {
  DESIRED: 'Desejado', BACKLOG: 'Na biblioteca', PLAYING: 'Jogando', PAUSED: 'Pausado', COMPLETED: 'Zerado', ABANDONED: 'Abandonado',
};

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Game['status'] | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Game['priority'] | 'ALL'>('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [franchiseFilter, setFranchiseFilter] = useState('ALL');
  const [developerFilter, setDeveloperFilter] = useState('ALL');
  const [listFilter, setListFilter] = useState('ALL');
  const [completedYearFilter, setCompletedYearFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<LibrarySort>('TITLE');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [activeSavedFilter, setActiveSavedFilter] = useState('ALL');
  const [newFilterName, setNewFilterName] = useState('');
  const [namingFilter, setNamingFilter] = useState(false);
  const [filterFeedback, setFilterFeedback] = useState('');
  const [lists, setLists] = useState<GameListSummary[]>([]);
  const [listGameIds, setListGameIds] = useState<Set<string> | null>(null);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [listFeedback, setListFeedback] = useState('');
  const [retroactiveHours, setRetroactiveHours] = useState('');
  const [activeView, setActiveView] = useState<'library' | 'queue' | 'lists' | 'dashboard' | 'stats' | 'timeline'>('dashboard');
  const [showArchived, setShowArchived] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>(initialDashboardPeriod);
  const [customPeriod, setCustomPeriod] = useState(initialCustomPeriod);
  const dashboardUrl = useMemo(() => {
    const bounds = periodBounds(dashboardPeriod, customPeriod.from, customPeriod.to);
    const params = new URLSearchParams();
    if (bounds.from && bounds.to) { params.set('from', bounds.from); params.set('to', bounds.to); params.set('timezoneOffsetMinutes', String(new Date().getTimezoneOffset())); }
    return `${apiUrl}/dashboard${params.size ? `?${params}` : ''}`;
  }, [dashboardPeriod, customPeriod]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [formStatus, setFormStatus] = useState<Game['status']>('BACKLOG');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const offline = useOfflineSessions(() => { void refreshPlanningViews().catch(() => undefined); });
  const [saving, setSaving] = useState(false);
  const [metadataCandidates, setMetadataCandidates] = useState<GameMetadataCandidate[]>([]);
  const [metadataError, setMetadataError] = useState('');
  const [searchingMetadata, setSearchingMetadata] = useState(false);
  const [timeEstimateCandidates, setTimeEstimateCandidates] = useState<GameTimeEstimate[]>([]);
  const [timeEstimateError, setTimeEstimateError] = useState('');
  const [searchingTimeEstimates, setSearchingTimeEstimates] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const gameFormRef = useRef<HTMLFormElement>(null);
  const metadataTokenRef = useRef(0);
  const timesTokenRef = useRef(0);
  const searchedTitleRef = useRef('');

  /** Busca metadata (IGDB) e tempos (HowLongToBeat) conforme o título é digitado. */
  useEffect(() => {
    if (!dialogOpen) return;
    const query = formTitle.trim();
    if (query.length < 3) { searchedTitleRef.current = ''; return; }
    if (query === searchedTitleRef.current) return;
    const timer = setTimeout(() => void searchWhileTyping(query), 450);
    return () => clearTimeout(timer);
  }, [formTitle, dialogOpen]);

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

  async function loadLists() {
    try {
      const response = await fetch(`${apiUrl}/lists`);
      if (!response.ok) throw new Error('Falha ao carregar listas');
      setLists(await response.json() as GameListSummary[]);
    } catch {
      setLists([]);
    }
  }

  useEffect(() => { void loadGames(); }, []);
  useEffect(() => { void loadLists(); }, []);
  useEffect(() => { void loadSavedFilters(); }, []);
  useEffect(() => {
    if (listFilter === 'ALL') { setListGameIds(null); return; }
    void fetch(`${apiUrl}/lists/${listFilter}`).then(async (response) => {
      if (!response.ok) throw new Error('Falha ao carregar a lista');
      const list = await response.json() as GameList;
      setListGameIds(new Set(list.games.map((game) => game.id)));
    }).catch(() => setListGameIds(new Set()));
  }, [listFilter]);
  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/queue`).then((response) => response.ok ? response.json() as Promise<QueueItem[]> : Promise.reject()),
      fetch(dashboardUrl).then((response) => response.ok ? response.json() as Promise<DashboardResponse> : Promise.reject()),
    ]).then(([items, summary]) => { setQueue(items); setDashboard(summary); }).catch(() => undefined);
  }, [dashboardUrl]);
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
  }, [selectedGame?.id, offline.syncs]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
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

  const filteredGames = useMemo(() => games.filter((game) => (showArchived ? Boolean(game.archived) : !game.archived)
    && game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    && (statusFilter === 'ALL' || game.status === statusFilter)
    && (priorityFilter === 'ALL' || game.priority === priorityFilter)
    && (platformFilter === 'ALL' || game.platformId === platformFilter)
    && (genreFilter === 'ALL' || game.genreIds.includes(genreFilter))
    && (franchiseFilter === 'ALL' || game.franchiseId === franchiseFilter)
    && (developerFilter === 'ALL' || game.developer === developerFilter)
    && (listGameIds === null || listGameIds.has(game.id))
    && (completedYearFilter === 'ALL' || (game.completedAt ?? '').startsWith(completedYearFilter))), [games, query, statusFilter, priorityFilter, platformFilter, genreFilter, franchiseFilter, developerFilter, showArchived, listGameIds, completedYearFilter]);
  const visibleGames = useMemo(() => sortGames(filteredGames, sortBy), [filteredGames, sortBy]);
  const journal = useMemo(() => latestJournal(sessions), [sessions]);
  const completedYears = useMemo(() => [...new Set(games.map((game) => game.completedAt?.slice(0, 4)).filter((year): year is string => Boolean(year)))].sort((a, b) => b.localeCompare(a)), [games]);

  useEffect(() => {
    if (!selectedGame) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigateDetails(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigateDetails(1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedGame, visibleGames]);

  async function loadSavedFilters() {
    try {
      const response = await fetch(`${apiUrl}/saved-filters`);
      if (!response.ok) throw new Error('Falha ao carregar filtros salvos');
      setSavedFilters(await response.json() as SavedFilter[]);
    } catch {
      setSavedFilters([]);
    }
  }

  function currentFilterState(): LibraryFilterState {
    return {
      query, status: statusFilter, priority: priorityFilter, platformId: platformFilter,
      genreId: genreFilter, franchiseId: franchiseFilter, developer: developerFilter,
      listId: listFilter, completedYear: completedYearFilter, archived: showArchived, sortBy,
    };
  }

  function applySavedFilter(id: string) {
    setActiveSavedFilter(id);
    setFilterFeedback('');
    if (id === 'ALL') return;
    const saved = savedFilters.find((item) => item.id === id);
    if (!saved) return;
    const state = saved.filters;
    setQuery(state.query);
    setStatusFilter(state.status);
    setPriorityFilter(state.priority);
    setPlatformFilter(state.platformId);
    setGenreFilter(state.genreId);
    setFranchiseFilter(state.franchiseId);
    setDeveloperFilter(state.developer);
    setListFilter(state.listId);
    setCompletedYearFilter(state.completedYear);
    setShowArchived(state.archived);
    setSortBy(state.sortBy);
  }

  async function saveCurrentFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFilterName.trim();
    if (!name) return;
    const response = await fetch(`${apiUrl}/saved-filters`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, filters: currentFilterState() }),
    });
    if (!response.ok) {
      setFilterFeedback(response.status === 409 ? 'Já existe um filtro com esse nome.' : 'Não foi possível salvar o filtro.');
      return;
    }
    const saved = await response.json() as SavedFilter;
    setNewFilterName('');
    setNamingFilter(false);
    setFilterFeedback(`Filtro "${saved.name}" salvo.`);
    setActiveSavedFilter(saved.id);
    await loadSavedFilters();
  }

  async function deleteSavedFilter(id: string) {
    const response = await fetch(`${apiUrl}/saved-filters/${id}`, { method: 'DELETE' });
    if (!response.ok) { setFilterFeedback('Não foi possível excluir o filtro.'); return; }
    setActiveSavedFilter('ALL');
    setFilterFeedback('Filtro excluído.');
    await loadSavedFilters();
  }

  async function createListFromFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    const gameIds = visibleGames.map((game) => game.id);
    const response = await fetch(`${apiUrl}/lists`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, gameIds }),
    });
    if (!response.ok) {
      setListFeedback(response.status === 409 ? 'Já existe uma lista com esse nome.' : 'Não foi possível criar a lista.');
      return;
    }
    setListFeedback(`Lista "${name}" criada com ${gameIds.length} ${gameIds.length === 1 ? 'jogo' : 'jogos'}.`);
    setNewListName('');
    setCreatingList(false);
    await loadLists();
  }

  function applyLibraryFilter(filter: LibraryFilter) {
    setQuery('');
    setStatusFilter(filter.status ?? 'ALL');
    setCompletedYearFilter(filter.completedYear ?? 'ALL');
    setPriorityFilter('ALL');
    setPlatformFilter('ALL');
    setGenreFilter('ALL');
    setFranchiseFilter('ALL');
    setDeveloperFilter('ALL');
    setListFilter('ALL');
    setShowArchived(false);
    setSelectedGame(null);
    setActiveView('library');
  }

  async function refreshPlanningViews() {
    const [queueResponse, dashboardResponse] = await Promise.all([fetch(`${apiUrl}/queue`), fetch(dashboardUrl)]);
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
      if (platformResult.ids.length > 1) throw new Error('Selecione apenas uma plataforma para o jogo.');
      const platformId = platformResult.ids[0] ?? nullableString(formData.get('platformId'));
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
      platformId,
      status: String(formData.get('status')) as Game['status'],
      archived: editing?.archived ?? false,
      owned: formData.get('owned') === 'on',
      startedAt: nullableString(formData.get('startedAt')),
      completedAt: nullableString(formData.get('completedAt')),
      genreIds: genreResult.ids,
      rating: formStatus === 'COMPLETED' || formStatus === 'ABANDONED' ? numberOrNull(formData.get('rating')) : editing?.rating ?? null,
      priority: String(formData.get('priority')) as Game['priority'],
      difficulty: nullableString(formData.get('difficulty')) as Game['difficulty'],
      gameType: nullableString(formData.get('gameType')),
      completionCondition: nullableString(formData.get('completionCondition')),
      favorite: formData.get('favorite') === 'on',
      gameOfYear: formData.get('gameOfYear') === 'on',
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
      closeEditor();
      await loadGames();
      await refreshPlanningViews();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o jogo.');
    } finally {
      setSaving(false);
    }
  }

  function errorMessage(cause: unknown, fallback: string) {
    return cause instanceof Error && cause.message ? cause.message : fallback;
  }

  function setGameFormField(name: string, value: string | number | null | undefined) {
    if (value === undefined) return;
    if (name === 'title') { setFormTitle(value == null ? '' : String(value)); return; }
    const control = gameFormRef.current?.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.value = value == null ? '' : String(value);
  }

  async function requestMetadata(query: string) {
    const response = await fetch(`${apiUrl}/metadata/games?query=${encodeURIComponent(query)}`);
    const body = await response.json() as GameMetadataCandidate[] | { error?: string };
    if (!response.ok) throw new Error('error' in body ? body.error : undefined);
    return body as GameMetadataCandidate[];
  }

  async function requestTimeEstimates(query: string) {
    const response = await fetch(`${apiUrl}/metadata/time-estimates?query=${encodeURIComponent(query)}`);
    const body = await response.json() as GameTimeEstimate[] | { error?: string };
    if (!response.ok) throw new Error('error' in body ? body.error : undefined);
    return body as GameTimeEstimate[];
  }

  /** Busca sob demanda (botões). A busca automática usa `searchWhileTyping`. */
  async function searchMetadata() {
    const query = formTitle.trim();
    if (!query) { setMetadataError('Digite um título para pesquisar.'); return; }
    await runSearch('metadata', query);
  }

  async function searchTimeEstimates() {
    const query = formTitle.trim();
    if (!query) { setTimeEstimateError('Digite um título para pesquisar.'); return; }
    await runSearch('times', query);
  }

  /**
   * `live` é a busca automática (digitação e abertura do jogo): não limpa a lista
   * nem exibe mensagens, para não piscar a tela a cada tecla. Um token por fonte
   * descarta respostas fora de ordem sem cancelar a outra busca em andamento.
   */
  async function runSearch(source: 'metadata' | 'times', query: string, { live = false }: { live?: boolean } = {}) {
    if (!live) searchedTitleRef.current = query;
    if (source === 'metadata') {
      const token = ++metadataTokenRef.current;
      setSearchingMetadata(true);
      setMetadataError('');
      if (!live) setMetadataCandidates([]);
      try {
        const candidates = await requestMetadata(query);
        if (token !== metadataTokenRef.current) return;
        setMetadataCandidates(candidates);
        if (!live && candidates.length === 0) setMetadataError('Nenhum resultado encontrado.');
      } catch (cause) {
        if (token !== metadataTokenRef.current || live) return;
        setMetadataError(errorMessage(cause, 'Não foi possível buscar metadata externa.'));
      } finally {
        if (token === metadataTokenRef.current) setSearchingMetadata(false);
      }
      return;
    }

    const token = ++timesTokenRef.current;
    setSearchingTimeEstimates(true);
    setTimeEstimateError('');
    if (!live) setTimeEstimateCandidates([]);
    try {
      const candidates = await requestTimeEstimates(query);
      if (token !== timesTokenRef.current) return;
      setTimeEstimateCandidates(candidates);
      if (!live && candidates.length === 0) setTimeEstimateError('Nenhum tempo encontrado no HowLongToBeat.');
    } catch (cause) {
      if (token !== timesTokenRef.current || live) return;
      setTimeEstimateError(errorMessage(cause, 'Não foi possível buscar os tempos no HowLongToBeat.'));
    } finally {
      if (token === timesTokenRef.current) setSearchingTimeEstimates(false);
    }
  }

  async function searchWhileTyping(query: string) {
    if (query === searchedTitleRef.current) return;
    searchedTitleRef.current = query;
    await Promise.allSettled([runSearch('metadata', query, { live: true }), runSearch('times', query, { live: true })]);
  }

  function applyMetadata(candidate: GameMetadataCandidate) {
    setGameFormField('title', candidate.title);
    setGameFormField('description', candidate.description);
    setGameFormField('coverUrl', candidate.coverUrl);
    setGameFormField('backgroundUrl', candidate.backgroundUrl);
    setGameFormField('releaseYear', candidate.releaseYear);
    setGameFormField('developer', candidate.developer);
    setGameFormField('publisher', candidate.publisher);
    setGameFormField('franchiseName', candidate.franchise);
    setGameFormField('genreNames', candidate.genres?.join(', '));
    searchedTitleRef.current = candidate.title.trim();
    setMetadataCandidates([]);
    setMetadataError('Metadata preenchida para revisão. As plataformas do catálogo não foram selecionadas como suas cópias.');
  }

  function applyTimeEstimate(candidate: GameTimeEstimate) {
    setGameFormField('estimatedMainHours', candidate.mainHours);
    setGameFormField('personalEstimatedHours', candidate.mainExtraHours);
    setGameFormField('estimatedCompletionistHours', candidate.completionistHours);
    searchedTitleRef.current = formTitle.trim();
    setTimeEstimateCandidates([]);
    setTimeEstimateError('Tempos preenchidos para revisão: principal, pessoal (principal + extras) e completista.');
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
          keyDecisions: nullableString(form.get('keyDecisions')),
          tips: nullableString(form.get('tips')),
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

  async function startOrContinueSession() {
    if (!selectedGame || sessions.some((session) => session.endedAt === null)) return;
    setSavingSession(true);
    setSessionFeedback('');
    try {
      const response = await fetch(`${apiUrl}/games/${selectedGame.id}/sessions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startedAt: new Date().toISOString(), endedAt: null }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Não foi possível iniciar a sessão.');
      }
      const created = await response.json() as Session;
      setSessions((items) => [created, ...items]);
      await refreshPlanningViews();
    } catch (cause) {
      if (isNetworkFailure(cause)) {
        const queued = offline.enqueue({ kind: 'create', gameId: selectedGame.id, gameTitle: selectedGame.title, payload: { startedAt: new Date().toISOString(), endedAt: null, progress: null, location: null, notes: null } });
        setSessionFeedback(queued.ok ? 'Sem conexão: a sessão foi iniciada neste aparelho. Encerre-a no aviso acima; ela será enviada quando a conexão voltar.' : enqueueFailureMessage(queued));
      } else {
        setSessionFeedback(cause instanceof Error ? cause.message : 'Não foi possível iniciar a sessão.');
      }
    } finally {
      setSavingSession(false);
    }
  }

  async function finishActiveSession() {
    if (!selectedGame) return;
    const active = sessions.find((session) => session.endedAt === null);
    if (!active) return;
    setSavingSession(true);
    setSessionFeedback('');
    try {
      const response = await fetch(`${apiUrl}/games/${selectedGame.id}/sessions/${active.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startedAt: active.startedAt, endedAt: new Date().toISOString(), progress: active.progress, location: active.location, notes: active.notes }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? 'Não foi possível encerrar a sessão.');
      }
      const finished = await response.json() as Session;
      setSessions((items) => items.map((session) => session.id === active.id ? finished : session));
      setEditingSession(finished);
      await refreshPlanningViews();
      setSessionFeedback('Sessão encerrada. Complete os detalhes abaixo, se quiser.');
    } catch (cause) {
      if (isNetworkFailure(cause)) {
        const queued = offline.enqueue({ kind: 'finish', gameId: selectedGame.id, gameTitle: selectedGame.title, sessionId: active.id, endedAt: new Date().toISOString() });
        setSessionFeedback(queued.ok ? 'Sem conexão: o encerramento foi guardado neste aparelho e será enviado quando a conexão voltar.' : enqueueFailureMessage(queued));
      } else {
        setSessionFeedback(cause instanceof Error ? cause.message : 'Não foi possível encerrar a sessão.');
      }
    } finally {
      setSavingSession(false);
    }
  }

  function closeEditor() {
    setDialogOpen(false);
    setEditing(null);
  }

  function openEditor(game: Game | null = null) {
    const title = game?.title ?? '';
    setEditing(game);
    setFormStatus(game?.status ?? 'BACKLOG');
    setFormTitle(title);
    setMetadataCandidates([]);
    setMetadataError('');
    setTimeEstimateCandidates([]);
    setTimeEstimateError('');
    setSearchingMetadata(false);
    setSearchingTimeEstimates(false);
    searchedTitleRef.current = title.trim();
    setDialogOpen(true);
    const missingEstimates = game != null
      && (game.estimatedMainHours == null || game.personalEstimatedHours == null || game.estimatedCompletionistHours == null);
    if (missingEstimates) void runSearch('times', title, { live: true });
  }

  function showDetails(game: Game) {
    setSelectedGame(game);
  }

  function navigateDetails(direction: -1 | 1) {
    if (!selectedGame) return;
    const index = visibleGames.findIndex((game) => game.id === selectedGame.id);
    const next = visibleGames[index + direction];
    if (next) setSelectedGame(next);
  }

  async function addRetroactiveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGame) return;
    const amount = Number(retroactiveHours);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await updateGame(selectedGame, { retroactivePlayedHours: Number(((selectedGame.retroactivePlayedHours ?? 0) + amount).toFixed(2)) });
    setRetroactiveHours('');
    setSessionFeedback('Horas retroativas adicionadas.');
  }

  function prepareGameStatus(game: Game, status: Game['status']) {
    openEditor(game);
    setFormStatus(status);
  }

  async function updateGame(game: Game, values: Partial<Game>) {
    const response = await fetch(`${apiUrl}/games/${game.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
    if (!response.ok) { setError('Não foi possível atualizar o jogo.'); return; }
    const updated = await response.json() as Game;
    setSelectedGame((current) => current?.id === updated.id ? updated : current);
    await loadGames();
    await refreshPlanningViews();
  }

  async function startDashboardSession(game: Game) {
    const startedAt = new Date().toISOString();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/games/${game.id}/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ startedAt, endedAt: null }) });
    } catch (cause) {
      if (!isNetworkFailure(cause)) throw cause;
      const queued = offline.enqueue({ kind: 'create', gameId: game.id, gameTitle: game.title, payload: { startedAt, endedAt: null, progress: null, location: null, notes: null } });
      if (!queued.ok) setError(enqueueFailureMessage(queued));
      return;
    }
    if (!response.ok) { setError('Não foi possível iniciar a sessão.'); return; }
    await refreshPlanningViews();
  }

  async function finishDashboardSession(game: Game, session: Session) {
    const endedAt = new Date().toISOString();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/games/${game.id}/sessions/${session.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endedAt }) });
    } catch (cause) {
      if (!isNetworkFailure(cause)) throw cause;
      const queued = offline.enqueue({ kind: 'finish', gameId: game.id, gameTitle: game.title, sessionId: session.id, endedAt });
      if (!queued.ok) setError(enqueueFailureMessage(queued));
      return;
    }
    if (!response.ok) { setError('Não foi possível encerrar a sessão.'); return; }
    const finished = await response.json() as Session;
    await refreshPlanningViews();
    setSelectedGame(game);
    setEditingSession(finished);
  }

  return (
    <main className="library-shell">
      <OfflineBanner pending={offline.pending} online={offline.online} notice={offline.notice} onFinishOpen={offline.finishOpen} onDiscard={offline.discard} onRetry={() => void offline.flush()} />
      <header className="library-header">
        <a className="brand" href="/" aria-label="GameShelf início"><span className="brand-mark">G</span><span>Game<span className="brand-accent">Shelf</span></span></a>
        <nav className="main-nav" aria-label="Navegação principal"><button type="button" aria-current={activeView === 'library' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('library'); }}>Biblioteca</button><button type="button" aria-current={activeView === 'queue' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('queue'); }}>Fila <span>{queue.length}</span></button><button type="button" aria-current={activeView === 'lists' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('lists'); }}>Listas</button><button type="button" aria-current={activeView === 'dashboard' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('dashboard'); }}>Painel</button><button type="button" aria-current={activeView === 'timeline' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('timeline'); }}>Atividade</button><button type="button" aria-current={activeView === 'stats' ? 'page' : undefined} onClick={() => { setSelectedGame(null); setActiveView('stats'); }}>Estatísticas</button></nav>
        <span className="local-badge"><span /> LOCAL</span>
      </header>
      {selectedGame ? <section className="details-page" aria-labelledby="details-title">
        <button className="back-link" type="button" onClick={() => setSelectedGame(null)}>← Voltar</button>
        <div className="details-navigation"><Button type="button" disabled={visibleGames.findIndex((game) => game.id === selectedGame.id) <= 0} onClick={() => navigateDetails(-1)}>← Jogo anterior</Button><Button type="button" disabled={visibleGames.findIndex((game) => game.id === selectedGame.id) < 0 || visibleGames.findIndex((game) => game.id === selectedGame.id) >= visibleGames.length - 1} onClick={() => navigateDetails(1)}>Próximo jogo →</Button></div>
        <div className="details-layout">
          <div className="details-cover">{selectedGame.coverUrl ? <img src={selectedGame.coverUrl} alt={`Capa de ${selectedGame.title}`} /> : <span aria-hidden="true">▧</span>}</div>
          <div className="details-content">
            <p className="eyebrow">DETALHES DO JOGO</p>
            <h1 id="details-title">{selectedGame.title}</h1>
            <p className="details-byline">{[selectedGame.releaseYear, selectedGame.developer, selectedGame.publisher, franchises.find((franchise) => franchise.id === selectedGame.franchiseId)?.name].filter(Boolean).join(' · ') || 'Metadata ainda não informada'}</p>
            <div className="details-badges"><span className={`status-pill status-${selectedGame.status.toLowerCase()}`}>{statusLabels[selectedGame.status]}</span><span className="priority-badge">Prioridade {selectedGame.priority === 'HIGH' ? 'alta' : selectedGame.priority === 'LOW' ? 'baixa' : 'normal'}</span>{selectedGame.favorite && <span className="priority-badge">★ Favorito</span>}{selectedGame.gameOfYear && selectedGame.completedAt && <span className="priority-badge">Jogo do ano {selectedGame.completedAt.slice(0, 4)}</span>}{selectedGame.difficulty && <span className="priority-badge">Dificuldade {difficultyLabels[selectedGame.difficulty]}</span>}{selectedGame.rating != null && <span className="priority-badge">Nota {selectedGame.rating === 11 ? '11 · Jogo da Vida' : `${selectedGame.rating}/10`}</span>}</div>
            {journal.length > 0 && <section className="details-section session-journal"><h2>Onde parei</h2><dl className="journal-list">{journal.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}<small>registrado na sessão de {formatDateTime(entry.at)}</small></dd></div>)}</dl></section>}
            {selectedGame.description && <section className="details-section"><h2>Descrição</h2><p>{selectedGame.description}</p></section>}
            <section className="details-section"><h2>Minha jornada</h2><p>Plataforma: {platforms.find((platform) => platform.id === selectedGame.platformId)?.name ?? 'Não selecionada'}</p><p>{selectedGame.owned ? 'Possuo este jogo' : 'Não possuo este jogo'} · {statusLabels[selectedGame.status]}</p>{selectedGame.startedAt && <p>Início: {formatDateOnly(selectedGame.startedAt)}</p>}{selectedGame.completedAt && <p>Conclusão: {formatDateOnly(selectedGame.completedAt)}</p>}{selectedGame.gameType && <p>Tipo: {selectedGame.gameType}</p>}{selectedGame.completionCondition && <p>Condição de zeramento: {selectedGame.completionCondition}</p>}<p className="genre-summary">Gêneros: {selectedGame.genreIds.map((id) => genres.find((genre) => genre.id === id)?.name).filter(Boolean).join(', ') || 'Não informados'}</p></section>
            <section className="details-section"><h2>Estimativas de duração</h2><dl className="estimate-list">
              <div><dt>História principal</dt><dd>{formatHours(selectedGame.estimatedMainHours)}</dd></div>
              <div><dt>Completista</dt><dd>{formatHours(selectedGame.estimatedCompletionistHours)}</dd></div>
              <div><dt>Pessoal</dt><dd>{formatHours(selectedGame.personalEstimatedHours)}</dd></div>
            </dl></section>
            <section className="details-section session-section"><h2>Horas Jogadas</h2><p>{formatDuration(sessions.reduce((total, session) => total + (session.durationMinutes ?? 0), 0) + Math.round((selectedGame.retroactivePlayedHours ?? 0) * 60))} no total</p><p>{formatHours(selectedGame.retroactivePlayedHours ?? 0)} lançadas sem sessão</p><form className="session-form" onSubmit={(event) => void addRetroactiveHours(event)}><label className="form-field">Adicionar horas retroativas<input aria-label="Horas retroativas" type="number" min="0.01" step="0.01" required value={retroactiveHours} onChange={(event) => setRetroactiveHours(event.target.value)} /></label><Button type="submit">Lançar horas</Button></form><h3>Sessões</h3>
              {sessions.find((session) => session.endedAt === null) ? <div className="session-timer"><div><p className="eyebrow">SESSÃO EM ANDAMENTO</p><strong>{formatElapsed(sessions.find((session) => session.endedAt === null)!.startedAt, clockNow)}</strong></div><Button type="button" disabled={savingSession} onClick={() => void finishActiveSession()}>{savingSession ? 'Encerrando…' : 'Encerrar sessão'}</Button></div> : <div className="session-timer"><div><p className="eyebrow">PRÓXIMA SESSÃO</p><strong>Pronto para jogar?</strong></div><Button type="button" disabled={savingSession} onClick={() => void startOrContinueSession()}>{savingSession ? 'Iniciando…' : 'Continuar jogando'}</Button></div>}
              {editingSession !== null && <form key={editingSession.id} className="session-form" onSubmit={submitSession}>
                <label className="form-field">Início<input name="startedAt" type="datetime-local" required defaultValue={toDateTimeLocal(editingSession ? new Date(editingSession.startedAt) : new Date(Date.now() - 60 * 60_000))} /></label>
                <label className="form-field">Término<input name="endedAt" type="datetime-local" defaultValue={editingSession?.endedAt ? toDateTimeLocal(new Date(editingSession.endedAt)) : editingSession ? '' : toDateTimeLocal(new Date())} /><small>Deixe vazio para manter a sessão em andamento.</small></label>
                <label className="form-field">Progresso (%)<input name="progress" type="number" min="0" max="100" step="1" defaultValue={editingSession?.progress ?? ''} /></label>
                <label className="form-field">Onde parei<input name="location" maxLength={200} placeholder="A missão, capítulo ou ponto exato" defaultValue={editingSession?.location ?? ''} /></label>
                <label className="form-field form-wide">Resumo da história<textarea name="notes" rows={3} maxLength={10000} defaultValue={editingSession?.notes ?? ''} /></label>
                <label className="form-field form-wide">Decisões importantes<textarea name="keyDecisions" rows={2} maxLength={10000} defaultValue={editingSession?.keyDecisions ?? ''} /></label>
                <label className="form-field form-wide">Dicas e lembretes<textarea name="tips" rows={2} maxLength={10000} defaultValue={editingSession?.tips ?? ''} /></label>
                <div className="form-wide session-actions"><Button type="submit" disabled={savingSession}>{savingSession ? 'Salvando…' : editingSession ? 'Salvar sessão' : 'Registrar sessão'}</Button>{editingSession && <button type="button" className="cancel-button" onClick={() => setEditingSession(null)}>Cancelar edição</button>}</div>
              </form>}
              {sessionFeedback && <p role="status" className="session-feedback">{sessionFeedback}</p>}
              {sessions.length === 0 ? <p className="session-empty">Nenhuma sessão registrada.</p> : <ol className="session-list">{sessions.map((session) => <li key={session.id}>
                <div><strong>{formatDateTime(session.startedAt)}</strong><span>{session.endedAt ? formatDuration(session.durationMinutes) : 'Em andamento'}</span>{!session.endedAt && <small className="session-live-duration">{formatElapsed(session.startedAt, clockNow)}</small>}</div>
                <p>{[session.location, session.progress === null ? null : `${session.progress}%`].filter(Boolean).join(' · ') || 'Sem progresso informado'}</p>
                {journalEntries(session, recapFields).map((entry) => <p key={entry.label} className="session-journal-entry"><strong>{entry.label}</strong>{entry.value}</p>)}
                <div className="session-item-actions"><button type="button" className="session-edit" onClick={() => setEditingSession(session)}>Editar sessão</button><button type="button" className="session-delete" onClick={() => void deleteSession(session)}>Excluir sessão</button></div>
                <SessionScreenshots gameId={session.gameId} sessionId={session.id} />
              </li>)}</ol>}
            </section>
            {selectedGame.notes && <section className="details-section"><h2>Notas pessoais</h2><p>{selectedGame.notes}</p></section>}
            <div className="game-detail-actions"><Button type="button" onClick={() => openEditor(selectedGame)}>Editar jogo</Button><Button type="button" onClick={() => void updateGame(selectedGame, { archived: !selectedGame.archived })}>{selectedGame.archived ? 'Desarquivar' : 'Arquivar'}</Button><button type="button" className="session-edit" aria-pressed={selectedGame.excludedFromSuggestions} onClick={() => void updateGame(selectedGame, { excludedFromSuggestions: !selectedGame.excludedFromSuggestions })}>{selectedGame.excludedFromSuggestions ? 'Voltar a sugerir' : 'Não sugerir este jogo'}</button><button type="button" className="session-delete" onClick={() => void deleteGame(selectedGame)}>Excluir jogo</button></div>
          </div>
        </div>
      </section> : activeView === 'dashboard' ? <DashboardView dashboard={dashboard} queue={queue} now={clockNow} period={dashboardPeriod} customPeriod={customPeriod} onPeriodChange={(period) => { setDashboardPeriod(period); try { window.localStorage.setItem('gameshelf-dashboard-period', period); } catch { /* Storage can be unavailable in private test contexts. */ } }} onCustomPeriodChange={(value) => { setCustomPeriod(value); try { window.localStorage.setItem('gameshelf-dashboard-custom-period', JSON.stringify(value)); } catch { /* Storage can be unavailable in private test contexts. */ } }} onRefresh={refreshPlanningViews} onSelectGame={showDetails} onStartSession={startDashboardSession} onFinishSession={finishDashboardSession} onPauseGame={(game) => void updateGame(game, { status: 'PAUSED' })} onPrepareStatus={prepareGameStatus} onOpenQueue={() => setActiveView('queue')} onFilterLibrary={applyLibraryFilter} /> : activeView === 'stats' ? <StatsView refreshKey={games} onOpenGame={(gameId) => { const target = games.find((item) => item.id === gameId); if (target) showDetails(target); }} /> : activeView === 'timeline' ? <TimelineView games={games} onSelectGame={showDetails} /> : activeView === 'queue' ? <QueueView queue={queue} onMove={moveQueueItem} onRemove={removeFromQueue} onSelectGame={showDetails} /> : activeView === 'lists' ? <GameListsView games={games} onSelectGame={showDetails} onQueueChanged={setQueue} /> : <>
      <section className="library-heading">
        <div><p className="eyebrow">SUA COLEÇÃO</p><h1>Biblioteca</h1><p className="library-subtitle">Seus jogos, reunidos em um só lugar.</p></div>
        <Button type="button" onClick={() => openEditor()}>＋ Adicionar jogo</Button>
      </section>
      <section className="library-tools" aria-label="Ferramentas da biblioteca">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar jogos" placeholder="Buscar na biblioteca" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="filter-field">Status<select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Game['status'] | 'ALL')}><option value="ALL">Todos</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label className="filter-field">Prioridade<select aria-label="Filtrar por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Game['priority'] | 'ALL')}><option value="ALL">Todas</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority === 'LOW' ? 'Baixa' : priority === 'HIGH' ? 'Alta' : 'Normal'}</option>)}</select></label>
        <div className="filter-field"><span>Plataforma</span><select aria-label="Agrupar por plataforma" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option value="ALL">Todas</option>{platforms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="filter-field"><span>Gênero</span><select aria-label="Agrupar por gênero" value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)}><option value="ALL">Todos</option>{genres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="filter-field"><span>Franquia</span><select aria-label="Agrupar por franquia" value={franchiseFilter} onChange={(event) => setFranchiseFilter(event.target.value)}><option value="ALL">Todas</option>{franchises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="filter-field"><span>Desenvolvedora</span><select aria-label="Agrupar por desenvolvedora" value={developerFilter} onChange={(event) => setDeveloperFilter(event.target.value)}><option value="ALL">Todas</option>{[...new Set(games.map((game) => game.developer).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
        <div className="filter-field"><span>Lista</span><select aria-label="Filtrar por lista" value={listFilter} onChange={(event) => setListFilter(event.target.value)}><option value="ALL">Todas</option>{lists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="filter-field"><span>Zerado em</span><select aria-label="Filtrar por ano de conclusão" value={completedYearFilter} onChange={(event) => setCompletedYearFilter(event.target.value)}><option value="ALL">Todos</option>{completedYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
        <div className="filter-field"><span>Ordenar por</span><select aria-label="Ordenar jogos" value={sortBy} onChange={(event) => setSortBy(event.target.value as LibrarySort)}>{(Object.keys(sortLabels) as LibrarySort[]).map((option) => <option key={option} value={option}>{sortLabels[option]}</option>)}</select></div>
        <span className="game-count">{games.length} {games.length === 1 ? 'jogo' : 'jogos'}</span>
        <button type="button" className="session-edit" aria-pressed={showArchived} onClick={() => setShowArchived((value) => !value)}>{showArchived ? 'Ver biblioteca' : 'Ver arquivados'}</button>
        <div className="filter-field"><span>Filtro salvo</span><select aria-label="Aplicar filtro salvo" value={activeSavedFilter} onChange={(event) => applySavedFilter(event.target.value)}><option value="ALL">Nenhum</option>{savedFilters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{activeSavedFilter !== 'ALL' && <button type="button" className="session-delete" onClick={() => void deleteSavedFilter(activeSavedFilter)}>Excluir filtro</button>}</div>
        {namingFilter
          ? <form className="list-from-filter" onSubmit={(event) => void saveCurrentFilter(event)}><label className="form-field">Nome do filtro<input aria-label="Nome do filtro salvo" required maxLength={100} value={newFilterName} onChange={(event) => setNewFilterName(event.target.value)} autoFocus /></label><Button type="submit">Salvar filtro</Button><button type="button" className="cancel-button" onClick={() => { setNamingFilter(false); setNewFilterName(''); }}>Cancelar</button></form>
          : <button type="button" className="session-edit" onClick={() => { setFilterFeedback(''); setNamingFilter(true); }}>Salvar filtro atual</button>}
        {filterFeedback && <p role="status" className="session-feedback">{filterFeedback}</p>}
        {creatingList
          ? <form className="list-from-filter" onSubmit={(event) => void createListFromFilter(event)}><label className="form-field">Nome da lista<input aria-label="Nome da nova lista" required maxLength={100} value={newListName} onChange={(event) => setNewListName(event.target.value)} autoFocus /></label><Button type="submit">Criar com {visibleGames.length} {visibleGames.length === 1 ? 'jogo' : 'jogos'}</Button><button type="button" className="cancel-button" onClick={() => { setCreatingList(false); setNewListName(''); }}>Cancelar</button></form>
          : <button type="button" className="session-edit" disabled={visibleGames.length === 0} onClick={() => { setListFeedback(''); setCreatingList(true); }}>Criar lista com estes jogos</button>}
        {listFeedback && <p role="status" className="session-feedback">{listFeedback}</p>}
      </section>
      {error && <div className="notice" role="alert">{error}<button type="button" onClick={() => void loadGames()}>Tentar novamente</button></div>}
      {loading ? <p className="empty-state">Carregando biblioteca…</p> : visibleGames.length === 0 ? (
        <section className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h2>{query ? 'Nenhum jogo encontrado' : 'Sua biblioteca começa aqui'}</h2><p>{query ? 'Tente buscar por outro título.' : 'Adicione seu primeiro jogo para começar a organizar sua coleção.'}</p>{!query && <Button type="button" onClick={() => openEditor()}>Adicionar primeiro jogo</Button>}</section>
      ) : (
        <section className="game-grid" aria-label="Jogos da biblioteca">{visibleGames.map((game) => <div className="game-card-wrap" key={game.id}><button className="game-card" type="button" onClick={() => showDetails(game)} aria-label={`Ver detalhes de ${game.title}`}>
          <span className="game-cover">{game.coverUrl ? <img src={game.coverUrl} alt="" /> : <span aria-hidden="true">▧</span>}<span className={`status-pill status-${game.status.toLowerCase()}`}>{statusLabels[game.status]}</span></span>
          <span className="game-card-title">{game.title}</span><span className="game-card-meta">{[game.releaseYear, game.developer].filter(Boolean).join(' · ') || 'Detalhes não informados'}</span>
        </button><button type="button" className="queue-toggle" disabled={!game.owned || game.archived || game.status === 'COMPLETED' || game.status === 'ABANDONED'} onClick={() => void (queue.some((item) => item.game.id === game.id) ? removeFromQueue(game.id) : addToQueue(game))}>{queue.some((item) => item.game.id === game.id) ? 'Na fila · Remover' : '＋ Adicionar à fila'}</button></div>)}</section>
      )}
      </>}
      {dialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}><section className="game-dialog" role="dialog" aria-modal="true" aria-labelledby="game-dialog-title"><header><div><p className="eyebrow">BIBLIOTECA</p><h2 id="game-dialog-title">{editing ? 'Editar jogo' : 'Adicionar jogo'}</h2></div><button className="dialog-close" type="button" aria-label="Fechar" onClick={closeEditor}>×</button></header>
        <form ref={gameFormRef} onSubmit={submitGame}><label className="form-field form-wide">Título<input name="title" required maxLength={200} value={formTitle} onChange={(event) => setFormTitle(event.target.value)} autoFocus /></label>
          <div className="metadata-search form-wide"><Button type="button" disabled={searchingMetadata} onClick={() => void searchMetadata()}>{searchingMetadata ? 'Buscando…' : 'Buscar metadata'}</Button><small>A busca acontece conforme você digita. Os dados encontrados são preenchidos para revisão e só são salvos quando você salvar o jogo.</small>{metadataError && <p role="status">{metadataError}</p>}{metadataCandidates.length > 0 && <ul aria-label="Resultados de metadata">{metadataCandidates.map((candidate) => <li key={candidate.providerId}><button type="button" onClick={() => applyMetadata(candidate)}>{candidate.coverUrl && <img src={candidate.coverUrl} alt="" />}<span><strong>{candidate.title}</strong><small>{[candidate.releaseYear, candidate.developer].filter(Boolean).join(' · ')}</small></span></button></li>)}</ul>}</div>
          <label className="form-field">Desenvolvedora<input name="developer" maxLength={200} defaultValue={editing?.developer ?? ''} /></label><label className="form-field">Publicadora<input name="publisher" maxLength={200} defaultValue={editing?.publisher ?? ''} /></label>
          <label className="form-field">Ano<input name="releaseYear" type="number" min="1" max="9999" defaultValue={editing?.releaseYear ?? ''} /></label><label className="form-field">Capa<input name="coverUrl" type="text" inputMode="url" maxLength={2048} defaultValue={editing?.coverUrl ?? ''} /><small>Aceita uma URL ou um caminho local do GameShelf, como /media/imagem.jpg.</small></label><label className="form-field form-wide">Imagem de fundo<input name="backgroundUrl" type="text" inputMode="url" maxLength={2048} defaultValue={editing?.backgroundUrl ?? ''} /></label>
          <label className="form-field form-wide">Franquia<input name="franchiseName" maxLength={200} defaultValue={franchises.find((franchise) => franchise.id === editing?.franchiseId)?.name ?? ''} placeholder="Ex.: The Legend of Zelda" /></label>
          <label className="form-field">Plataforma<select name="platformId" defaultValue={editing?.platformId ?? ''}><option value="">Não selecionada</option>{platforms.map((platform) => <option value={platform.id} key={platform.id}>{platform.name}</option>)}</select></label><label className="form-field">Adicionar plataforma<input name="platformNames" placeholder="Ex.: PlayStation 5" /><small>Informe uma plataforma caso ela ainda não exista.</small></label>
          <label className="form-field"><span>Possuo este jogo</span><input type="checkbox" name="owned" defaultChecked={editing?.owned ?? false} /></label><label className="form-field">Status<select name="status" value={formStatus} onChange={(event) => setFormStatus(event.target.value as Game['status'])}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
          <label className="form-field">Início gameplay<input type="date" name="startedAt" defaultValue={editing?.startedAt ?? ''} /></label><label className="form-field">Data que zerei<input type="date" name="completedAt" defaultValue={editing?.completedAt ?? ''} /></label>
          <label className="form-field form-wide">Gêneros<input name="genreNames" defaultValue={editing?.genreIds.map((id) => genres.find((genre) => genre.id === id)?.name).filter(Boolean).join(', ') ?? ''} placeholder="Ex.: RPG, Ação" /><small>Separe vários nomes por vírgula.</small></label>
          <label className="form-field">Avaliação<select name="rating" disabled={formStatus !== 'COMPLETED' && formStatus !== 'ABANDONED'} defaultValue={editing?.rating ?? ''}><option value="">Sem avaliação</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <option value={rating} key={rating}>{rating}/10</option>)}<option value="11">11 · Jogo da Vida</option></select>{formStatus !== 'COMPLETED' && formStatus !== 'ABANDONED' && editing?.rating != null && <small>A nota atual será preservada e poderá ser alterada ao zerar ou abandonar o jogo.</small>}</label><label className="form-field">Prioridade<select name="priority" defaultValue={editing?.priority ?? 'NORMAL'}>{priorities.map((priority) => <option value={priority} key={priority}>{priority === 'LOW' ? 'Baixa' : priority === 'HIGH' ? 'Alta' : 'Normal'}</option>)}</select></label>
          <label className="form-field">Dificuldade<select name="difficulty" defaultValue={editing?.difficulty ?? ''}><option value="">Não informada</option>{(Object.keys(difficultyLabels) as Array<keyof typeof difficultyLabels>).map((level) => <option value={level} key={level}>{difficultyLabels[level]}</option>)}</select></label><label className="form-field">Tipo<input name="gameType" maxLength={100} defaultValue={editing?.gameType ?? ''} placeholder="Ex.: Action RPG, Metroidvania" /></label>
          <label className="form-field form-wide">Condição de zeramento<input name="completionCondition" maxLength={300} defaultValue={editing?.completionCondition ?? ''} placeholder="Ex.: Veja os créditos" /></label>
          <label className="form-field checkbox-field"><span>Favorito</span><input type="checkbox" name="favorite" defaultChecked={editing?.favorite ?? false} /></label><label className="form-field checkbox-field"><span>Jogo do ano (exige data que zerei)</span><input type="checkbox" name="gameOfYear" defaultChecked={editing?.gameOfYear ?? false} /></label>
          <label className="form-field">Estimativa principal (h)<input name="estimatedMainHours" type="number" min="0" step="0.25" defaultValue={editing?.estimatedMainHours ?? ''} /></label><label className="form-field">Estimativa completista (h)<input name="estimatedCompletionistHours" type="number" min="0" step="0.25" defaultValue={editing?.estimatedCompletionistHours ?? ''} /></label>
          <label className="form-field">Estimativa pessoal (h)<input name="personalEstimatedHours" type="number" min="0" step="0.25" defaultValue={editing?.personalEstimatedHours ?? ''} /></label>
          <div className="metadata-search form-wide"><Button type="button" disabled={searchingTimeEstimates} onClick={() => void searchTimeEstimates()}>{searchingTimeEstimates ? 'Buscando…' : 'Buscar tempos (HowLongToBeat)'}</Button><small>A busca acontece conforme você digita. Preenche principal, pessoal (principal + extras) e completista para revisão.</small>{timeEstimateError && <p role="status">{timeEstimateError}</p>}{timeEstimateCandidates.length > 0 && <ul aria-label="Resultados de tempo">{timeEstimateCandidates.map((candidate) => <li key={candidate.providerId}><button type="button" onClick={() => applyTimeEstimate(candidate)}><span><strong>{candidate.title}</strong><small>{[candidate.releaseYear, candidate.mainHours != null ? `Principal ${candidate.mainHours} h` : null, candidate.mainExtraHours != null ? `+extras ${candidate.mainExtraHours} h` : null, candidate.completionistHours != null ? `Completista ${candidate.completionistHours} h` : null].filter(Boolean).join(' · ')}</small></span></button></li>)}</ul>}</div>
          <label className="form-field form-wide">Descrição<textarea name="description" rows={2} maxLength={10000} defaultValue={editing?.description ?? ''} /></label>
          <label className="form-field form-wide">Notas<textarea name="notes" rows={2} maxLength={10000} defaultValue={editing?.notes ?? ''} /></label>
          <footer className="dialog-actions"><button className="cancel-button" type="button" onClick={closeEditor}>Cancelar</button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar jogo'}</Button></footer>
        </form></section></div>}
    </main>
  );
}

function QueueView({ queue, onMove, onRemove, onSelectGame }: {
  queue: QueueItem[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (gameId: string) => void;
  onSelectGame: (game: Game) => void;
}) {
  return <section className="queue-page" aria-labelledby="queue-title"><p className="eyebrow">SEU PRÓXIMO PASSO</p><h1 id="queue-title">Fila de jogos</h1><p className="library-subtitle">Organize o que pretende jogar. A posição da fila é independente da prioridade.</p><NextGameSuggestion onSelectGame={onSelectGame} />
    {queue.length ? <ol className="queue-list">{queue.map((item, index) => <li key={item.game.id}><span className="queue-position">{index + 1}</span><button type="button" className="queue-game-link" onClick={() => onSelectGame(item.game)}><strong>{item.game.title}</strong><span>{item.game.personalEstimatedHours ?? item.game.estimatedMainHours ?? 'Sem estimativa'}{item.game.personalEstimatedHours !== null || item.game.estimatedMainHours !== null ? ' h estimadas' : ''}</span></button><div className="queue-actions"><button type="button" aria-label={`Mover ${item.game.title} para cima`} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button><button type="button" aria-label={`Mover ${item.game.title} para baixo`} disabled={index === queue.length - 1} onClick={() => onMove(index, 1)}>↓</button><button type="button" className="session-delete" onClick={() => onRemove(item.game.id)}>Remover</button></div></li>)}</ol> : <p className="dashboard-empty">Fila vazia. Adicione jogos pela biblioteca.</p>}
  </section>;
}

function GameListsView({ games, onSelectGame, onQueueChanged }: { games: Game[]; onSelectGame: (game: Game) => void; onQueueChanged: (queue: QueueItem[]) => void }) {
  const [lists, setLists] = useState<GameListSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedList, setSelectedList] = useState<GameList | null>(null);
  const [rename, setRename] = useState('');
  const [newName, setNewName] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [queueNotice, setQueueNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLists(preferredId = selectedId) {
    const response = await fetch(`${apiUrl}/lists`);
    if (!response.ok) throw new Error('Não foi possível carregar as listas.');
    const items = await response.json() as GameListSummary[];
    setLists(items);
    const nextId = items.some((item) => item.id === preferredId) ? preferredId : items[0]?.id ?? '';
    setSelectedId(nextId);
  }

  async function loadList(id: string) {
    if (!id) { setSelectedList(null); return; }
    const response = await fetch(`${apiUrl}/lists/${id}`);
    if (!response.ok) throw new Error('Não foi possível carregar esta lista.');
    const item = await response.json() as GameList;
    setSelectedList(item);
    setRename(item.name);
  }

  useEffect(() => { void loadLists('').catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar listas.')); }, []);
  useEffect(() => { void loadList(selectedId).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar lista.')); }, [selectedId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a lista.'); }
    finally { setBusy(false); }
  }

  async function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const response = await fetch(`${apiUrl}/lists`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Não foi possível criar a lista.');
      const created = await response.json() as GameListSummary;
      setNewName('');
      await loadLists(created.id);
    });
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedList) return;
    await run(async () => {
      const response = await fetch(`${apiUrl}/lists/${selectedList.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: rename }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Não foi possível renomear a lista.');
      await loadLists(selectedList.id);
      await loadList(selectedList.id);
    });
  }

  async function deleteList() {
    if (!selectedList || !window.confirm(`Excluir a lista “${selectedList.name}”? Os jogos continuarão na biblioteca.`)) return;
    await run(async () => {
      const response = await fetch(`${apiUrl}/lists/${selectedList.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível excluir a lista.');
      setSelectedList(null);
      await loadLists('');
    });
  }

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedList || !gameId) return;
    await run(async () => {
      const response = await fetch(`${apiUrl}/lists/${selectedList.id}/games`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameId }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Não foi possível adicionar o jogo.');
      await Promise.all([loadLists(selectedList.id), loadList(selectedList.id)]);
      setGameId('');
    });
  }

  async function enqueueList() {
    if (!selectedList) return;
    await run(async () => {
      const response = await fetch(`${apiUrl}/queue/from-list`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listId: selectedList.id }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Não foi possível adicionar a lista à fila.');
      const result = await response.json() as { added: number; skipped: number; queue: QueueItem[] };
      onQueueChanged(result.queue);
      setQueueNotice(result.added === 0 ? 'Nenhum jogo novo para a fila: os da lista já estão nela ou não podem entrar.' : `${result.added} ${result.added === 1 ? 'jogo adicionado' : 'jogos adicionados'} à fila${result.skipped ? `; ${result.skipped} ignorados (já na fila, sem posse, arquivados, zerados ou abandonados)` : ''}.`);
    });
  }

  async function removeGame(id: string) {
    if (!selectedList) return;
    await run(async () => {
      const response = await fetch(`${apiUrl}/lists/${selectedList.id}/games/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível remover o jogo da lista.');
      await Promise.all([loadLists(selectedList.id), loadList(selectedList.id)]);
    });
  }

  const availableGames = games.filter((game) => !selectedList?.games.some((item) => item.id === game.id));
  return <section className="queue-page game-lists-page" aria-labelledby="lists-title">
    <p className="eyebrow">SUA ORGANIZAÇÃO</p><h1 id="lists-title">Listas de jogos</h1><p className="library-subtitle">Crie listas temáticas e organize seus jogos. Um jogo pode estar em várias listas.</p>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="game-lists-layout">
      <aside className="game-lists-sidebar"><form className="game-list-create" onSubmit={(event) => void createList(event)}><label className="form-field">Nova lista<input aria-label="Nome da nova lista" required maxLength={100} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex.: Jogos da vida" /></label><Button type="submit" disabled={busy}>Criar lista</Button></form>
        {lists.length ? <ul className="game-list-nav">{lists.map((list) => <li key={list.id}><button type="button" aria-current={selectedId === list.id ? 'true' : undefined} onClick={() => { setSelectedList(null); setQueueNotice(''); setSelectedId(list.id); }}>{list.name}<span>{list.gameCount}</span></button></li>)}</ul> : <p className="dashboard-empty">Você ainda não criou listas.</p>}
      </aside>
      <div className="game-list-content">{selectedList && selectedList.id === selectedId ? <>
        <div className="game-list-heading"><form className="game-list-rename" onSubmit={(event) => void saveName(event)}><label className="form-field">Nome da lista<input aria-label="Nome da lista selecionada" required maxLength={100} value={rename} onChange={(event) => setRename(event.target.value)} /></label><Button type="submit" disabled={busy || rename.trim() === selectedList.name}>Salvar nome</Button></form><button type="button" className="session-edit" disabled={busy || selectedList.games.length === 0} onClick={() => void enqueueList()}>Adicionar à fila</button><button type="button" className="session-delete" disabled={busy} onClick={() => void deleteList()}>Excluir lista</button></div>
        {queueNotice && <p role="status" className="session-feedback">{queueNotice}</p>}
        <form className="game-list-add" onSubmit={(event) => void addGame(event)}><label className="form-field">Adicionar jogo<select aria-label="Jogo para adicionar" required value={gameId} onChange={(event) => setGameId(event.target.value)}><option value="">Selecione um jogo</option>{availableGames.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label><Button type="submit" disabled={busy || !gameId}>Adicionar</Button></form>
        {selectedList.games.length ? <ul className="game-list-items">{selectedList.games.map((game) => <li key={game.id}><button type="button" onClick={() => onSelectGame(game)}><strong>{game.title}</strong><span>{statusLabels[game.status]}</span></button><button type="button" className="session-delete" disabled={busy} onClick={() => void removeGame(game.id)}>Remover</button></li>)}</ul> : <p className="dashboard-empty">Esta lista ainda não tem jogos.</p>}
      </> : <p className="dashboard-empty">Crie uma lista ou selecione uma existente.</p>}</div>
    </div>
  </section>;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  const result = String(value ?? '').trim();
  return result || null;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const result = String(value ?? '').trim();
  return result ? Number(result) : null;
}

function toDateTimeLocal(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
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
