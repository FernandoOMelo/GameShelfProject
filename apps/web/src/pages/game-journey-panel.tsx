import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { GamePlatform, GamePlatformFormat, Platform, Playthrough, PlaythroughMetrics, PlaythroughStatus } from '@gameshelf/contracts';
import { Button, ConfirmDialog, Switch } from '@gameshelf/ui';
import { PlatformLogo, platformStyle } from './platform-icons';
import { apiUrl, formatCompactHours } from './shared';

const statusLabels: Record<PlaythroughStatus, string> = {
  PLANNED: 'Planejada', PLAYING: 'Em andamento', PAUSED: 'Pausada', COMPLETED: 'Concluída', ABANDONED: 'Abandonada',
};

const formatLabels: Record<GamePlatformFormat, string> = {
  PHYSICAL: 'Físico', DIGITAL: 'Digital', SUBSCRIPTION: 'Assinatura', CLOUD: 'Nuvem',
};

// Transições oferecidas pela interface, espelhando as regras da API (ADR-023).
const transitions: Record<PlaythroughStatus, Array<{ status: PlaythroughStatus; label: string; needsDate?: boolean }>> = {
  PLANNED: [{ status: 'PLAYING', label: 'Iniciar jornada' }],
  PLAYING: [{ status: 'PAUSED', label: 'Pausar' }, { status: 'COMPLETED', label: 'Concluir', needsDate: true }, { status: 'ABANDONED', label: 'Abandonar' }],
  PAUSED: [{ status: 'PLAYING', label: 'Retomar' }, { status: 'COMPLETED', label: 'Concluir', needsDate: true }, { status: 'ABANDONED', label: 'Abandonar' }],
  COMPLETED: [{ status: 'PLAYING', label: 'Reabrir' }],
  ABANDONED: [{ status: 'PLAYING', label: 'Retomar' }],
};

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatDateOnly = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

/** Data local (YYYY-MM-DD) de um instante ISO. */
const localDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type Props = {
  gameId: string;
  /** Datas do jogo, para sugerir início e fim só quando estiverem vazios. */
  gameDates?: { status: string; startedAt: string | null; completedAt: string | null };
  /** Grava uma data sugerida no jogo; só roda quando o usuário clica. */
  onApplyDate?: (field: 'startedAt' | 'completedAt', value: string) => void | Promise<void>;
  /** Horas retroativas já lançadas no jogo, para mostrar o efeito do lançamento. */
  retroactiveHours?: number;
  /** Sessões encerradas sem plataforma informada: não dá para descontá-las. */
  sessionsWithoutPlatform?: number;
  /** Avisa o pai quando o jogo muda por causa de um lançamento de tempo externo. */
  onGameChanged?: () => void;
  platforms: Platform[];
  /** Minutos registrados localmente em sessões, para contrastar com o tempo externo. */
  localMinutes: number;
  /** Avisa o pai quando as jornadas mudam, para recarregar a lista de sessões. */
  onPlaythroughsChanged?: () => void;
};

/**
 * Plataformas associadas e jornadas de um jogo. Tempo registrado localmente e
 * tempo informado pela plataforma aparecem separados, e nunca somados: são
 * medidas diferentes da mesma biblioteca.
 */
export function GameJourneyPanel({ gameId, gameDates, onApplyDate, platforms, localMinutes, retroactiveHours = 0, sessionsWithoutPlatform = 0, onPlaythroughsChanged, onGameChanged }: Props) {
  const [links, setLinks] = useState<GamePlatform[] | null>(null);
  const [playthroughs, setPlaythroughs] = useState<Playthrough[] | null>(null);
  const [metrics, setMetrics] = useState<PlaythroughMetrics | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [addingPlaythrough, setAddingPlaythrough] = useState(false);

  const platformName = (id: string | null) => platforms.find((platform) => platform.id === id)?.name ?? 'Plataforma removida';

  const load = useCallback(async () => {
    try {
      const [platformResponse, playthroughResponse, metricsResponse] = await Promise.all([
        fetch(`${apiUrl}/games/${gameId}/platforms`),
        fetch(`${apiUrl}/games/${gameId}/playthroughs`),
        fetch(`${apiUrl}/games/${gameId}/playthroughs/metrics`),
      ]);
      if (!platformResponse.ok || !playthroughResponse.ok || !metricsResponse.ok) throw new Error('invalid');
      setLinks(await platformResponse.json() as GamePlatform[]);
      setPlaythroughs(await playthroughResponse.json() as Playthrough[]);
      setMetrics(await metricsResponse.json() as PlaythroughMetrics);
    } catch {
      setLinks([]);
      setPlaythroughs([]);
      setMessage('Não foi possível carregar plataformas e jornadas.');
    }
  }, [gameId]);

  useEffect(() => { void load(); }, [load]);

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(url, {
        method,
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(error?.error ?? 'Não foi possível salvar.');
        return false;
      }
      await load();
      return true;
    } catch {
      setMessage('Não foi possível salvar.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // O tempo informado pela plataforma vira horas retroativas do jogo por ação
  // explícita, nunca pela sincronização, e só a parte ainda não lançada entra.
  async function importPlaytime(link: GamePlatform) {
    if (await send(`${apiUrl}/games/${gameId}/platforms/${link.id}/import-playtime`, 'POST')) onGameChanged?.();
  }

  async function addPlatform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const platformId = String(form.get('platformId') ?? '');
    if (!platformId) { setMessage('Selecione uma plataforma.'); return; }
    const edition = String(form.get('edition') ?? '').trim();
    const format = String(form.get('format') ?? '');
    const ok = await send(`${apiUrl}/games/${gameId}/platforms`, 'POST', {
      platformId,
      edition: edition || null,
      format: format || null,
      owned: form.get('owned') === 'on',
      isPrimary: form.get('isPrimary') === 'on',
    });
    if (ok) setAddingPlatform(false);
  }

  async function addPlaythrough(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startedAt = String(form.get('startedAt') ?? '').trim();
    const label = String(form.get('label') ?? '').trim();
    const primaryPlatformId = String(form.get('primaryPlatformId') ?? '');
    const completedAt = String(form.get('completedAt') ?? '').trim();
    if (completedAt && startedAt && completedAt < startedAt) { setMessage('A data de encerramento não pode ser anterior ao início.'); return; }
    const endStatus = String(form.get('endStatus') ?? 'COMPLETED') as PlaythroughStatus;
    // Com data de encerramento a jornada nasce já finalizada (lançamento retroativo).
    // Uma jornada só é criada como "em andamento" quando tem data de início;
    // sem data ela fica planejada e não conta como iniciada.
    const ok = await send(`${apiUrl}/games/${gameId}/playthroughs`, 'POST', {
      label: label || null,
      status: completedAt ? endStatus : startedAt ? 'PLAYING' : 'PLANNED',
      startedAt: startedAt || null,
      ...(completedAt ? { completedAt } : {}),
      primaryPlatformId: primaryPlatformId || null,
    });
    if (ok) { setAddingPlaythrough(false); onPlaythroughsChanged?.(); }
  }

  async function changeStatus(playthrough: Playthrough, status: PlaythroughStatus, needsDate?: boolean) {
    const payload: Record<string, unknown> = { status };
    if (needsDate) payload.completedAt = playthrough.completedAt ?? todayLocal();
    // Iniciar uma jornada planejada registra a data de hoje como início.
    if (status === 'PLAYING' && playthrough.status === 'PLANNED' && !playthrough.startedAt) payload.startedAt = todayLocal();
    if (await send(`${apiUrl}/games/${gameId}/playthroughs/${playthrough.id}`, 'PATCH', payload)) onPlaythroughsChanged?.();
  }

  const started = metrics?.started ?? 0;
  const nextLabel = (playthroughs?.length ?? 0) === 0 ? 'Iniciar jornada' : 'Iniciar replay';

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const [formEnd, setFormEnd] = useState('');

  // Janela de atividade pelas conquistas do Achievist: a primeira e a última
  // data viram sugestão de início e de zerado, aplicadas só com o clique do usuário.
  const starts = (links ?? []).flatMap((link) => link.externalActivityStartedAt ? [localDate(link.externalActivityStartedAt)] : []).sort();
  const ends = (links ?? []).flatMap((link) => link.externalActivityEndedAt ? [localDate(link.externalActivityEndedAt)] : []).sort();
  const suggestedStart = starts[0] ?? null;
  const suggestedEnd = ends.at(-1) ?? null;
  const activityDays = (links ?? []).reduce((total, link) => total + link.externalActivityDays, 0);
  const canSuggestStart = Boolean(onApplyDate && gameDates && !gameDates.startedAt && suggestedStart);
  const canSuggestEnd = Boolean(onApplyDate && gameDates && gameDates.status === 'COMPLETED' && !gameDates.completedAt && suggestedEnd);

  const statusChip = (status: PlaythroughStatus) => <span className={`status-pill status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;

  return <section className="details-section jp" aria-labelledby="journey-title">
    <h2 id="journey-title">Plataformas e jornadas</h2>

    {(canSuggestStart || canSuggestEnd) && <div className="jp-suggest" role="status">
      <div>
        <strong>Datas sugeridas pelo Achievist</strong>
        <p>Suas conquistas neste jogo vão de {formatDateOnly(suggestedStart!)} a {formatDateOnly(suggestedEnd ?? suggestedStart!)}{activityDays > 0 ? `, em ${activityDays} ${activityDays === 1 ? 'dia' : 'dias'}` : ''}. É uma sugestão: nada é gravado sem o seu clique.</p>
      </div>
      <div className="jp-suggest-actions">
        {canSuggestStart && <button type="button" className="button-secondary" onClick={() => void onApplyDate!('startedAt', suggestedStart!)}>Usar {formatDateOnly(suggestedStart!)} como início</button>}
        {canSuggestEnd && <button type="button" className="button-secondary" onClick={() => void onApplyDate!('completedAt', suggestedEnd!)}>Usar {formatDateOnly(suggestedEnd!)} como data de zerado</button>}
      </div>
    </div>}

    <header className="jp-head">
      <h3>Plataformas</h3>
      {!addingPlatform && <button type="button" className="button-secondary jp-add" onClick={() => { setAddingPlatform(true); setMessage(''); }}>+ Adicionar plataforma</button>}
    </header>
    {links === null ? <p className="session-empty">Carregando…</p> : links.length === 0
      ? <div className="sess-empty"><p className="session-empty">Nenhuma plataforma associada.</p></div>
      : <ul className="jp-platforms">{links.map((link) => {
        const name = platformName(link.platformId);
        const hasExternal = link.externalPlaytimeMinutes !== null;
        return <li key={link.id} className="jp-platform" style={platformStyle(platforms.find((item) => item.id === link.platformId) ?? {})}>
          <div className="jp-platform-top">
            <PlatformLogo platform={platforms.find((item) => item.id === link.platformId) ?? {}} />
            <div className="jp-platform-title">
              <strong>{name}</strong>
              <div className="jp-chips">
                {link.isPrimary && <span className="jp-chip jp-chip-primary">Principal</span>}
                <span className={`jp-chip ${link.owned ? 'jp-chip-ok' : ''}`}>{link.owned ? 'Possuo' : 'Não possuo'}</span>
                {link.edition && <span className="jp-chip">{link.edition}</span>}
                {link.format && <span className="jp-chip">{formatLabels[link.format]}</span>}
              </div>
            </div>
            {hasExternal && (link.externalPlaytimeMinutes ?? 0) > 0 && <div className="jp-playtime">
              <strong>{formatCompactHours((link.externalPlaytimeMinutes ?? 0) / 60)}</strong>
              <span>na plataforma{link.externalSource ? ` · via ${link.externalSource}` : ''}</span>
            </div>}
            <div className="jp-menu">
              <button type="button" className="jp-menu-btn" aria-label={`Mais ações de ${name}`} aria-expanded={menuFor === link.id} onClick={() => setMenuFor(menuFor === link.id ? null : link.id)}>⋯</button>
              {menuFor === link.id && <div className="jp-menu-list" role="menu">
                {!link.isPrimary && <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenuFor(null); void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { isPrimary: true }); }}>Tornar principal</button>}
                {hasExternal && (link.externalPlaytimeMinutes ?? 0) > link.externalPlaytimeImportedMinutes && <button type="button" role="menuitem" disabled={busy} onClick={() => { setMenuFor(null); void importPlaytime(link); }}>Lançar como horas retroativas</button>}
                <button type="button" role="menuitem" className="jp-danger" disabled={busy} onClick={() => { setMenuFor(null); setPendingRemoval({ title: 'Desassociar plataforma', description: `Remover ${name} deste jogo?`, action: () => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'DELETE') }); }}>Desassociar</button>
              </div>}
            </div>
          </div>
          <div className="jp-toggles">
            <label className="jp-toggle"><Switch aria-label={`Possuo em ${name}`} checked={link.owned} disabled={busy} onChange={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { owned: !link.owned })} /><span>Possuo</span></label>
            {hasExternal && <label className="jp-toggle"><Switch aria-label={`Contar ${name} no total`} checked={link.countsTowardTotal} disabled={busy} onChange={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { countsTowardTotal: !link.countsTowardTotal })} /><span>Contar no total</span></label>}
            {link.externalPlaytimeImportedMinutes > 0 && <small>{formatCompactHours(link.externalPlaytimeImportedMinutes / 60)} já lançadas como retroativas</small>}
          </div>
        </li>;
      })}</ul>}

    {addingPlatform && <form className="session-form jp-form" onSubmit={(event) => void addPlatform(event)}>
      <label className="form-field">Plataforma<select name="platformId" required defaultValue="">
        <option value="">Selecione</option>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select></label>
      <label className="form-field">Edição<input name="edition" maxLength={120} placeholder="Ex.: Complete Edition" /></label>
      <label className="form-field">Formato<select name="format" defaultValue="">
        <option value="">Não informado</option>
        {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="form-field checkbox-field"><span>Possuo nesta plataforma</span><Switch name="owned" defaultChecked /></label>
      <label className="form-field checkbox-field"><span>Plataforma principal</span><Switch name="isPrimary" /></label>
      <div className="form-wide session-actions">
        <Button type="submit" disabled={busy}>Associar plataforma</Button>
        <button type="button" className="cancel-button" onClick={() => setAddingPlatform(false)}>Cancelar</button>
      </div>
    </form>}

    <header className="jp-head jp-head-journeys">
      <h3>Jornadas</h3>
      {!addingPlaythrough && <button type="button" className="gameshelf-button jp-add" onClick={() => { setAddingPlaythrough(true); setFormEnd(''); setMessage(''); }}>{nextLabel}</button>}
    </header>
    <dl className="sess-stats">
      <div><dt>Jornadas iniciadas</dt><dd>{started}</dd></div>
      <div><dt>Jornadas concluídas</dt><dd>{metrics?.completed ?? 0}</dd></div>
      <div><dt>Replays iniciados</dt><dd>{metrics?.replaysStarted ?? 0}</dd></div>
    </dl>

    {playthroughs === null ? <p className="session-empty">Carregando…</p> : playthroughs.length === 0
      ? <div className="sess-empty"><p className="session-empty">Nenhuma jornada registrada. O histórico de sessões continua valendo mesmo sem jornada.</p></div>
      : <ol className="jp-journeys">{[...playthroughs].reverse().map((playthrough) => <li key={playthrough.id} className="jp-journey">
        <div className="jp-journey-top">
          <strong>{playthrough.label ?? (playthrough.isReplay ? `Replay ${playthrough.sequence - 1}` : 'Primeira jornada')}</strong>
          {statusChip(playthrough.status)}
          {playthrough.isReplay && <span className="jp-chip">Replay</span>}
        </div>
        <p className="jp-journey-meta">{[
          playthrough.startedAt ? `Início: ${formatDateOnly(playthrough.startedAt)}` : 'Início não informado',
          playthrough.completedAt ? `Encerramento: ${formatDateOnly(playthrough.completedAt)}` : null,
          playthrough.primaryPlatformId ? `Plataforma: ${platformName(playthrough.primaryPlatformId)}` : null,
        ].filter(Boolean).join(' · ')}</p>
        {playthrough.notes && <p className="session-journal-entry">{playthrough.notes}</p>}
        <div className="session-item-actions">
          {transitions[playthrough.status].map((transition) => <button
            key={transition.status + transition.label} type="button" className="session-edit" disabled={busy}
            onClick={() => void changeStatus(playthrough, transition.status, transition.needsDate)}
          >{transition.label}</button>)}
          <button type="button" className="session-delete" disabled={busy} onClick={() => setPendingRemoval({ title: 'Excluir jornada', description: 'Excluir esta jornada? Esta ação não pode ser desfeita.', action: () => void send(`${apiUrl}/games/${gameId}/playthroughs/${playthrough.id}`, 'DELETE').then((ok) => { if (ok) onPlaythroughsChanged?.(); }) })}>Excluir jornada</button>
        </div>
      </li>)}</ol>}

    {addingPlaythrough && <form className="session-form jp-form" onSubmit={(event) => void addPlaythrough(event)}>
      <label className="form-field">Identificação<input name="label" maxLength={120} placeholder="Ex.: Replay no PlayStation 5" /></label>
      <label className="form-field">Plataforma principal<select name="primaryPlatformId" defaultValue="">
        <option value="">Não informada</option>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select></label>
      <label className="form-field">Início<input name="startedAt" type="date" defaultValue={todayLocal()} /><small>Deixe vazio para deixar a jornada apenas planejada.</small></label>
      <label className="form-field">Encerramento<input name="completedAt" type="date" value={formEnd} onChange={(event) => setFormEnd(event.target.value)} /><small>Preencha para lançar uma jornada que já terminou.</small></label>
      {formEnd && <label className="form-field">Resultado<select name="endStatus" defaultValue="COMPLETED">
        <option value="COMPLETED">Concluída</option>
        <option value="ABANDONED">Abandonada</option>
      </select></label>}
      <div className="form-wide session-actions">
        <Button type="submit" disabled={busy}>Criar jornada</Button>
        <button type="button" className="cancel-button" onClick={() => setAddingPlaythrough(false)}>Cancelar</button>
      </div>
    </form>}

    {/* O desconto automático depende da plataforma da sessão; sem ela o sistema
        não sabe de qual plataforma descontar e o total pode ficar inflado. */}
    {sessionsWithoutPlatform > 0 && <p role="status" className="session-feedback">
      {sessionsWithoutPlatform === 1
        ? 'Uma sessão deste jogo não tem plataforma informada e não entra no desconto do total consolidado.'
        : `${sessionsWithoutPlatform} sessões deste jogo não têm plataforma informada e não entram no desconto do total consolidado.`}
      {' '}Informe a plataforma nelas para o tempo da fonte não ser contado duas vezes.
    </p>}
    <p className="jp-note" title="O tempo informado pelas plataformas aparece em cada associação e não é somado a este total — lançá-lo como horas retroativas é uma decisão sua, por plataforma.">
      <span aria-hidden="true">ⓘ</span> Tempo registrado localmente: {formatCompactHours(localMinutes / 60)}
      {retroactiveHours ? `, incluindo ${formatCompactHours(retroactiveHours)} lançadas sem sessão` : ''}. O tempo das plataformas não é somado aqui.
    </p>
    {message && <p role="alert" className="session-feedback">{message}</p>}
    <ConfirmDialog open={pendingRemoval !== null} title={pendingRemoval?.title ?? ''} description={pendingRemoval?.description} confirmLabel="Remover" tone="danger" onCancel={() => setPendingRemoval(null)} onConfirm={() => { pendingRemoval?.action(); setPendingRemoval(null); }} />
  </section>;
}
