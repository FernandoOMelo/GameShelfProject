import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExternalIntegrationStatus, ExternalPendingMatch, ExternalSyncState, Game, Platform } from '@gameshelf/contracts';
import { ConfirmDialog, Switch } from '@gameshelf/ui';
import { PlatformLogo } from './platform-icons';
import { apiUrl, formatDateTime, formatDuration } from './shared';

const base = () => `${apiUrl}/integrations/achievist`;

type Filter = 'ALL' | 'SUGGESTED' | 'AMBIGUOUS';
type Pending = { title: string; description: string; confirmLabel: string; action: () => void | Promise<void> };

const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
const platformFor = (platforms: Platform[], name: string) => platforms.find((platform) => normalize(platform.name) === normalize(name));

/**
 * Sincronização manual com o Achievist (ADR-024). A tela mostra a conexão, o
 * estado da rodada e a fila de entradas importadas a revisar. As sugestões são
 * apresentadas como sugestão: nada é vinculado sem o clique do usuário, e
 * ambiguidade aparece marcada em vez de resolvida.
 */
export function AchievistSyncPanel({ games, platforms, onLinked }: {
  games: Game[];
  platforms: Platform[];
  onLinked?: () => void;
}) {
  const [state, setState] = useState<ExternalSyncState | null>(null);
  const [pending, setPending] = useState<ExternalPendingMatch[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ExternalIntegrationStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [confirming, setConfirming] = useState<Pending | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${base()}/status`);
      if (response.ok) setStatus(await response.json() as ExternalIntegrationStatus);
    } catch { /* o diagnóstico é opcional: o resto do painel segue funcionando */ }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${base()}/sync`);
      const current = await response.json() as ExternalSyncState;
      setState(current);
      if (current.status === 'disabled') { setPending([]); return current; }
      const queue = await fetch(`${base()}/pending`);
      setPending(queue.ok ? await queue.json() as ExternalPendingMatch[] : []);
      return current;
    } catch {
      setMessage('Não foi possível falar com a API do GameShelf.');
      return null;
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function testConnection() {
    setTesting(true);
    setMessage('');
    try { await loadStatus(); } finally { setTesting(false); }
  }

  async function startSync() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${base()}/sync`, { method: 'POST' });
      if (response.status === 409) { setMessage('Já existe uma sincronização em andamento.'); return; }
      if (!response.ok) { setMessage('Não foi possível iniciar a sincronização.'); return; }
      // A rodada é assíncrona: o estado final vem da próxima consulta.
      const current = await load();
      if (current?.status === 'running') setMessage('Sincronização em andamento. Atualize para ver o resultado.');
    } finally { setBusy(false); }
  }

  async function postConfirm(match: ExternalPendingMatch, gameId: string, platformId: string): Promise<string | null> {
    const response = await fetch(`${base()}/pending/${match.id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId, ...(platformId ? { platformId } : {}) }),
    });
    if (response.ok) return null;
    const body = await response.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? 'Não foi possível confirmar a correspondência.';
  }

  async function confirm(match: ExternalPendingMatch, gameId: string, platformId: string) {
    if (!gameId) { setMessage('Escolha o jogo que corresponde a esta entrada.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const error = await postConfirm(match, gameId, platformId);
      if (error) { setMessage(error); return; }
      setMessage(`"${match.title}" vinculado. Nenhuma sessão ou jornada foi criada.`);
      await load();
      onLinked?.();
    } finally { setBusy(false); }
  }

  async function createGame(match: ExternalPendingMatch, game: { title: string; status: Game['status']; owned: boolean }, platformId: string) {
    if (!game.title) { setMessage('Informe o título do novo jogo.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${base()}/pending/${match.id}/create-game`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game, ...(platformId ? { platformId } : {}) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(body?.error ?? 'Não foi possível cadastrar o jogo.');
        return;
      }
      setMessage(`"${game.title}" cadastrado e vinculado. Nenhuma sessão ou jornada foi criada.`);
      await load();
      onLinked?.();
    } finally { setBusy(false); }
  }

  async function ignore(match: ExternalPendingMatch) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${base()}/pending/${match.id}/ignore`, { method: 'POST' });
      if (!response.ok) { setMessage('Não foi possível ignorar a entrada.'); return; }
      setMessage(`"${match.title}" não será mais proposto.`);
      await load();
    } finally { setBusy(false); }
  }

  // Só entra no lote o que a fonte já resolveu sem dúvida: uma única sugestão.
  const batchable = useMemo(() => pending.filter((match) => !match.ambiguous && match.suggestions.length === 1), [pending]);

  async function linkBatch() {
    setBusy(true);
    setMessage('');
    let done = 0;
    try {
      for (const match of batchable) {
        const error = await postConfirm(match, match.suggestions[0]!.gameId, platformFor(platforms, match.platformName)?.id ?? '');
        if (error) { setMessage(`${done} vinculado${done === 1 ? '' : 's'}. Parou em "${match.title}": ${error}`); await load(); if (done > 0) onLinked?.(); return; }
        done += 1;
      }
      setMessage(`${done} entrada${done === 1 ? '' : 's'} vinculada${done === 1 ? '' : 's'}. Nenhuma sessão ou jornada foi criada.`);
      await load();
      onLinked?.();
    } finally { setBusy(false); }
  }

  const visible = pending.filter((match) => {
    if (filter === 'SUGGESTED' && match.suggestions.length === 0) return false;
    if (filter === 'AMBIGUOUS' && !match.ambiguous) return false;
    return !query.trim() || normalize(match.title).includes(normalize(query));
  });
  const disabled = state?.status === 'disabled';
  const connection = status?.reachable === true
    ? `Conexão confirmada${status.accounts === null ? '.' : ` · ${status.accounts} ${status.accounts === 1 ? 'conta conectada' : 'contas conectadas'} no Achievist.`}`
    : null;

  return <>
    <section className="panel achievist-panel" aria-labelledby="achievist-title">
      <h2 id="achievist-title">Plataformas externas (Achievist)</h2>
      {disabled
        ? <div className="ach-notice"><strong>Integração desligada</strong><p>{state?.error}</p></div>
        : <>
          <p className="ach-hint"><span aria-hidden="true">ⓘ</span> O Achievist informa a biblioteca e o tempo acumulado por plataforma. Ele não registra sessões,
            então a sincronização nunca cria sessão, jornada ou replay, e o tempo externo não é somado às suas horas.</p>
          <div className="ach-connection">
            {connection && <span className="sync-chip sync-chip-ok" role="status">{connection}</span>}
            {status?.reachable === false && <span className="sync-chip sync-chip-failed" role="alert">{status.error}</span>}
            {status === null && <span className="sync-chip sync-chip-manual">Verificando conexão…</span>}
            {status !== null && status.reachable === null && <span className="sync-chip sync-chip-manual">{status.configured ? 'Conexão ainda não testada' : 'Não configurada'}</span>}
            <button type="button" className="button-secondary" disabled={testing} onClick={() => void testConnection()}>Testar conexão</button>
          </div>
          <small className="ach-config">
            {status?.configured
              ? 'Configurada no servidor (ACHIEVIST_BASE_URL, usuário e senha). As credenciais nunca saem do servidor nem aparecem em log.'
              : 'A integração é configurada no servidor, pelas variáveis ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD.'}
          </small>
          <div className="ach-sync-row">
            <button type="button" className="gameshelf-button" disabled={busy} onClick={() => void startSync()}>Sincronizar agora</button>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => void load()}>Atualizar estado</button>
            {state && <p role="status" className="ach-sync-state">{describe(state)}</p>}
          </div>
        </>}
    </section>

    {!disabled && <section className="panel ach-queue" aria-labelledby="ach-queue-title">
      <div className="ach-queue-head">
        <h2 id="ach-queue-title">Importados para revisar <span className="ach-count">{pending.length}</span></h2>
        {batchable.length > 1 && <button type="button" className="button-secondary" disabled={busy} onClick={() => setConfirming({
          title: 'Vincular com sugestão única',
          description: `Vincular ${batchable.length} entradas a cada jogo sugerido (${batchable.slice(0, 4).map((match) => `“${match.title}”`).join(', ')}${batchable.length > 4 ? '…' : ''})? Nenhuma sessão ou jornada será criada.`,
          confirmLabel: 'Vincular todos',
          action: linkBatch,
        })}>Vincular todos com sugestão única ({batchable.length})</button>}
      </div>
      {message && <p role="alert" className="session-feedback">{message}</p>}

      {pending.length > 0 && <div className="ach-toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar entrada importada" placeholder="Buscar pelo título" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="ach-filters" role="group" aria-label="Filtrar fila">
          {([['ALL', 'Todos'], ['SUGGESTED', 'Com sugestão'], ['AMBIGUOUS', 'Ambíguos']] as const).map(([value, label]) => <button key={value} type="button" className={`ach-filter${filter === value ? ' is-active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>}

      {pending.length === 0
        ? <div className="sess-empty"><p className="session-empty">Tudo vinculado.{state?.finishedAt ? ` Última sincronização em ${formatDateTime(state.finishedAt)}.` : ''}</p></div>
        : visible.length === 0
          ? <div className="sess-empty"><p className="session-empty">Nenhuma entrada corresponde ao filtro.</p></div>
          : <ul className="achievist-pending">
            {visible.map((match) => <PendingRow key={match.id} match={match} games={games} platforms={platforms} busy={busy}
              onConfirm={(gameId, platformId) => void confirm(match, gameId, platformId)}
              onIgnore={() => setConfirming({ title: 'Ignorar entrada', description: `“${match.title}” não será mais proposta nas próximas sincronizações.`, confirmLabel: 'Ignorar', action: () => ignore(match) })}
              onCreateGame={(game, platformId) => void createGame(match, game, platformId)} />)}
          </ul>}
    </section>}

    <ConfirmDialog
      open={confirming !== null} title={confirming?.title ?? ''} description={confirming?.description} confirmLabel={confirming?.confirmLabel}
      tone="danger" busy={busy}
      onCancel={() => setConfirming(null)}
      onConfirm={() => { const action = confirming?.action; setConfirming(null); void action?.(); }}
    />
  </>;
}

function PendingRow({ match, games, platforms, busy, onConfirm, onIgnore, onCreateGame }: {
  match: ExternalPendingMatch;
  games: Game[];
  platforms: Platform[];
  busy: boolean;
  onConfirm: (gameId: string, platformId: string) => void;
  onIgnore: () => void;
  onCreateGame: (game: { title: string; status: Game['status']; owned: boolean }, platformId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(match.title);
  const [newStatus, setNewStatus] = useState<Game['status']>('BACKLOG');
  const [newOwned, setNewOwned] = useState(true);
  // A sugestão só preenche a escolha quando é única: com mais de um candidato a
  // seleção começa vazia, para que a decisão seja do usuário.
  const [gameId, setGameId] = useState(match.suggestions.length === 1 ? match.suggestions[0]!.gameId : '');
  const [search, setSearch] = useState('');
  const matched = platformFor(platforms, match.platformName);
  const [platformId, setPlatformId] = useState(matched?.id ?? '');
  const [changingPlatform, setChangingPlatform] = useState(false);

  const gameById = (id: string) => games.find((game) => game.id === id);
  const suggestedIds = new Set(match.suggestions.map((item) => item.gameId));
  const results = search.trim()
    ? games.filter((game) => !suggestedIds.has(game.id) && normalize(game.title).includes(normalize(search))).slice(0, 6)
    : [];
  const selected = gameById(gameId);
  const chosenPlatform = platforms.find((platform) => platform.id === platformId);
  const GameChip = ({ id, title, suggested }: { id: string; title: string; suggested: boolean }) => {
    const game = gameById(id);
    return <button type="button" className={`ach-game-chip${gameId === id ? ' is-selected' : ''}`} aria-pressed={gameId === id} onClick={() => setGameId(id)}>
      {game?.coverUrl ? <img src={game.coverUrl} alt="" /> : <span className="ach-game-chip-cover" aria-hidden="true" />}
      <span>{title}{game?.releaseYear ? <small> · {game.releaseYear}</small> : null}{suggested && <em> sugerido</em>}</span>
    </button>;
  };

  return <li className="ach-card">
    <div className="ach-card-head">
      <PlatformLogo platform={chosenPlatform ?? {}} size={44} />
      <div className="ach-card-title">
        <strong>{match.title}</strong>
        <small>{match.platformName}{match.accountLabel ? ` · ${match.accountLabel}` : ''}</small>
        <small>
          {match.externalPlaytimeMinutes ? `Tempo informado pela plataforma: ${formatDuration(match.externalPlaytimeMinutes)}` : 'Sem tempo informado pela plataforma'}
          {match.externalLastPlayedAt && ` · última atividade em ${formatDateTime(match.externalLastPlayedAt)}`}
        </small>
      </div>
      <div className="jp-menu">
        <button type="button" className="jp-menu-btn" aria-label={`Mais ações de ${match.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
        {menuOpen && <div className="jp-menu-list" role="menu">
          <button type="button" role="menuitem" className="jp-danger" disabled={busy} onClick={() => { setMenuOpen(false); onIgnore(); }}>Ignorar</button>
        </div>}
      </div>
    </div>

    {match.ambiguous && <p className="achievist-ambiguous">
      {match.suggestions.length} jogos da sua biblioteca têm este título. Escolha qual é: a correspondência não é resolvida automaticamente.
    </p>}

    <div className="ach-picker">
      <span className="ach-picker-label">Jogo correspondente</span>
      {match.suggestions.length > 0 && <div className="ach-chips">
        {match.suggestions.map((item) => <GameChip key={item.gameId} id={item.gameId} title={item.title} suggested />)}
      </div>}
      <input
        className="ach-search" aria-label={`Jogo correspondente a ${match.title}`} placeholder="Buscar outro jogo da biblioteca"
        value={search} onChange={(event) => setSearch(event.target.value)}
      />
      {results.length > 0 && <div className="ach-chips">{results.map((game) => <GameChip key={game.id} id={game.id} title={game.title} suggested={false} />)}</div>}
      {selected && !suggestedIds.has(selected.id) && <p className="ach-selected">Selecionado: <strong>{selected.title}</strong></p>}
    </div>

    <div className="ach-platform-row">
      <span className="ach-picker-label">Plataforma</span>
      {matched && !changingPlatform
        ? <><span className="ach-platform-chip"><PlatformLogo platform={matched} size={20} />{matched.name}</span>
          <button type="button" className="session-edit" onClick={() => setChangingPlatform(true)}>Alterar</button></>
        : <select aria-label={`Plataforma de ${match.title}`} value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
          <option value="">Criar &quot;{match.platformName}&quot;</option>
          {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
        </select>}
    </div>

    <div className="ach-actions">
      <button type="button" className="gameshelf-button" disabled={busy || !gameId} onClick={() => onConfirm(gameId, platformId)}>Vincular a um jogo</button>
      <button type="button" className="button-secondary" disabled={busy} aria-expanded={creating} onClick={() => setCreating((open) => !open)}>{creating ? 'Cancelar cadastro' : 'Cadastrar como novo jogo'}</button>
    </div>

    {/* O jogo ainda não existe na biblioteca: nasce com o que for preenchido
        aqui. A fonte externa sugere só o título, e não define status nem posse. */}
    {creating && <div className="ach-create">
      <label className="form-field">Título do novo jogo
        <input aria-label={`Título do novo jogo para ${match.title}`} value={newTitle} maxLength={200} onChange={(event) => setNewTitle(event.target.value)} />
      </label>
      <label className="form-field">Estado
        <select aria-label={`Estado do novo jogo para ${match.title}`} value={newStatus} onChange={(event) => setNewStatus(event.target.value as Game['status'])}>
          <option value="BACKLOG">Na biblioteca</option>
          <option value="DESIRED">Desejado</option>
          <option value="PLAYING">Jogando</option>
          <option value="PAUSED">Pausado</option>
        </select>
      </label>
      <label className="form-field checkbox-field"><span>Possuo este jogo</span>
        <Switch aria-label={`Possuo o novo jogo para ${match.title}`} checked={newOwned} onChange={(event) => setNewOwned(event.target.checked)} />
      </label>
      <button type="button" className="gameshelf-button" disabled={busy || !newTitle.trim()}
        onClick={() => onCreateGame({ title: newTitle.trim(), status: newStatus, owned: newOwned }, platformId)}>Cadastrar e vincular</button>
    </div>}
  </li>;
}

function describe(state: ExternalSyncState): string {
  const when = state.finishedAt ?? state.startedAt;
  switch (state.status) {
    case 'running': return 'Sincronização em andamento.';
    case 'failed': return `A última sincronização falhou: ${state.error ?? 'fonte indisponível'}. A biblioteca e as sessões seguem normais.`;
    case 'succeeded': return state.summary
      ? `Última sincronização${when ? ` em ${formatDateTime(when)}` : ''}: ${state.summary.fetched} entradas lidas, ${state.summary.updated} tempos atualizados, ${state.summary.pending} aguardando confirmação. Nenhuma sessão ou jornada criada.`
      : 'Última sincronização concluída.';
    default: return 'Nenhuma sincronização nesta execução da API.';
  }
}
