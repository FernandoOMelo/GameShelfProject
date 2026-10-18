import { useCallback, useEffect, useState } from 'react';
import type { ExternalPendingMatch, ExternalSyncState, Game, Platform } from '@gameshelf/contracts';
import { apiUrl, formatDateTime, formatDuration } from './shared';

const base = () => `${apiUrl}/integrations/achievist`;

/**
 * Sincronização manual com o Achievist (ADR-024). A tela mostra o estado da
 * rodada, o tempo que a fonte informa e a fila de correspondências a confirmar.
 * As sugestões são apresentadas como sugestão: nada é vinculado sem o clique do
 * usuário, e ambiguidade aparece marcada em vez de resolvida.
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

  async function confirm(match: ExternalPendingMatch, gameId: string, platformId: string) {
    if (!gameId) { setMessage('Escolha o jogo que corresponde a esta entrada.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${base()}/pending/${match.id}/confirm`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId, ...(platformId ? { platformId } : {}) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(body?.error ?? 'Não foi possível confirmar a correspondência.');
        return;
      }
      setMessage(`"${match.title}" vinculado. Nenhuma sessão ou jornada foi criada.`);
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

  return <section className="panel achievist-panel" aria-labelledby="achievist-title">
    <h2 id="achievist-title">Plataformas externas (Achievist)</h2>
    {state?.status === 'disabled'
      ? <p className="dashboard-empty">{state.error}</p>
      : <>
        <p className="panel-figure">
          O Achievist informa a biblioteca e o tempo acumulado por plataforma. Ele não registra sessões,
          então a sincronização nunca cria sessão, jornada ou replay, e o tempo externo não é somado às suas horas.
        </p>
        <div className="challenge-actions">
          <button type="button" className="gameshelf-button" disabled={busy} onClick={() => void startSync()}>Sincronizar agora</button>
          <button type="button" className="session-edit" disabled={busy} onClick={() => void load()}>Atualizar estado</button>
        </div>
        {state && <p role="status" className="session-feedback">{describe(state)}</p>}
        {message && <p role="alert" className="session-feedback">{message}</p>}

        <h3>Correspondências a confirmar</h3>
        {pending.length === 0
          ? <p className="dashboard-empty">Nada aguardando confirmação.</p>
          : <ul className="achievist-pending">
            {pending.map((match) => <PendingRow key={match.id} match={match} games={games} platforms={platforms} busy={busy}
              onConfirm={(gameId, platformId) => void confirm(match, gameId, platformId)} onIgnore={() => void ignore(match)} />)}
          </ul>}
      </>}
  </section>;
}

function PendingRow({ match, games, platforms, busy, onConfirm, onIgnore }: {
  match: ExternalPendingMatch;
  games: Game[];
  platforms: Platform[];
  busy: boolean;
  onConfirm: (gameId: string, platformId: string) => void;
  onIgnore: () => void;
}) {
  // A sugestão só preenche a escolha quando é única: com mais de um candidato a
  // seleção começa vazia, para que a decisão seja do usuário.
  const [gameId, setGameId] = useState(match.suggestions.length === 1 ? match.suggestions[0].gameId : '');
  const [platformId, setPlatformId] = useState(platforms.find((platform) => platform.name === match.platformName)?.id ?? '');

  return <li>
    <div className="achievist-pending-head">
      <strong>{match.title}</strong>
      <small>{match.platformName}{match.accountLabel ? ` · ${match.accountLabel}` : ''}</small>
    </div>
    <small>
      Tempo informado pela plataforma: {match.externalPlaytimeMinutes === null ? 'não informado' : formatDuration(match.externalPlaytimeMinutes)}
      {match.externalLastPlayedAt && ` · última atividade em ${formatDateTime(match.externalLastPlayedAt)}`}
    </small>
    {match.ambiguous && <p className="achievist-ambiguous">
      {match.suggestions.length} jogos da sua biblioteca têm este título. Escolha qual é: a correspondência não é resolvida automaticamente.
    </p>}
    <label className="form-field">Jogo correspondente
      <select aria-label={`Jogo correspondente a ${match.title}`} value={gameId} onChange={(event) => setGameId(event.target.value)}>
        <option value="">Selecione o jogo</option>
        {games.map((game) => <option key={game.id} value={game.id}>{game.title}{match.suggestions.some((item) => item.gameId === game.id) ? ' (sugerido)' : ''}</option>)}
      </select>
    </label>
    <label className="form-field">Plataforma
      <select aria-label={`Plataforma de ${match.title}`} value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
        <option value="">Criar &quot;{match.platformName}&quot;</option>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select>
    </label>
    <div className="challenge-actions">
      <button type="button" className="gameshelf-button" disabled={busy} onClick={() => onConfirm(gameId, platformId)}>Confirmar vínculo</button>
      <button type="button" className="session-edit" disabled={busy} onClick={onIgnore}>Ignorar</button>
    </div>
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
