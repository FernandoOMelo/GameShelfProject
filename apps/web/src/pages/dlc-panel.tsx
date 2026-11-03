import { useEffect, useState, type FormEvent } from 'react';
import type { Dlc, Game, GameUsage, RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';
import { Button, Switch } from '@gameshelf/ui';
import { apiUrl, formatHoursMinutes } from './shared';

const statusLabels: Record<Dlc['status'], string> = { NOT_STARTED: 'Não iniciada', PLAYING: 'Jogando', COMPLETED: 'Concluída' };

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

/** Estado da DLC quando ela é um jogo cadastrado: vem do ciclo de vida do jogo. */
const linkedStatusLabel = (status: Game['status']) => status === 'COMPLETED' ? 'Concluída' : status === 'PLAYING' || status === 'PAUSED' ? 'Jogando' : 'Não iniciada';

const gameOptionLabel = (game: Game) => game.releaseYear ? `${game.title} (${game.releaseYear})` : game.title;

type Props = {
  gameId: string;
  /** Biblioteca, para vincular a DLC a um jogo já cadastrado (ADR-038). */
  games?: Game[];
  /** Horas e conquistas por jogo, para o progresso da DLC vinculada. */
  usage?: Map<string, GameUsage>;
  onOpenGame?: (gameId: string) => void;
};

export function DlcPanel({ gameId, games = [], usage = new Map(), onOpenGame }: Props) {
  const [dlcs, setDlcs] = useState<Dlc[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Record<string, RawgAchievementCandidate[] | 'loading' | 'failed'>>({});
  const [achievements, setAchievements] = useState<Record<string, RawgAchievement[] | 'loading' | 'failed'>>({});

  async function load() {
    const response = await fetch(`${apiUrl}/games/${gameId}/dlcs`);
    if (response.ok) setDlcs(await response.json() as Dlc[]);
  }

  useEffect(() => { void load(); }, [gameId]);

  async function createDlc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const linkedLabel = String(form.get('linkedGame') ?? '').trim();
    const linked = findGameByLabel(linkedLabel);
    const name = String(form.get('name') ?? '').trim() || linked?.title || '';
    if (!name) { setMessage('Informe o nome da DLC.'); return; }
    if (linkedLabel && !linked) { setMessage('Escolha um jogo da lista para vincular.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, releaseDate: String(form.get('releaseDate') ?? '') || null, ...(linked && { linkedGameId: linked.id, owned: linked.owned }) }),
      });
      if (!response.ok) { setMessage('Não foi possível adicionar a DLC.'); return; }
      await load();
      setAdding(false);
    } finally { setBusy(false); }
  }

  const linkableGames = games.filter((game) => game.id !== gameId);
  function findGameByLabel(label: string): Game | undefined {
    const wanted = label.trim();
    return wanted ? linkableGames.find((game) => gameOptionLabel(game) === wanted) ?? linkableGames.find((game) => game.title === wanted) : undefined;
  }

  async function linkGame(dlc: Dlc, label: string) {
    const target = findGameByLabel(label);
    if (!target) { setMessage('Escolha um jogo da lista para vincular.'); return; }
    setMessage('');
    await patch(dlc, { linkedGameId: target.id });
    setLinking(null);
  }

  async function patch(dlc: Dlc, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs/${dlc.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) await load(); else setMessage('Não foi possível salvar a alteração.');
    } finally { setBusy(false); }
  }

  async function removeDlc(dlc: Dlc) {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs/${dlc.id}`, { method: 'DELETE' });
      if (response.ok) await load(); else setMessage('Não foi possível excluir a DLC.');
    } finally { setBusy(false); }
  }

  async function searchRawg(dlc: Dlc) {
    setCandidates((current) => ({ ...current, [dlc.id]: 'loading' }));
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs/${dlc.id}/rawg-candidates`);
      if (!response.ok) throw new Error('falhou');
      const body = await response.json() as RawgAchievementCandidate[];
      setCandidates((current) => ({ ...current, [dlc.id]: body }));
    } catch { setCandidates((current) => ({ ...current, [dlc.id]: 'failed' })); }
  }

  async function linkRawg(dlc: Dlc, candidate: RawgAchievementCandidate) {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs/${dlc.id}/rawg-link`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(candidate) });
      if (response.ok) await load(); else setMessage('Não foi possível vincular essa referência.');
    } finally {
      setBusy(false);
      setCandidates((current) => { const next = { ...current }; delete next[dlc.id]; return next; });
    }
  }

  async function toggleAchievements(dlc: Dlc) {
    if (achievements[dlc.id]) { setAchievements((current) => { const next = { ...current }; delete next[dlc.id]; return next; }); return; }
    setAchievements((current) => ({ ...current, [dlc.id]: 'loading' }));
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs/${dlc.id}/achievements`);
      if (!response.ok) throw new Error('falhou');
      const body = await response.json() as RawgAchievement[];
      setAchievements((current) => ({ ...current, [dlc.id]: body }));
    } catch { setAchievements((current) => ({ ...current, [dlc.id]: 'failed' })); }
  }

  if (dlcs === null) return <p className="session-empty">Carregando DLCs…</p>;

  const linkedGame = (dlc: Dlc) => dlc.linkedGameId ? games.find((game) => game.id === dlc.linkedGameId) : undefined;

  return <div className="dlc-panel">
    <datalist id="dlc-link-games">{linkableGames.map((game) => <option key={game.id} value={gameOptionLabel(game)} />)}</datalist>
    {dlcs.length === 0 && !adding && <p className="session-empty">Nenhuma DLC cadastrada para este jogo.</p>}
    <ul className="dlc-list">{dlcs.map((dlc) => {
      const game = linkedGame(dlc);
      const cover = game?.coverUrl ?? dlc.coverUrl;
      const status = game ? linkedStatusLabel(game.status) : statusLabels[dlc.status];
      const played = game ? (usage.get(game.id)?.playedHours ?? 0) : dlc.playedHours;
      const estimated = dlc.estimatedHours ?? game?.estimatedMainHours ?? null;
      const progress = estimated && played > 0 ? Math.min(100, Math.round((played / estimated) * 100)) : null;
      const achievementCount = game ? usage.get(game.id) : undefined;
      return <li key={dlc.id} className="dlc-item dlc-card">
        <div className="dlc-card-cover">{cover ? <img src={cover} alt={`Capa de ${dlc.name}`} loading="lazy" /> : <span aria-hidden="true">▧</span>}</div>
        <div className="dlc-card-body">
          <div className="dlc-card-head">
            <div>
              <strong>{dlc.name}</strong>
              <div className="dlc-card-meta">
                <span className={`status-pill status-${(game?.status ?? (dlc.status === 'COMPLETED' ? 'completed' : dlc.status === 'PLAYING' ? 'playing' : 'backlog')).toLowerCase()}`} style={{ position: 'static' }}>{status}</span>
                {dlc.releaseDate && <span>{formatDate(dlc.releaseDate)}</span>}
                {played > 0 && <span>⏱ {formatHoursMinutes(played)}{estimated ? ` de ${formatHoursMinutes(estimated)}` : ''}</span>}
                {achievementCount && achievementCount.achievementsTotal > 0 && <span>🏆 {achievementCount.achievementsUnlocked}/{achievementCount.achievementsTotal}</span>}
              </div>
            </div>
            {!game && <label className="form-field checkbox-field dlc-owned"><span>Possuo</span><Switch checked={dlc.owned} onChange={(event) => void patch(dlc, { owned: event.target.checked })} /></label>}
          </div>
          {progress !== null && <div className="estimate-progress" title={`${progress}% da estimativa`}><div className="estimate-progress-fill" style={{ width: `${progress}%` }} /><span>{progress}%</span></div>}
          {game
            ? <p className="session-empty dlc-linked">Vinculada ao jogo cadastrado <strong>{game.title}</strong>: status e horas vêm dele.</p>
            : dlc.linkedGameId && <p className="session-empty dlc-linked">O jogo vinculado não existe mais.</p>}
          {!dlc.linkedGameId && <div className="dlc-item-controls">
            <select aria-label={`Status de ${dlc.name}`} value={dlc.status} disabled={busy} onChange={(event) => void patch(dlc, { status: event.target.value })}>
              {(Object.keys(statusLabels) as Array<Dlc['status']>).map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
            </select>
            <label>Estimativa (h)<input type="number" min="0" step="0.25" defaultValue={dlc.estimatedHours ?? ''} onBlur={(event) => { const value = event.target.value; void patch(dlc, { estimatedHours: value === '' ? null : Number(value) }); }} /></label>
            <label>Jogadas (h)<input type="number" min="0" step="0.25" defaultValue={dlc.playedHours} onBlur={(event) => void patch(dlc, { playedHours: Number(event.target.value) || 0 })} /></label>
          </div>}
          {linking === dlc.id && <form className="dlc-link-form" onSubmit={(event) => { event.preventDefault(); void linkGame(dlc, String(new FormData(event.currentTarget).get('linkedGame') ?? '')); }}>
            <label className="form-field">Jogo cadastrado<input name="linkedGame" list="dlc-link-games" autoFocus placeholder="Digite o título do jogo" /></label>
            <div className="session-actions"><Button type="submit" disabled={busy}>Vincular</Button><button type="button" className="cancel-button" onClick={() => setLinking(null)}>Cancelar</button></div>
          </form>}
          <div className="dlc-card-actions">
            {game && onOpenGame && <button type="button" className="session-edit" onClick={() => onOpenGame(game.id)}>Abrir jogo</button>}
            {dlc.linkedGameId
              ? <button type="button" className="session-edit" disabled={busy} onClick={() => void patch(dlc, { linkedGameId: null })}>Desvincular jogo</button>
              : games.length > 0 && <button type="button" className="session-edit" onClick={() => { setLinking(dlc.id); setMessage(''); }}>Vincular a jogo cadastrado</button>}
            {dlc.rawgId
              ? <button type="button" className="session-edit" onClick={() => void toggleAchievements(dlc)}>{achievements[dlc.id] ? 'Ocultar conquistas' : 'Ver conquistas'}</button>
              : <button type="button" className="session-edit" onClick={() => void searchRawg(dlc)}>Vincular catálogo RAWG</button>}
            <button type="button" className="session-delete" disabled={busy} onClick={() => void removeDlc(dlc)}>Excluir</button>
          </div>
          {candidates[dlc.id] === 'loading' && <p className="session-empty">Buscando na RAWG…</p>}
          {candidates[dlc.id] === 'failed' && <p role="alert" className="session-feedback">Não foi possível buscar na RAWG.</p>}
          {Array.isArray(candidates[dlc.id]) && <ul className="session-list">{(candidates[dlc.id] as RawgAchievementCandidate[]).map((candidate) => <li key={candidate.id}><div><strong>{candidate.name}</strong><span>{candidate.released?.slice(0, 4) ?? 'Ano não informado'}</span></div><button type="button" className="session-edit" onClick={() => void linkRawg(dlc, candidate)}>Usar esta referência</button></li>)}</ul>}
          {achievements[dlc.id] === 'loading' && <p className="session-empty">Carregando conquistas…</p>}
          {achievements[dlc.id] === 'failed' && <p role="alert" className="session-feedback">Não foi possível carregar as conquistas.</p>}
          {Array.isArray(achievements[dlc.id]) && (achievements[dlc.id] as RawgAchievement[]).length > 0 && <ul className="achievement-list">{(achievements[dlc.id] as RawgAchievement[]).map((achievement) => <li key={achievement.id}><span className="achievement-icon" aria-hidden="true">○</span><div className="achievement-body"><strong>{achievement.name}</strong>{achievement.description && <p>{achievement.description}</p>}</div>{achievement.percent !== null && <span className="achievement-rarity">{achievement.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>}</li>)}</ul>}
        </div>
      </li>;
    })}</ul>

    {adding ? <form className="session-form" onSubmit={(event) => void createDlc(event)}>
      <label className="form-field">Nome<input name="name" maxLength={200} autoFocus /></label>
      <label className="form-field">Lançamento<input name="releaseDate" type="date" /></label>
      {games.length > 0 && <label className="form-field form-wide">Jogo cadastrado (opcional)<input name="linkedGame" list="dlc-link-games" placeholder="Se esta DLC já está na biblioteca como jogo, escolha-o" /></label>}
      <div className="form-wide session-actions"><Button type="submit" disabled={busy}>Adicionar DLC</Button><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancelar</button></div>
    </form> : <Button type="button" onClick={() => { setAdding(true); setMessage(''); }}>Adicionar DLC</Button>}
    {message && <p role="alert" className="session-feedback">{message}</p>}
  </div>;
}
