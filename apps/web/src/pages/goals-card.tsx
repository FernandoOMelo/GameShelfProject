import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { GoalInput, GoalProgress } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl, formatCompactHours } from './shared';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function label(goal: GoalProgress): string {
  const what = goal.kind === 'COMPLETED_GAMES' ? `Zerar ${goal.target} ${goal.target === 1 ? 'jogo' : 'jogos'}` : `Jogar ${goal.target} h`;
  return `${what} · ${goal.period === 'YEAR' ? goal.year : `${MONTHS[goal.month! - 1]} de ${goal.year}`}`;
}

export function GoalsCard() {
  const now = new Date();
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<GoalInput['kind']>('COMPLETED_GAMES');
  const [period, setPeriod] = useState<GoalInput['period']>('YEAR');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/goals?timezoneOffsetMinutes=${new Date().getTimezoneOffset()}`);
      const body = response.ok ? await response.json() as GoalProgress[] : [];
      setGoals(Array.isArray(body) ? body : []);
    } catch { setGoals([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: GoalInput = { kind, period, year: Number(year), target: Number(target), ...(period === 'MONTH' && { month: Number(month) }) };
    const response = await fetch(`${apiUrl}/goals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (response.status === 409) { setMessage('Você já tem uma meta deste tipo para esse período.'); return; }
    if (!response.ok) { setMessage('Não foi possível salvar a meta.'); return; }
    setMessage('');
    setAdding(false);
    setTarget('');
    await load();
  }

  async function remove(goal: GoalProgress) {
    const response = await fetch(`${apiUrl}/goals/${goal.id}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível excluir a meta.'); return; }
    setMessage('');
    await load();
  }

  return <section className="panel goals-card" aria-labelledby="goals-title">
    <div className="section-heading"><h2 id="goals-title">Metas</h2>{!adding && <button type="button" className="session-edit" onClick={() => setAdding(true)}>Nova meta</button>}</div>
    {adding && <form className="goal-form" onSubmit={(event) => void save(event)}>
      <label className="form-field">Tipo<select aria-label="Tipo da meta" value={kind} onChange={(event) => setKind(event.target.value as GoalInput['kind'])}><option value="COMPLETED_GAMES">Jogos zerados</option><option value="PLAYED_HOURS">Horas jogadas</option></select></label>
      <label className="form-field">Período<select aria-label="Período da meta" value={period} onChange={(event) => setPeriod(event.target.value as GoalInput['period'])}><option value="YEAR">Ano</option><option value="MONTH">Mês</option></select></label>
      <label className="form-field">Ano<input aria-label="Ano da meta" type="number" min="2000" max="2100" required value={year} onChange={(event) => setYear(event.target.value)} /></label>
      {period === 'MONTH' && <label className="form-field">Mês<select aria-label="Mês da meta" value={month} onChange={(event) => setMonth(event.target.value)}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>}
      <label className="form-field">Alvo<input aria-label="Alvo da meta" type="number" min="1" max="100000" required value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <div className="challenge-actions"><Button type="submit">Criar meta</Button><button type="button" className="cancel-button" onClick={() => { setAdding(false); setMessage(''); }}>Cancelar</button></div>
    </form>}
    {goals.length ? <ul className="goal-list">{goals.map((goal) => <li key={goal.id}>
      <div className="goal-heading"><strong>{label(goal)}</strong><button type="button" className="session-delete" aria-label={`Excluir meta: ${label(goal)}`} onClick={() => void remove(goal)}>Excluir</button></div>
      <div className="progress-track progress-track-large" role="img" aria-label={`${label(goal)}: ${goal.percent}% concluída`}><span style={{ width: `${goal.percent}%` }} /></div>
      <small>{goal.kind === 'COMPLETED_GAMES' ? `${goal.current} de ${goal.target}` : `${formatCompactHours(goal.current)} de ${goal.target} h`} ({String(goal.percent).replace('.', ',')}%) · {goal.achieved ? 'meta atingida' : goal.onTrack ? 'no ritmo' : goal.elapsedPercent >= 100 ? 'período encerrado' : 'abaixo do ritmo'}</small>
    </li>)}</ul> : !adding && <p className="dashboard-empty">Defina metas anuais ou mensais de jogos zerados ou horas jogadas.</p>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
