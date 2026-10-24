import { useState, type FormEvent } from 'react';
import type { Platform } from '@gameshelf/contracts';
import { Button, ConfirmDialog } from '@gameshelf/ui';
import { apiUrl } from './shared';

/**
 * Cadastro de plataformas na tela de Configurações: criar, renomear, agrupar e
 * excluir (ADR-025 e ADR-029). Um grupo é uma plataforma sem pai (PC,
 * PlayStation); uma loja ou variante fica dentro dele (Steam, GOG). Excluir é
 * recusado quando a plataforma tem jogos vinculados ou é grupo de outras.
 */
export function PlatformsPanel({ platforms, onChanged }: { platforms: Platform[]; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Platform | null>(null);

  const groups = platforms.filter((platform) => platform.parentId === null);
  const hasChildren = (platformId: string) => platforms.some((item) => item.parentId === platformId);
  const nameOf = (platformId: string | null) => platforms.find((item) => item.id === platformId)?.name;
  const visible = query.trim()
    ? platforms.filter((platform) => platform.name.toLowerCase().includes(query.trim().toLowerCase()))
    : platforms;

  async function request(url: string, init: RequestInit, fallback: string): Promise<boolean> {
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
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy('create');
    const ok = await request(`${apiUrl}/platforms`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, parentId: newParentId || null }),
    }, 'Não foi possível criar a plataforma.');
    if (ok) { setNewName(''); setNewParentId(''); onChanged(); }
    setBusy('');
  }

  async function rename(platform: Platform) {
    const name = renameValue.trim();
    if (!name || name === platform.name) { setRenamingId(null); return; }
    setBusy(platform.id);
    const ok = await request(`${apiUrl}/platforms/${platform.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
    }, 'Não foi possível renomear a plataforma.');
    if (ok) { setRenamingId(null); onChanged(); }
    setBusy('');
  }

  async function setParent(platform: Platform, parentId: string | null) {
    setBusy(platform.id);
    const ok = await request(`${apiUrl}/platforms/${platform.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parentId }),
    }, 'Não foi possível alterar o grupo.');
    if (ok) onChanged();
    setBusy('');
  }

  async function remove() {
    if (!pendingDelete) return;
    const platform = pendingDelete;
    setBusy(platform.id);
    const ok = await request(`${apiUrl}/platforms/${platform.id}`, { method: 'DELETE' }, 'Não foi possível excluir a plataforma.');
    setBusy('');
    setPendingDelete(null);
    if (ok) onChanged();
  }

  return <section className="panel" aria-labelledby="platforms-title">
    <h2 id="platforms-title">Plataformas</h2>
    <p className="panel-figure">
      Uma plataforma sem grupo é um grupo em si. Colocar Steam dentro de PC faz as horas e os jogos zerados
      das duas aparecerem juntos nas estatísticas, sem apagar nada.
    </p>

    <form className="platform-create" onSubmit={(event) => void create(event)}>
      <label className="form-field">Nova plataforma
        <input aria-label="Nome da nova plataforma" required maxLength={200} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex.: Steam" />
      </label>
      <label className="form-field">Grupo
        <select aria-label="Grupo da nova plataforma" value={newParentId} onChange={(event) => setNewParentId(event.target.value)}>
          <option value="">Nenhum (é um grupo)</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <Button type="submit" disabled={busy === 'create'}>Adicionar</Button>
    </form>

    {platforms.length === 0
      ? <p className="dashboard-empty">Nenhuma plataforma cadastrada ainda.</p>
      : <><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar plataforma" placeholder="Filtrar plataformas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {visible.length === 0
        ? <p className="dashboard-empty">Nenhuma plataforma corresponde a “{query}”.</p>
        : <ul className="session-list">{visible.map((platform) => <li key={platform.id}>
        <div>
          <strong>{platform.name}</strong>
          <span>{platform.parentId ? `em ${nameOf(platform.parentId) ?? 'grupo removido'}` : hasChildren(platform.id) ? 'grupo' : 'sem grupo'}</span>
        </div>
        {renamingId === platform.id
          ? <form className="platform-rename" onSubmit={(event) => { event.preventDefault(); void rename(platform); }}>
            <label className="form-field">Novo nome<input aria-label={`Novo nome de ${platform.name}`} required maxLength={200} autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label>
            <Button type="submit" disabled={busy === platform.id}>Salvar</Button>
            <button type="button" className="cancel-button" onClick={() => setRenamingId(null)}>Cancelar</button>
          </form>
          : <div className="platform-actions">
          <label className="form-field">
            Grupo
            <select
              aria-label={`Grupo de ${platform.name}`}
              value={platform.parentId ?? ''}
              disabled={busy === platform.id || hasChildren(platform.id)}
              onChange={(event) => void setParent(platform, event.target.value || null)}
            >
              <option value="">Nenhum (é um grupo)</option>
              {groups.filter((group) => group.id !== platform.id).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            {hasChildren(platform.id) && <small>Já é grupo de outras plataformas.</small>}
          </label>
          <button type="button" className="session-edit" disabled={busy === platform.id} onClick={() => { setRenamingId(platform.id); setRenameValue(platform.name); setMessage(''); }}>Renomear</button>
          <button type="button" className="session-delete" disabled={busy === platform.id} onClick={() => { setPendingDelete(platform); setMessage(''); }}>Excluir</button>
        </div>}
      </li>)}</ul>}</>}

    {message && <p role="alert" className="session-feedback">{message}</p>}
    <ConfirmDialog
      open={pendingDelete !== null}
      title="Excluir plataforma"
      description={pendingDelete ? `Excluir “${pendingDelete.name}” do catálogo? A exclusão é recusada se houver jogos vinculados ou outras plataformas dentro dela.` : undefined}
      confirmLabel="Excluir"
      tone="danger"
      busy={Boolean(pendingDelete) && busy === pendingDelete?.id}
      busyLabel="Excluindo…"
      onConfirm={() => void remove()}
      onCancel={() => setPendingDelete(null)}
    />
  </section>;
}
