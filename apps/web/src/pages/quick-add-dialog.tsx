import { useEffect, useRef, useState } from 'react';
import type { Game, GameMetadataCandidate, Platform } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl } from './shared';

/**
 * Cadastro rápido (ADR-043): título e plataforma. Capa, ano, gêneros e descrição
 * chegam sozinhos pela captura automática no servidor; "Mais detalhes" abre o editor completo.
 */
export function QuickAddDialog({ platforms, debounceMs = 600, onCreated, onMoreDetails, onClose }: {
  platforms: Platform[];
  debounceMs?: number;
  onCreated: (game: Game) => void;
  onMoreDetails: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [suggestions, setSuggestions] = useState<GameMetadataCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(title);
  latest.current = title;

  useEffect(() => {
    const query = title.trim();
    if (query.length < 3) { setSuggestions([]); return; }
    const timer = window.setTimeout(() => {
      fetch(`${apiUrl}/metadata/games?query=${encodeURIComponent(query)}`)
        .then((response) => response.ok ? response.json() as Promise<GameMetadataCandidate[]> : [])
        .then((found) => { if (latest.current.trim() === query) setSuggestions(found.slice(0, 3)); })
        .catch(() => { /* Sem provedor ou sem rede: o cadastro segue sem sugestões. */ });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [title, debounceMs]);

  async function add() {
    const name = title.trim();
    if (!name) { setError('Informe o título do jogo.'); return; }
    setSaving(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/games`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: name, status: 'BACKLOG', ...(platformId ? { platformId } : {}) }),
      });
      if (!response.ok) throw new Error();
      onCreated(await response.json() as Game);
    } catch { setError('Não foi possível adicionar o jogo.'); setSaving(false); }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog quick-add" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title">Adicionar jogo</h2>
      <p className="library-subtitle">Digite o nome. Capa, ano, gêneros e descrição são buscados sozinhos depois.</p>
      <label className="form-field form-wide">Título
        <input value={title} autoFocus maxLength={200} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} />
      </label>
      {suggestions.length > 0 && <div className="finish-chips" aria-label="Sugestões">{suggestions.map((item) => <button key={item.providerId} type="button" className="ach-filter" onClick={() => { setTitle(item.title); setSuggestions([]); }}>{item.releaseYear ? `${item.title} (${item.releaseYear})` : item.title}</button>)}</div>}
      <label className="form-field form-wide">Plataforma (opcional)
        <select value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
          <option value="">—</option>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="session-feedback">{error}</p>}
      <footer className="dialog-actions">
        <button type="button" className="cancel-button" onClick={() => onMoreDetails(title.trim())}>Mais detalhes</button>
        <Button type="button" disabled={saving} onClick={() => void add()}>Adicionar</Button>
      </footer>
    </section>
  </div>;
}
