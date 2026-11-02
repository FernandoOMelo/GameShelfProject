import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ExternalSyncState, Game, Platform, PlatformCatalogEntry, PlatformSummary } from '@gameshelf/contracts';
import { Button, ConfirmDialog, EmptyState } from '@gameshelf/ui';

import { PlatformIcon, PlatformLogo, platformIconOptions, platformStyle } from './platform-icons';
import { apiUrl, formatCompactHours } from './shared';

/**
 * Aba Plataformas: o equivalente à área "Contas" do Trophies Hunter, e também
 * o lugar onde o catálogo é mantido (ADR-025, ADR-029 e ADR-031). Cada cartão
 * mostra o que o GameShelf sabe da plataforma — jogos, tempo, conquistas,
 * zerados — com o logo e a cor oficiais, e o estado da sincronização com o
 * Achievist. Linhas sem dado são omitidas, em vez de exibir zero.
 */

const integer = new Intl.NumberFormat('pt-BR');
const DEFAULT_COLOR = '#5B6573';

export type PlatformsViewProps = {
  platforms: Platform[];
  summaries: PlatformSummary[];
  games: Game[];
  /** Avisa o pai que o catálogo mudou, para recarregar plataformas e resumos. */
  onChanged: () => void;
};

type Row = {
  platform: Platform;
  gameCount: number;
  completedCount: number;
  dominatedCount: number;
  localMinutes: number;
  externalMinutes: number;
  achievements: { unlocked: number; total: number } | null;
  covers: string[];
};

function buildRows(platforms: Platform[], summaries: PlatformSummary[], games: Game[]): Row[] {
  return platforms
    .map((platform): Row => {
      const summary = summaries.find((item) => item.platform.id === platform.id) ?? null;
      const linked = games.filter((game) => game.platformIds.includes(platform.id));
      return {
        platform,
        gameCount: summary?.gameCount ?? linked.length,
        completedCount: summary?.completedCount ?? linked.filter((game) => game.status === 'COMPLETED').length,
        dominatedCount: summary?.dominatedCount ?? 0,
        localMinutes: summary?.localPlayedMinutes ?? 0,
        externalMinutes: summary?.externalPlayedMinutes ?? 0,
        achievements: summary && summary.achievementsTotal > 0
          ? { unlocked: summary.achievementsUnlocked, total: summary.achievementsTotal }
          : null,
        covers: (summary?.recentGameCovers ?? []).filter((cover): cover is string => Boolean(cover)),
      };
    })
    .sort((left, right) => right.gameCount - left.gameCount || left.platform.name.localeCompare(right.platform.name, 'pt-BR'));
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return 'agora há pouco';
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const statIcon = (children: React.ReactNode) => <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable={false} {...stroke}>{children}</svg>;
export const GamesIcon = () => statIcon(<><circle cx="8" cy="5" r="2.4" /><path d="M3 13.5c.4-2.6 2.5-4 5-4s4.6 1.4 5 4" /></>);
export const ClockIcon = () => statIcon(<><circle cx="8" cy="8" r="6" /><path d="M8 4.6V8l2.2 1.4" /></>);
export const TrophyIcon = () => statIcon(<><path d="M5 2.5h6v3.6a3 3 0 0 1-6 0z" /><path d="M5 3.8H2.8c0 2 .8 3 2.4 3.3M11 3.8h2.2c0 2-.8 3-2.4 3.3M8 9.1v2.4M5.4 13.5h5.2" /></>);
export const CrownIcon = () => statIcon(<path d="M2.5 11.5 2 5l3.2 2.6L8 3.5l2.8 4.1L14 5l-.5 6.5zM3 13.5h10" />);
export const CheckIcon = () => statIcon(<path d="M3.5 8.4 6.6 11.5 12.5 4.8" />);

type FormState = { mode: 'create' } | { mode: 'edit'; platform: Platform };

export function PlatformsView({ platforms, summaries, games, onChanged }: PlatformsViewProps) {
  const rows = buildRows(platforms, summaries, games);
  const [form, setForm] = useState<FormState | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Platform | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [catalog, setCatalog] = useState<PlatformCatalogEntry[]>([]);
  const [sync, setSync] = useState<ExternalSyncState | null>(null);

  const loadSync = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/integrations/achievist/sync`);
      if (response.ok) setSync(await response.json() as ExternalSyncState);
    } catch { /* sem o estado da fonte, os cartões só omitem o status de sincronização */ }
  }, []);

  useEffect(() => { void loadSync(); }, [loadSync]);
  useEffect(() => {
    let active = true;
    void fetch(`${apiUrl}/platforms/catalog`)
      .then((response) => response.ok ? response.json() as Promise<PlatformCatalogEntry[]> : [])
      .then((body) => { if (active && Array.isArray(body)) setCatalog(body); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const nameOf = (id: string | null) => platforms.find((item) => item.id === id)?.name;
  const hasChildren = (id: string) => platforms.some((item) => item.parentId === id);

  async function request(url: string, init: RequestInit, fallback: string): Promise<boolean> {
    setBusy(true);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(error?.error ?? fallback);
        return false;
      }
      setMessage('');
      return true;
    } catch {
      setMessage(fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(values: { name: string; parentId: string | null; iconKey: string; color: string }) {
    const body: Record<string, unknown> = { name: values.name, parentId: values.parentId };
    if (values.iconKey) body.iconKey = values.iconKey;
    if (values.color) body.color = values.color;
    const editing = form?.mode === 'edit' ? form.platform : null;
    if (editing) {
      // Só envia o que mudou, para não regravar identidade visual sem querer.
      const changed: Record<string, unknown> = {};
      if (values.name !== editing.name) changed.name = values.name;
      if (values.parentId !== editing.parentId) changed.parentId = values.parentId;
      if (values.iconKey && values.iconKey !== editing.iconKey) changed.iconKey = values.iconKey;
      if (values.color && values.color !== editing.color) changed.color = values.color;
      if (Object.keys(changed).length === 0) { setForm(null); return; }
      if (await request(`${apiUrl}/platforms/${editing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changed) }, 'Não foi possível salvar a plataforma.')) { setForm(null); onChanged(); }
      return;
    }
    if (await request(`${apiUrl}/platforms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 'Não foi possível criar a plataforma.')) { setForm(null); onChanged(); }
  }

  async function remove() {
    if (!pendingDelete) return;
    const platform = pendingDelete;
    const ok = await request(`${apiUrl}/platforms/${platform.id}`, { method: 'DELETE' }, 'Não foi possível excluir a plataforma.');
    setPendingDelete(null);
    if (ok) onChanged();
  }

  async function syncNow() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/integrations/achievist/sync`, { method: 'POST' });
      if (response.status === 409) setMessage('Já existe uma sincronização em andamento.');
      else if (!response.ok) setMessage('Não foi possível iniciar a sincronização.');
      await loadSync();
      onChanged();
    } catch {
      setMessage('Não foi possível falar com a API do GameShelf.');
    } finally { setBusy(false); }
  }

  const syncEnabled = sync !== null && sync.status !== 'disabled';
  const syncedAt = sync ? relativeTime(sync.finishedAt ?? sync.startedAt) : null;

  return (
    <section className="platforms-page" aria-labelledby="platforms-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">SUAS PLATAFORMAS</p>
          <h1 id="platforms-title">Plataformas</h1>
          <p className="library-subtitle">Onde seus jogos estão: biblioteca, tempo e conquistas por plataforma.</p>
        </div>
        <div className="platforms-actions">
          {syncEnabled && <button type="button" className="button-secondary" disabled={busy || sync?.status === 'running'} onClick={() => void syncNow()}>Sincronizar Achievist</button>}
          {!form && <Button type="button" onClick={() => { setForm({ mode: 'create' }); setMessage(''); }}>Adicionar plataforma</Button>}
        </div>
      </div>

      {form && <PlatformForm
        key={form.mode === 'edit' ? form.platform.id : 'new'}
        state={form} platforms={platforms} catalog={catalog} busy={busy}
        onCancel={() => setForm(null)} onSubmit={(values) => void save(values)}
      />}
      {message && <p role="alert" className="session-feedback">{message}</p>}

      {rows.length === 0 ? (
        !form && <EmptyState
          title="Nenhuma plataforma ainda"
          description="Adicione uma plataforma para começar a agrupar seus jogos."
          action={<Button type="button" onClick={() => setForm({ mode: 'create' })}>Adicionar plataforma</Button>}
        />
      ) : (
        <ul className="platforms-grid">
          {rows.map((row) => {
            const { platform } = row;
            const completionPct = row.gameCount > 0 ? Math.round((row.completedCount / row.gameCount) * 100) : null;
            const hasExternal = row.externalMinutes > 0 || row.achievements !== null;
            const hours = (row.externalMinutes || row.localMinutes) / 60;
            return (
              <li className="platform-card" key={platform.id} style={platformStyle(platform)}>
                <div className="platform-card-head">
                  <PlatformLogo platform={platform} />
                  <div className="platform-card-title">
                    <p className="platform-card-name">{platform.name}{platform.parentId && <span className="platform-card-group">em {nameOf(platform.parentId) ?? 'grupo removido'}</span>}</p>
                    <p className="platform-card-stats-row">
                      <span title="Jogos"><GamesIcon />{integer.format(row.gameCount)}</span>
                      {hours > 0 && <span title="Tempo de jogo"><ClockIcon />{formatCompactHours(hours)}</span>}
                      {row.achievements && <span title="Conquistas desbloqueadas"><TrophyIcon />{integer.format(row.achievements.unlocked)}</span>}
                      <span title="Jogos dominados"><CrownIcon />{integer.format(row.dominatedCount)}</span>
                      <span title="Jogos zerados"><CheckIcon />{integer.format(row.completedCount)}</span>
                    </p>
                  </div>
                  {row.covers.length > 0 && (
                    <div className="platform-card-covers" aria-hidden="true">
                      {row.covers.slice(0, 4).map((cover, index) => <img key={`${cover}-${index}`} src={cover} alt="" loading="lazy" decoding="async" />)}
                    </div>
                  )}
                </div>

                {(completionPct !== null || row.achievements) && (
                  <div className="platform-card-progress">
                    {completionPct !== null && <ProgressLine label={`Zerados ${completionPct}%`} pct={completionPct} />}
                    {row.achievements && <ProgressLine label={`Conquistas ${integer.format(row.achievements.unlocked)} de ${integer.format(row.achievements.total)}`} pct={Math.round((row.achievements.unlocked / row.achievements.total) * 100)} />}
                  </div>
                )}

                <div className="platform-card-foot">
                  <SyncChip sync={hasExternal ? sync : null} hasExternal={hasExternal} />
                  <span className="platform-card-sync-text">{hasExternal ? (sync?.status === 'failed' ? 'Última sincronização falhou' : syncedAt ? `Sync ${syncedAt}` : 'Sem sync nesta execução') : 'Dados registrados manualmente'}</span>
                  <span className="platform-card-foot-actions">
                    {hasExternal && syncEnabled && <button type="button" className="icon-button" aria-label={`Sincronizar ${platform.name}`} title="Sincronizar com o Achievist" disabled={busy || sync?.status === 'running'} onClick={() => void syncNow()}>↻</button>}
                    <span className="jp-menu">
                      <button type="button" className="jp-menu-btn" aria-label={`Mais ações de ${platform.name}`} aria-expanded={menuFor === platform.id} onClick={() => setMenuFor(menuFor === platform.id ? null : platform.id)}>⋯</button>
                      {menuFor === platform.id && <div className="jp-menu-list" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setForm({ mode: 'edit', platform }); setMessage(''); }}>Editar</button>
                        <button type="button" role="menuitem" className="jp-danger" onClick={() => { setMenuFor(null); setPendingDelete(platform); setMessage(''); }}>Excluir</button>
                      </div>}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir plataforma"
        description={pendingDelete ? `Excluir “${pendingDelete.name}” do catálogo? A exclusão é recusada se houver jogos vinculados ou outras plataformas dentro dela.${hasChildren(pendingDelete.id) ? ' Esta plataforma é grupo de outras.' : ''}` : undefined}
        confirmLabel="Excluir"
        tone="danger"
        busy={busy}
        busyLabel="Excluindo…"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

export function ProgressLine({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="platform-card-progress-line">
      <span className="platform-card-progress-label">{label}</span>
      <span className="platform-card-progress-track" aria-hidden="true"><span className="platform-card-progress-fill" style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

function SyncChip({ sync, hasExternal }: { sync: ExternalSyncState | null; hasExternal: boolean }) {
  if (!hasExternal) return <span className="sync-chip sync-chip-manual">Manual</span>;
  if (sync?.status === 'running') return <span className="sync-chip sync-chip-running">Sincronizando…</span>;
  if (sync?.status === 'failed') return <span className="sync-chip sync-chip-failed">Falhou</span>;
  return <span className="sync-chip sync-chip-ok">Pronto</span>;
}

/** Cadastro e edição: escolhe do catálogo (logo e cor oficiais) ou personaliza. */
function PlatformForm({ state, platforms, catalog, busy, onCancel, onSubmit }: {
  state: FormState;
  platforms: Platform[];
  catalog: PlatformCatalogEntry[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; parentId: string | null; iconKey: string; color: string }) => void;
}) {
  const editing = state.mode === 'edit' ? state.platform : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState(editing?.parentId ?? '');
  const [iconKey, setIconKey] = useState(editing?.iconKey ?? '');
  const [color, setColor] = useState(editing?.color ?? '');
  const groups = platforms.filter((platform) => platform.parentId === null && platform.id !== editing?.id);
  const isGroupOfOthers = editing ? platforms.some((item) => item.parentId === editing.id) : false;
  const available = catalog.filter((entry) => !platforms.some((platform) => platform.name.toLowerCase() === entry.name.toLowerCase()));

  function pick(entry: PlatformCatalogEntry) {
    setName(entry.name);
    setIconKey(entry.iconKey);
    setColor(entry.color);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, parentId: parentId || null, iconKey, color });
  }

  return <form className="platform-form" onSubmit={submit}>
    <h2>{editing ? `Editar ${editing.name}` : 'Adicionar plataforma'}</h2>
    {!editing && available.length > 0 && <div className="platform-catalog" role="group" aria-label="Catálogo de plataformas">
      <p className="platform-form-hint">Escolha do catálogo para já trazer o logo e a cor oficiais, ou personalize abaixo.</p>
      <div className="platform-catalog-list">
        {available.map((entry) => <button type="button" key={entry.catalogKey} className="platform-catalog-item" style={{ '--platform-color': entry.color } as React.CSSProperties} onClick={() => pick(entry)}>
          <span className="platform-catalog-logo" aria-hidden="true"><PlatformIcon iconKey={entry.iconKey} /></span>{entry.name}
        </button>)}
      </div>
    </div>}
    <div className="platform-form-fields">
      <PlatformLogo platform={{ iconKey: iconKey || null, color: color || DEFAULT_COLOR }} size={48} />
      <label className="form-field">Nome
        <input aria-label="Nome da plataforma" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Steam" />
      </label>
      <label className="form-field">Grupo
        <select aria-label="Grupo da plataforma" value={parentId} disabled={isGroupOfOthers} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Nenhum (é um grupo)</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        {isGroupOfOthers && <small>Já é grupo de outras plataformas.</small>}
      </label>
      <label className="form-field">Ícone
        <select aria-label="Ícone da plataforma" value={iconKey} onChange={(event) => setIconKey(event.target.value)}>
          <option value="">{editing ? 'Manter' : 'Automático (pelo nome)'}</option>
          {platformIconOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </label>
      <label className="form-field">Cor da marca
        <input aria-label="Cor da plataforma" type="color" value={color || DEFAULT_COLOR} onChange={(event) => setColor(event.target.value.toUpperCase())} />
      </label>
    </div>
    <p className="platform-form-hint">Uma plataforma sem grupo é um grupo em si. Colocar Steam dentro de PC faz as horas e os jogos zerados das duas aparecerem juntos nas estatísticas, sem apagar nada.</p>
    <div className="form-wide session-actions">
      <Button type="submit" disabled={busy}>{editing ? 'Salvar' : 'Adicionar'}</Button>
      <button type="button" className="cancel-button" onClick={onCancel}>Cancelar</button>
    </div>
  </form>;
}
