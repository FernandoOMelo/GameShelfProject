import { useEffect, useState, type FormEvent } from 'react';
import type { GameListSummary, Mission, MissionInput } from '@gameshelf/contracts';
import { Button, Panel } from '@gameshelf/ui';
import { apiUrl, formatCompactHours } from './shared';

const kindLabels: Record<Mission['kind'], string> = {
  LIST: 'Zerar uma lista de jogos',
  GAMES_COUNT: 'Zerar uma quantidade de jogos',
  HOURS: 'Jogar uma quantidade de horas',
  CUSTOM: 'Texto livre',
};

const formatDue = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

function detail(mission: Mission): string {
  const percent = String(mission.percent).replace('.', ',');
  if (mission.kind === 'LIST') return `${mission.current} / ${mission.target} zerados (${percent}%) · lista ${mission.listName ?? 'removida'}`;
  if (mission.kind === 'GAMES_COUNT') return `${mission.current} / ${mission.target} jogos zerados (${percent}%)`;
  if (mission.kind === 'HOURS') return `${formatCompactHours(mission.current)} de ${mission.target} h (${percent}%)`;
  return mission.done ? 'Concluída' : 'Em aberto';
}

/** Missões: mais de uma ativa, uma delas principal (ADR-040). */
export function MissionsCard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [lists, setLists] = useState<GameListSummary[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Mission['kind']>('LIST');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [missionsResponse, listsResponse] = await Promise.all([fetch(`${apiUrl}/missions`), fetch(`${apiUrl}/lists`)]);
      const body = missionsResponse.ok ? await missionsResponse.json() as Mission[] : [];
      setMissions(Array.isArray(body) ? body : []);
      const items = listsResponse.ok ? await listsResponse.json() as GameListSummary[] : [];
      setLists(Array.isArray(items) ? items : []);
    } catch { setMissions([]); }
  }
  useEffect(() => { void load(); }, []);

  async function send(url: string, method: string, body?: unknown, failure = 'Não foi possível salvar a missão.') {
    const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
    if (!response.ok) { setMessage(failure); return false; }
    setMessage('');
    await load();
    return true;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const payload: MissionInput = {
      title: text('title'), kind,
      ...(text('description') && { description: text('description') }),
      ...(kind === 'LIST' && { listId: text('listId') }),
      ...((kind === 'GAMES_COUNT' || kind === 'HOURS') && { target: Number(text('target')) }),
      ...(text('startsOn') && { startsOn: text('startsOn') }),
      ...(text('dueDate') && { dueDate: text('dueDate') }),
    };
    if (await send(`${apiUrl}/missions`, 'POST', payload)) setAdding(false);
  }

  const primary = missions.find((mission) => mission.isPrimary);

  return <Panel className="challenge-card" title="Missões" titleId="challenge-title" actions={!adding ? <button type="button" className="session-edit" onClick={() => setAdding(true)}>Nova missão</button> : undefined}>
    {adding && <form className="challenge-form" onSubmit={(event) => void create(event)}>
      <label className="form-field">Tipo<select aria-label="Tipo da missão" value={kind} onChange={(event) => setKind(event.target.value as Mission['kind'])}>{(Object.keys(kindLabels) as Array<Mission['kind']>).map((option) => <option key={option} value={option}>{kindLabels[option]}</option>)}</select></label>
      <label className="form-field">Objetivo<input aria-label="Objetivo da missão" name="title" required maxLength={200} placeholder="Ex.: Zerar todos os clássicos do SNES" /></label>
      {kind === 'LIST' && <label className="form-field">Lista acompanhada<select aria-label="Lista da missão" name="listId" required defaultValue=""><option value="">Selecione uma lista</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.gameCount})</option>)}</select></label>}
      {(kind === 'GAMES_COUNT' || kind === 'HOURS') && <label className="form-field">{kind === 'HOURS' ? 'Alvo (horas)' : 'Alvo (jogos)'}<input aria-label="Alvo da missão" name="target" type="number" min="1" max="100000" required /></label>}
      <label className="form-field">Descrição (opcional)<input name="description" maxLength={2000} /></label>
      <label className="form-field">Início<input aria-label="Início da missão" name="startsOn" type="date" /></label>
      <label className="form-field">Prazo (opcional)<input aria-label="Prazo da missão" name="dueDate" type="date" /></label>
      <div className="challenge-actions"><Button type="submit">Salvar missão</Button><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancelar</button></div>
      {kind === 'LIST' && lists.length === 0 && <small>Crie uma lista na aba Listas para acompanhá-la como missão.</small>}
    </form>}
    {missions.length === 0 && !adding && <p className="dashboard-empty">Defina objetivos de médio prazo: zerar uma lista, uma quantidade de jogos, horas jogadas ou um texto livre.</p>}
    {primary && <div className="challenge-primary">
      <p className="eyebrow">MISSÃO PRINCIPAL</p>
      <p className="challenge-title">{primary.title}</p>
      <p className="panel-figure">{detail(primary)}</p>
      <div className="progress-track progress-track-large" role="img" aria-label={`Missão ${primary.percent}% completa`}><span style={{ width: `${primary.percent}%` }} /></div>
    </div>}
    {missions.filter((mission) => !mission.isPrimary).length > 0 && <ul className="goal-list">{missions.filter((mission) => !mission.isPrimary).map((mission) => <li key={mission.id}>
      <div className="goal-heading"><strong>{mission.title}</strong></div>
      <div className="progress-track" role="img" aria-label={`${mission.title}: ${mission.percent}% completa`}><span style={{ width: `${mission.percent}%` }} /></div>
      <small>{detail(mission)}{mission.dueDate ? ` · até ${formatDue(mission.dueDate)}` : ''}</small>
    </li>)}</ul>}
    {missions.length > 0 && <details className="mission-manage"><summary>Gerenciar missões</summary>
      <ul className="goal-list">{missions.map((mission) => <li key={mission.id}>
        <div className="goal-heading"><strong>{mission.title}{mission.isPrimary ? ' · principal' : ''}</strong><span>
          {!mission.isPrimary && <button type="button" className="session-edit" onClick={() => void send(`${apiUrl}/missions/${mission.id}`, 'PATCH', { isPrimary: true })}>Tornar principal</button>}
          {mission.kind === 'CUSTOM' && <button type="button" className="session-edit" onClick={() => void send(`${apiUrl}/missions/${mission.id}`, 'PATCH', { done: !mission.done })}>{mission.done ? 'Reabrir' : 'Marcar como concluída'}</button>}
          <button type="button" className="session-delete" aria-label={`Excluir missão: ${mission.title}`} onClick={() => void send(`${apiUrl}/missions/${mission.id}`, 'DELETE', undefined, 'Não foi possível remover a missão.')}>Excluir</button>
        </span></div>
      </li>)}</ul>
    </details>}
    {message && <p role="alert">{message}</p>}
  </Panel>;
}
