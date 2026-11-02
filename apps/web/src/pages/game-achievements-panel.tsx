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
 * Lista de conquistas do jogo: catálogo RAWG (vinculado automaticamente ao
 * salvar o jogo) cruzado com os desbloqueios do Achievist. Secretas ficam
 * ocultas por padrão — o toggle só decide se a linha aparece na lista, o
 * nome/descrição continuam mascarados pelo backend até desbloquear.
 */
export function GameAchievementsPanel({ gameId, onDataChange }: Props) {
  const [data, setData] = useState<GameAchievementsResponse | 'loading' | 'failed'>('loading');
  const [showSecrets, setShowSecrets] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');

  useEffect(() => {
    let active = true;
    setData('loading');
    setShowSecrets(false);
    fetch(`${apiUrl}/games/${gameId}/achievements`)
      .then((response) => { if (!response.ok) throw new Error('falhou'); return response.json() as Promise<GameAchievementsResponse>; })
      .then((body) => { if (!active) return; setData(body); onDataChange?.(body); })
      .catch(() => { if (!active) return; setData('failed'); onDataChange?.(null); });
    return () => { active = false; };
  }, [gameId]);

  if (data === 'loading') return <p className="session-empty">Carregando conquistas…</p>;
  if (data === 'failed') return <p role="alert" className="session-feedback">Não foi possível carregar as conquistas.</p>;
  if (!data.catalogAvailable) return <p className="session-empty">Ainda sem catálogo vinculado. Ele é buscado automaticamente na RAWG ao salvar o jogo — tente de novo em instantes, ou edite e salve o jogo outra vez para forçar uma nova busca.</p>;

  const term = search.trim().toLowerCase();
  const visible = data.achievements.filter((item) => (showSecrets || !item.secret)
    && (filter === 'ALL' || (filter === 'UNLOCKED') === item.unlocked)
    && (!term || `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase().includes(term)));
  const hiddenCount = data.achievements.filter((item) => item.secret).length;

  return <>
    <div className="ach-summary">
      <span className="achievement-summary-badge">{data.unlockedCount}/{data.total} · {data.percent}%</span>
      <div className="achievement-progress-wrap"><div className="achievement-progress-bar" style={{ width: `${data.percent}%` }} /></div>
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
      ? <p className="session-empty">{data.total === 0 ? 'A RAWG não informa conquistas para este jogo.' : 'Nenhuma conquista para mostrar com esses filtros.'}</p>
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
