import { useEffect, useState, type FormEvent } from 'react';
import type { Dlc, RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';
import { Button, Switch } from '@gameshelf/ui';
import { apiUrl, formatHoursMinutes } from './shared';

const statusLabels: Record<Dlc['status'], string> = { NOT_STARTED: 'Não iniciada', PLAYING: 'Jogando', COMPLETED: 'Concluída' };

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

export function DlcPanel({ gameId }: { gameId: string }) {
  const [dlcs, setDlcs] = useState<Dlc[] | null>(null);
  const [adding, setAdding] = useState(false);
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
    const name = String(form.get('name') ?? '').trim();
    if (!name) { setMessage('Informe o nome da DLC.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/dlcs`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, releaseDate: String(form.get('releaseDate') ?? '') || null }),
      });
      if (!response.ok) { setMessage('Não foi possível adicionar a DLC.'); return; }
      await load();
      setAdding(false);
    } finally { setBusy(false); }
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

  return <div className="dlc-panel">
    {dlcs.length === 0 && !adding && <p className="session-empty">Nenhuma DLC cadastrada para este jogo.</p>}
    <ul className="dlc-list">{dlcs.map((dlc) => <li key={dlc.id} className="dlc-item">
      <div className="dlc-item-head">
        <div>
          <strong>{dlc.name}</strong>
          <span>{[dlc.releaseDate ? formatDate(dlc.releaseDate) : null, statusLabels[dlc.status]].filter(Boolean).join(' · ')}</span>
        </div>
        <label className="form-field checkbox-field dlc-owned"><span>Possuo</span><Switch checked={dlc.owned} onChange={(event) => void patch(dlc, { owned: event.target.checked })} /></label>
      </div>
      <div className="dlc-item-controls">
        <select aria-label={`Status de ${dlc.name}`} value={dlc.status} disabled={busy} onChange={(event) => void patch(dlc, { status: event.target.value })}>
          {(Object.keys(statusLabels) as Array<Dlc['status']>).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        <label>Estimativa (h)<input type="number" min="0" step="0.25" defaultValue={dlc.estimatedHours ?? ''} onBlur={(event) => { const value = event.target.value; void patch(dlc, { estimatedHours: value === '' ? null : Number(value) }); }} /></label>
        <label>Jogadas (h)<input type="number" min="0" step="0.25" defaultValue={dlc.playedHours} onBlur={(event) => void patch(dlc, { playedHours: Number(event.target.value) || 0 })} /></label>
      </div>
      <div className="session-item-actions">
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
      {Array.isArray(achievements[dlc.id]) && (achievements[dlc.id] as RawgAchievement[]).length === 0
        ? null
        : Array.isArray(achievements[dlc.id]) && <ul className="achievement-list">{(achievements[dlc.id] as RawgAchievement[]).map((achievement) => <li key={achievement.id}><span className="achievement-icon" aria-hidden="true">○</span><div className="achievement-body"><strong>{achievement.name}</strong>{achievement.description && <p>{achievement.description}</p>}</div>{achievement.percent !== null && <span className="achievement-rarity">{achievement.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>}</li>)}</ul>}
      {dlc.estimatedHours != null && dlc.playedHours > 0 && <p className="session-empty">{formatHoursMinutes(dlc.playedHours)} jogadas de {formatHoursMinutes(dlc.estimatedHours)} estimadas.</p>}
    </li>)}</ul>

    {adding ? <form className="session-form" onSubmit={(event) => void createDlc(event)}>
      <label className="form-field">Nome<input name="name" required maxLength={200} autoFocus /></label>
      <label className="form-field">Lançamento<input name="releaseDate" type="date" /></label>
      <div className="form-wide session-actions"><Button type="submit" disabled={busy}>Adicionar DLC</Button><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancelar</button></div>
    </form> : <Button type="button" onClick={() => { setAdding(true); setMessage(''); }}>Adicionar DLC</Button>}
    {message && <p role="alert" className="session-feedback">{message}</p>}
  </div>;
}
