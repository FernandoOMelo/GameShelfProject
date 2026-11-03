import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { GameListSummary, GoalInput, GoalProgress } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl, formatCompactHours } from './shared';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const kindLabels: Record<GoalInput['kind'], string> = {
  COMPLETED_GAMES: 'Jogos zerados',
  PLAYED_HOURS: 'Horas jogadas',
  COMPLETE_LIST: 'Zerar uma lista de jogos',
  SESSION_HOURS: 'Horas seguidas em uma sessão',
  CUSTOM: 'Texto livre',
};

const formatDue = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
const hasPeriod = (kind: GoalInput['kind']) => kind === 'COMPLETED_GAMES' || kind === 'PLAYED_HOURS';

function label(goal: GoalProgress): string {
  if (goal.kind === 'COMPLETE_LIST') return goal.title || `Zerar a lista ${goal.listName ?? 'removida'}`;
  if (goal.kind === 'SESSION_HOURS') return goal.title || `Jogar ${goal.target} h seguidas`;
  if (goal.kind === 'CUSTOM') return goal.title ?? 'Meta';
  const what = goal.kind === 'COMPLETED_GAMES' ? `Zerar ${goal.target} ${goal.target === 1 ? 'jogo' : 'jogos'}` : `Jogar ${goal.target} h`;
  return `${what} · ${goal.period === 'YEAR' ? goal.year : `${MONTHS[goal.month! - 1]} de ${goal.year}`}`;
}

function progressText(goal: GoalProgress): string {
  const percent = String(goal.percent).replace('.', ',');
  const detail = goal.kind === 'PLAYED_HOURS' ? `${formatCompactHours(goal.current)} de ${goal.target} h`
    : goal.kind === 'SESSION_HOURS' ? `melhor sessão: ${formatCompactHours(goal.current)} de ${goal.target} h`
      : goal.kind === 'CUSTOM' ? (goal.done ? 'concluída' : 'em aberto')
        : `${goal.current} de ${goal.target}`;
  const state = goal.achieved ? 'meta atingida' : goal.onTrack ? 'no ritmo' : goal.elapsedPercent >= 100 ? 'prazo encerrado' : 'abaixo do ritmo';
  return `${detail}${goal.kind === 'CUSTOM' ? '' : ` (${percent}%)`} · ${state}${goal.dueDate ? ` · até ${formatDue(goal.dueDate)}` : ''}`;
}

export function GoalsCard() {
  const now = new Date();
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [lists, setLists] = useState<GameListSummary[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<GoalInput['kind']>('COMPLETED_GAMES');
  const [period, setPeriod] = useState<NonNullable<GoalInput['period']>>('YEAR');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/goals?timezoneOffsetMinutes=${new Date().getTimezoneOffset()}`);
      const body = response.ok ? await response.json() as GoalProgress[] : [];
      setGoals(Array.isArray(body) ? body : []);
    } catch { setGoals([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch(`${apiUrl}/lists`).then((response) => response.ok ? response.json() as Promise<GameListSummary[]> : []).then((items) => setLists(Array.isArray(items) ? items : [])).catch(() => setLists([]));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: GoalInput = hasPeriod(kind)
      ? { kind, period, year: Number(year), target: Number(target), ...(period === 'MONTH' && { month: Number(month) }) }
      : {
        kind,
        ...(title.trim() && { title: title.trim() }),
        ...(kind === 'COMPLETE_LIST' && { listId }),
        ...(kind === 'SESSION_HOURS' && { target: Number(target) }),
        ...(dueDate && { dueDate }),
      };
    const response = await fetch(`${apiUrl}/goals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (response.status === 409) { setMessage('Você já tem uma meta deste tipo para esse período.'); return; }
    if (!response.ok) { setMessage('Não foi possível salvar a meta.'); return; }
    setMessage('');
    setAdding(false);
    setTarget(''); setTitle(''); setDueDate('');
    await load();
  }

  async function remove(goal: GoalProgress) {
    const response = await fetch(`${apiUrl}/goals/${goal.id}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível excluir a meta.'); return; }
    setMessage('');
    await load();
  }

  async function toggleDone(goal: GoalProgress) {
    const response = await fetch(`${apiUrl}/goals/${goal.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ done: !goal.done }) });
    if (!response.ok) { setMessage('Não foi possível atualizar a meta.'); return; }
    await load();
  }

  const canSave = hasPeriod(kind) ? Boolean(target) : kind === 'COMPLETE_LIST' ? Boolean(listId) : kind === 'SESSION_HOURS' ? Boolean(target) : Boolean(title.trim());

  return <section className="panel goals-card" aria-labelledby="goals-title">
    <div className="section-heading"><h2 id="goals-title">Metas</h2>{!adding && <button type="button" className="session-edit" onClick={() => setAdding(true)}>Nova meta</button>}</div>
    {adding && <form className="goal-form" onSubmit={(event) => void save(event)}>
      <label className="form-field">Tipo<select aria-label="Tipo da meta" value={kind} onChange={(event) => setKind(event.target.value as GoalInput['kind'])}>{(Object.keys(kindLabels) as Array<GoalInput['kind']>).map((option) => <option key={option} value={option}>{kindLabels[option]}</option>)}</select></label>
      {hasPeriod(kind) && <>
        <label className="form-field">Período<select aria-label="Período da meta" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option value="YEAR">Ano</option><option value="MONTH">Mês</option></select></label>
        <label className="form-field">Ano<input aria-label="Ano da meta" type="number" min="2000" max="2100" required value={year} onChange={(event) => setYear(event.target.value)} /></label>
        {period === 'MONTH' && <label className="form-field">Mês<select aria-label="Mês da meta" value={month} onChange={(event) => setMonth(event.target.value)}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>}
      </>}
      {kind === 'COMPLETE_LIST' && <label className="form-field">Lista<select aria-label="Lista da meta" required value={listId} onChange={(event) => setListId(event.target.value)}><option value="">Selecione uma lista</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.gameCount})</option>)}</select></label>}
      {(hasPeriod(kind) || kind === 'SESSION_HOURS') && <label className="form-field">{kind === 'COMPLETED_GAMES' ? 'Alvo (jogos)' : 'Alvo (horas)'}<input aria-label="Alvo da meta" type="number" min="1" max="100000" required value={target} onChange={(event) => setTarget(event.target.value)} /></label>}
      {!hasPeriod(kind) && <label className="form-field">{kind === 'CUSTOM' ? 'Texto da meta' : 'Descrição (opcional)'}<input aria-label="Texto da meta" maxLength={200} required={kind === 'CUSTOM'} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'CUSTOM' ? 'Ex.: Platinar um jogo de terror' : ''} /></label>}
      {!hasPeriod(kind) && <label className="form-field">Data limite (opcional)<input aria-label="Data limite da meta" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>}
      <div className="challenge-actions"><Button type="submit" disabled={!canSave}>Criar meta</Button><button type="button" className="cancel-button" onClick={() => { setAdding(false); setMessage(''); }}>Cancelar</button></div>
    </form>}
    {goals.length ? <ul className="goal-list">{goals.map((goal) => <li key={goal.id}>
      <div className="goal-heading"><strong>{label(goal)}</strong><span>{goal.kind === 'CUSTOM' && <button type="button" className="session-edit" onClick={() => void toggleDone(goal)}>{goal.done ? 'Reabrir' : 'Marcar como concluída'}</button>}<button type="button" className="session-delete" aria-label={`Excluir meta: ${label(goal)}`} onClick={() => void remove(goal)}>Excluir</button></span></div>
      <div className="progress-track progress-track-large" role="img" aria-label={`${label(goal)}: ${goal.percent}% concluída`}><span style={{ width: `${goal.percent}%` }} /></div>
      <small>{progressText(goal)}</small>
    </li>)}</ul> : !adding && <p className="dashboard-empty">Defina metas anuais ou mensais de jogos zerados ou horas jogadas, ou ainda zerar uma lista, jogar horas seguidas ou um texto livre.</p>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
