import { useState } from 'react';
import type { Platform } from '@gameshelf/contracts';
import { apiUrl } from './shared';

/**
 * Organiza o catálogo de plataformas em dois níveis (ADR-025): PC é um grupo e
 * Steam, GOG ou Epic ficam dentro dele. Nada é renomeado nem mesclado — jogos,
 * associações e sessões continuam apontando para a mesma plataforma; ela apenas
 * passa a pertencer a um grupo, e as estatísticas agregam por grupo.
 */
export function PlatformGroupsPanel({ platforms, onChanged }: { platforms: Platform[]; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const groups = platforms.filter((platform) => platform.parentId === null);
  const hasChildren = (platformId: string) => platforms.some((item) => item.parentId === platformId);
  const nameOf = (platformId: string | null) => platforms.find((item) => item.id === platformId)?.name;

  async function setParent(platform: Platform, parentId: string | null) {
    setBusy(platform.id);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/platforms/${platform.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parentId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(error?.error ?? 'Não foi possível alterar o grupo.');
        return;
      }
      onChanged();
    } catch {
      setMessage('Não foi possível alterar o grupo.');
    } finally {
      setBusy('');
    }
  }

  return <section className="panel" aria-labelledby="platform-groups-title">
    <h2 id="platform-groups-title">Grupos de plataforma</h2>
    <p className="panel-figure">
      Uma plataforma sem grupo é um grupo em si. Colocar Steam dentro de PC faz as horas e os jogos zerados
      das duas aparecerem juntos nas estatísticas, sem renomear nem apagar nada.
    </p>
    {platforms.length === 0
      ? <p className="dashboard-empty">Nenhuma plataforma cadastrada ainda.</p>
      : <ul className="session-list">{platforms.map((platform) => <li key={platform.id}>
        <div>
          <strong>{platform.name}</strong>
          <span>{platform.parentId ? `em ${nameOf(platform.parentId) ?? 'grupo removido'}` : hasChildren(platform.id) ? 'grupo' : 'sem grupo'}</span>
        </div>
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
      </li>)}</ul>}
    {message && <p role="alert" className="session-feedback">{message}</p>}
  </section>;
}
