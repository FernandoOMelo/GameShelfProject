import { useEffect, useState } from 'react';
import type { GameAchievementsResponse, MergedAchievement } from '@gameshelf/contracts';
import { apiUrl } from './shared';

const rarityLabels: Record<MergedAchievement['rarityTier'], string> = {
  COMMON: 'Comum', UNCOMMON: 'Incomum', RARE: 'Raro', ULTRA_RARE: 'Ultra raro',
};

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));

type Props = {
  gameId: string;
  /** Avisa o pai com o resumo (para os cartões de "jogo terminado" e raridade na lateral). */
  onDataChange?: (data: GameAchievementsResponse | null) => void;
};

/**
 * Lista de conquistas do jogo: catálogo RAWG (vinculado automaticamente) cruzado
 * com os desbloqueios do Achievist. Cada plataforma tem o seu conjunto — os
 * troféus do PlayStation não são as conquistas do Steam —, então um jogo
 * multiplataforma mostra uma aba por plataforma. Secretas ficam
 * ocultas por padrão — o toggle só decide se a linha aparece na lista, o
 * nome/descrição continuam mascarados pelo backend até desbloquear.
 */
export function GameAchievementsPanel({ gameId, onDataChange }: Props) {
  const [data, setData] = useState<GameAchievementsResponse | 'loading' | 'failed'>('loading');
  const [showSecrets, setShowSecrets] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData('loading');
    setShowSecrets(false);
    setGroupId(null);
    fetch(`${apiUrl}/games/${gameId}/achievements`)
      .then((response) => { if (!response.ok) throw new Error('falhou'); return response.json() as Promise<GameAchievementsResponse>; })
      .then((body) => { if (!active) return; setData(body); onDataChange?.(body); })
      .catch(() => { if (!active) return; setData('failed'); onDataChange?.(null); });
    return () => { active = false; };
  }, [gameId]);

  if (data === 'loading') return <p className="session-empty">Carregando conquistas…</p>;
  if (data === 'failed') return <p role="alert" className="session-feedback">Não foi possível carregar as conquistas.</p>;
  if (!data.catalogAvailable) return <p className="session-empty">Ainda sem catálogo vinculado. A busca na RAWG é refeita automaticamente quando você abre esta aba (confira se a chave RAWG_API_KEY está configurada na API).</p>;

  // Respostas em cache de antes do agrupamento por plataforma não trazem `groups`.
  const groups = data.groups ?? (data.achievements.length === 0 ? [] : [{ id: 'all', platformId: null, name: 'Conquistas', total: data.total, unlockedCount: data.unlockedCount, percent: data.percent, completionTrophyId: data.completionTrophyId, achievements: data.achievements }]);
  const group = groups.find((item) => item.id === groupId) ?? groups[0];
  const groupAchievements = group?.achievements ?? [];
  const term = search.trim().toLowerCase();
  const visible = groupAchievements.filter((item) => (showSecrets || !item.secret)
    && (filter === 'ALL' || (filter === 'UNLOCKED') === item.unlocked)
    && (!term || `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase().includes(term)));
  const hiddenCount = groupAchievements.filter((item) => item.secret).length;

  return <>
    {groups.length > 1 && <div className="details-tabs ach-platform-tabs" role="tablist" aria-label="Plataformas com conquistas">
      {groups.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === group?.id} className={item.id === group?.id ? 'is-active' : ''} onClick={() => setGroupId(item.id)}>{item.name}<span className="details-tab-count">{item.unlockedCount}/{item.total}</span></button>)}
    </div>}
    <div className="ach-summary">
      <span className="achievement-summary-badge">{group?.unlockedCount ?? 0}/{group?.total ?? 0} · {group?.percent ?? 0}%</span>
      <div className="achievement-progress-wrap"><div className="achievement-progress-bar" style={{ width: `${group?.percent ?? 0}%` }} /></div>
    </div>
    <div className="ach-toolbar">
      <input type="search" aria-label="Pesquisar conquistas" placeholder="Pesquisar" value={search} onChange={(event) => setSearch(event.target.value)} />
      <label className="show-secrets-toggle">
        <input type="checkbox" checked={showSecrets} onChange={(event) => setShowSecrets(event.target.checked)} />
        Mostrar conquistas secretas{hiddenCount > 0 && !showSecrets ? ` (${hiddenCount})` : ''}
      </label>
      <select aria-label="Filtrar conquistas" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
        <option value="ALL">Todas as conquistas</option><option value="UNLOCKED">Desbloqueadas</option><option value="LOCKED">Bloqueadas</option>
      </select>
    </div>
    {visible.length === 0
      ? <p className="session-empty">{groupAchievements.length === 0 ? 'A RAWG não informa conquistas para este jogo.' : 'Nenhuma conquista para mostrar com esses filtros.'}</p>
      : <ul className="achievement-list achievement-list-rich">{visible.map((item) => <li key={item.id} className={`${item.unlocked ? 'achievement-unlocked' : 'achievement-locked'}${item.secret ? ' achievement-secret' : ''}`}>
        {item.secret
          ? <span className="achievement-icon achievement-icon-secret" aria-hidden="true"><i className="ach-eye-off" /></span>
          : item.iconUrl ? <img src={item.iconUrl} alt="" loading="lazy" decoding="async" className="achievement-icon-img" /> : <span className="achievement-icon" aria-hidden="true">{item.unlocked ? '★' : '○'}</span>}
        <div className="achievement-body">
          <strong>{item.name ?? 'Conquista secreta'}</strong>
          <p>{item.description ?? 'Os detalhes desta conquista serão revelados quando desbloqueada'}</p>
          <div className="achievement-tags">
            <span className={`achievement-rarity rarity-${item.rarityTier.toLowerCase().replace('_', '-')}`}>{rarityLabels[item.rarityTier]}</span>
            {item.rarityPercent !== null && <span className="achievement-percent">{item.rarityPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>}
          </div>
        </div>
        <div className="achievement-meta"><small>{item.unlockedAt ? `Desbloqueada ${formatDate(item.unlockedAt)}` : ''}</small></div>
      </li>)}</ul>}
  </>;
}
