import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ExternalAchievementsResponse, GamePlatform, GamePlatformFormat, Platform, Playthrough, PlaythroughMetrics, PlaythroughStatus } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
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

/** Conquistas de uma associação: resumo e lista, com as desbloqueadas antes. */
function AchievementList({ data }: { data: ExternalAchievementsResponse }) {
  if (data.total === 0) {
    return <p className="session-empty">A fonte não informa conquistas para este jogo.</p>;
  }
  const pct = Math.round((data.unlockedCount / data.total) * 100);
  return <div className="achievement-panel">
    <div className="achievement-summary">
      <span className="achievement-count">{data.unlockedCount}<small>/{data.total}</small></span>
      <div className="achievement-progress-wrap"><div className="achievement-progress-bar" style={{ width: `${pct}%` }} /></div>
      <span className="achievement-pct">{pct}%</span>
      {data.points > 0 && <span className="achievement-points">{data.points} pts</span>}
    </div>
    {data.refreshedAt === null && <p className="session-feedback">Fonte indisponível — exibindo o último dado guardado.</p>}
    <ul className="achievement-list">{data.achievements.map((achievement) => <li key={achievement.id} className={achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}>
      <span className="achievement-icon" aria-hidden="true">{achievement.unlocked ? '★' : '○'}</span>
      <div className="achievement-body">
        <strong>{achievement.name}</strong>
        {achievement.description && <p>{achievement.description}</p>}
        {achievement.unlockedAt && <small>Desbloqueada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(achievement.unlockedAt))}</small>}
      </div>
      {achievement.rarityPercent !== null && <span className="achievement-rarity">{achievement.rarityPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>}
    </li>)}</ul>
  </div>;
}

const formatDateOnly = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

type Props = {
  gameId: string;
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
export function GameJourneyPanel({ gameId, platforms, localMinutes, retroactiveHours = 0, sessionsWithoutPlatform = 0, onPlaythroughsChanged, onGameChanged }: Props) {
  const [links, setLinks] = useState<GamePlatform[] | null>(null);
  const [playthroughs, setPlaythroughs] = useState<Playthrough[] | null>(null);
  const [metrics, setMetrics] = useState<PlaythroughMetrics | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  // Conquistas são carregadas por associação, só quando o usuário abre: cada
  // abertura é uma requisição à fonte (ADR-028).
  const [achievements, setAchievements] = useState<Record<string, ExternalAchievementsResponse | 'loading' | 'failed'>>({});
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

  async function toggleAchievements(link: GamePlatform) {
    if (achievements[link.id]) {
      setAchievements((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== link.id)));
      return;
    }
    setAchievements((current) => ({ ...current, [link.id]: 'loading' }));
    try {
      const response = await fetch(`${apiUrl}/games/${gameId}/platforms/${link.id}/achievements`);
      if (!response.ok) throw new Error('falhou');
      const data = await response.json() as ExternalAchievementsResponse;
      setAchievements((current) => ({ ...current, [link.id]: data }));
    } catch {
      setAchievements((current) => ({ ...current, [link.id]: 'failed' }));
    }
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
    // Uma jornada só é criada como "em andamento" quando tem data de início;
    // sem data ela fica planejada e não conta como iniciada.
    const ok = await send(`${apiUrl}/games/${gameId}/playthroughs`, 'POST', {
      label: label || null,
      status: startedAt ? 'PLAYING' : 'PLANNED',
      startedAt: startedAt || null,
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

  return <section className="details-section" aria-labelledby="journey-title">
    <h2 id="journey-title">Plataformas e jornadas</h2>

    <h3>Plataformas</h3>
    {links === null ? <p className="session-empty">Carregando…</p> : links.length === 0
      ? <p className="session-empty">Nenhuma plataforma associada.</p>
      : <ul className="session-list">{links.map((link) => <li key={link.id}>
        <div>
          <strong>{platformName(link.platformId)}</strong>
          <span>{[link.edition, link.format ? formatLabels[link.format] : null, link.owned ? 'Possuo' : 'Não possuo', link.isPrimary ? 'Principal' : null].filter(Boolean).join(' · ')}</span>
        </div>
        {link.externalPlaytimeMinutes !== null && <p className="session-journal-entry">
          Tempo informado pela plataforma: {formatCompactHours(link.externalPlaytimeMinutes / 60)}
          {link.externalSource ? ` · via ${link.externalSource}` : ''}
          {link.externalPlaytimeImportedMinutes > 0 && ` · ${formatCompactHours(link.externalPlaytimeImportedMinutes / 60)} já lançadas como retroativas`}
          {link.countsTowardTotal && ' · conta no total consolidado'}
        </p>}
        <div className="session-item-actions">
          <button type="button" className="session-edit" disabled={busy} onClick={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { owned: !link.owned })}>{link.owned ? 'Marcar como não possuído' : 'Marcar como possuído'}</button>
          {!link.isPrimary && <button type="button" className="session-edit" disabled={busy} onClick={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { isPrimary: true })}>Tornar principal</button>}
          {link.externalPlaytimeMinutes !== null && <button
            type="button" className="session-edit" disabled={busy} aria-pressed={link.countsTowardTotal}
            onClick={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'PATCH', { countsTowardTotal: !link.countsTowardTotal })}
          >{link.countsTowardTotal ? 'Não contar no total' : 'Contar no total'}</button>}
          {link.externalPlaytimeMinutes !== null && link.externalPlaytimeMinutes > link.externalPlaytimeImportedMinutes && <button
            type="button" className="session-edit" disabled={busy}
            onClick={() => void importPlaytime(link)}
          >Lançar como horas retroativas</button>}
          {link.externalSource && <button type="button" className="session-edit" aria-expanded={Boolean(achievements[link.id])} onClick={() => void toggleAchievements(link)}>
            {achievements[link.id] ? 'Ocultar conquistas' : 'Conquistas'}
          </button>}
          <button type="button" className="session-delete" disabled={busy} onClick={() => void send(`${apiUrl}/games/${gameId}/platforms/${link.id}`, 'DELETE')}>Desassociar</button>
        </div>
        {achievements[link.id] === 'loading' && <p className="session-empty">Carregando conquistas…</p>}
        {achievements[link.id] === 'failed' && <p role="alert" className="session-feedback">Não foi possível carregar as conquistas.</p>}
        {typeof achievements[link.id] === 'object' && <AchievementList data={achievements[link.id] as ExternalAchievementsResponse} />}
      </li>)}</ul>}

    {addingPlatform ? <form className="session-form" onSubmit={(event) => void addPlatform(event)}>
      <label className="form-field">Plataforma<select name="platformId" required defaultValue="">
        <option value="">Selecione</option>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select></label>
      <label className="form-field">Edição<input name="edition" maxLength={120} placeholder="Ex.: Complete Edition" /></label>
      <label className="form-field">Formato<select name="format" defaultValue="">
        <option value="">Não informado</option>
        {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="form-field checkbox-field"><input type="checkbox" name="owned" defaultChecked />Possuo nesta plataforma</label>
      <label className="form-field checkbox-field"><input type="checkbox" name="isPrimary" />Plataforma principal</label>
      <div className="form-wide session-actions">
        <Button type="submit" disabled={busy}>Associar plataforma</Button>
        <button type="button" className="cancel-button" onClick={() => setAddingPlatform(false)}>Cancelar</button>
      </div>
    </form> : <Button type="button" onClick={() => { setAddingPlatform(true); setMessage(''); }}>Adicionar plataforma</Button>}

    <h3>Jornadas</h3>
    <dl className="details-estimates">
      <div><dt>Jornadas iniciadas</dt><dd>{started}</dd></div>
      <div><dt>Jornadas concluídas</dt><dd>{metrics?.completed ?? 0}</dd></div>
      <div><dt>Replays iniciados</dt><dd>{metrics?.replaysStarted ?? 0}</dd></div>
    </dl>

    {playthroughs === null ? <p className="session-empty">Carregando…</p> : playthroughs.length === 0
      ? <p className="session-empty">Nenhuma jornada registrada. O histórico de sessões continua valendo mesmo sem jornada.</p>
      : <ol className="session-list">{[...playthroughs].reverse().map((playthrough) => <li key={playthrough.id}>
        <div>
          <strong>{playthrough.label ?? (playthrough.isReplay ? `Replay ${playthrough.sequence - 1}` : 'Primeira jornada')}</strong>
          <span className={`status-pill status-${playthrough.status.toLowerCase()}`}>{statusLabels[playthrough.status]}</span>
        </div>
        <p>{[
          playthrough.startedAt ? `Início: ${formatDateOnly(playthrough.startedAt)}` : 'Início não informado',
          playthrough.completedAt ? `Conclusão: ${formatDateOnly(playthrough.completedAt)}` : null,
          playthrough.primaryPlatformId ? `Plataforma: ${platformName(playthrough.primaryPlatformId)}` : null,
        ].filter(Boolean).join(' · ')}</p>
        {playthrough.notes && <p className="session-journal-entry">{playthrough.notes}</p>}
        <div className="session-item-actions">
          {transitions[playthrough.status].map((transition) => <button
            key={transition.status + transition.label} type="button" className="session-edit" disabled={busy}
            onClick={() => void changeStatus(playthrough, transition.status, transition.needsDate)}
          >{transition.label}</button>)}
          <button type="button" className="session-delete" disabled={busy} onClick={() => void send(`${apiUrl}/games/${gameId}/playthroughs/${playthrough.id}`, 'DELETE')}>Excluir jornada</button>
        </div>
      </li>)}</ol>}

    {addingPlaythrough ? <form className="session-form" onSubmit={(event) => void addPlaythrough(event)}>
      <label className="form-field">Identificação<input name="label" maxLength={120} placeholder="Ex.: Replay no PlayStation 5" /></label>
      <label className="form-field">Início<input name="startedAt" type="date" defaultValue={todayLocal()} /><small>Deixe vazio para deixar a jornada apenas planejada.</small></label>
      <label className="form-field">Plataforma principal<select name="primaryPlatformId" defaultValue="">
        <option value="">Não informada</option>
        {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select><small>Resumo de exibição: as sessões podem usar outras plataformas.</small></label>
      <div className="form-wide session-actions">
        <Button type="submit" disabled={busy}>Criar jornada</Button>
        <button type="button" className="cancel-button" onClick={() => setAddingPlaythrough(false)}>Cancelar</button>
      </div>
    </form> : <Button type="button" onClick={() => { setAddingPlaythrough(true); setMessage(''); }}>{nextLabel}</Button>}

    {/* O desconto automático depende da plataforma da sessão; sem ela o sistema
        não sabe de qual plataforma descontar e o total pode ficar inflado. */}
    {sessionsWithoutPlatform > 0 && <p role="status" className="session-feedback">
      {sessionsWithoutPlatform === 1
        ? 'Uma sessão deste jogo não tem plataforma informada e não entra no desconto do total consolidado.'
        : `${sessionsWithoutPlatform} sessões deste jogo não têm plataforma informada e não entram no desconto do total consolidado.`}
      {' '}Informe a plataforma nelas para o tempo da fonte não ser contado duas vezes.
    </p>}
    <p className="session-empty">
      Tempo registrado localmente: {formatCompactHours(localMinutes / 60)}
      {retroactiveHours ? `, incluindo ${formatCompactHours(retroactiveHours)} lançadas sem sessão` : ''}.
      O tempo informado pelas plataformas aparece em cada associação e não é somado a este total — lançá-lo como
      horas retroativas é uma decisão sua, por plataforma.
    </p>
    {message && <p role="alert" className="session-feedback">{message}</p>}
  </section>;
}
