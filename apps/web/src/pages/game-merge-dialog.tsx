import { useEffect, useMemo, useState } from 'react';
import type { DuplicateGameGroup, Game } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl } from './shared';

type Props = {
  game: Game;
  games: Game[];
  onClose: () => void;
  /** O jogo que permaneceu, já com os dados do absorvido. */
  onMerged: (merged: Game) => void;
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Mescla um cadastro duplicado no jogo aberto (ADR-038). O jogo atual
 * permanece; o escolhido deixa de existir e tudo o que ele tinha — sessões,
 * plataformas, conquistas, jornadas, DLCs — passa para o atual. Candidatos com
 * o mesmo título aparecem primeiro, mas qualquer jogo da biblioteca pode ser
 * escolhido: duplicatas nem sempre têm o mesmo nome.
 */
export function GameMergeDialog({ game, games, onClose, onMerged }: Props) {
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/games/duplicates`)
      .then((response) => response.ok ? response.json() as Promise<DuplicateGameGroup[]> : [])
      .then((groups) => { if (active) setSuggestedIds(groups.filter((group) => group.gameIds.includes(game.id)).flatMap((group) => group.gameIds).filter((id) => id !== game.id)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [game.id]);

  const candidates = useMemo(() => {
    const term = normalize(search.trim());
    const others = games.filter((item) => item.id !== game.id);
    const matches = term ? others.filter((item) => normalize(item.title).includes(term)) : others.filter((item) => suggestedIds.includes(item.id));
    return matches.slice(0, 8);
  }, [games, game.id, search, suggestedIds]);

  async function merge() {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/games/${game.id}/merge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceGameId: chosen.id }) });
      if (!response.ok) { setError('Não foi possível mesclar os jogos.'); return; }
      onMerged(await response.json() as Game);
    } catch { setError('Não foi possível mesclar os jogos.'); }
    finally { setBusy(false); }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="game-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-title" style={{ width: 'min(100%, 560px)' }}>
      <header>
        <div><p className="eyebrow">MESCLAR DUPLICADO</p><h2 id="merge-title" style={{ fontSize: 22 }}>{game.title}</h2></div>
        <button type="button" className="dialog-close" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div style={{ padding: '16px 24px 22px', display: 'grid', gap: 12 }}>
        {chosen ? <>
          <p className="library-subtitle">Mesclar <strong>{chosen.title}</strong> em <strong>{game.title}</strong>? Sessões, plataformas, conquistas, jornadas, DLCs, fila e listas de “{chosen.title}” passam para “{game.title}”, as horas lançadas são somadas e o cadastro “{chosen.title}” é removido. Esta ação não pode ser desfeita.</p>
          {error && <p role="alert" className="session-feedback">{error}</p>}
          <div className="session-actions">
            <Button type="button" disabled={busy} onClick={() => void merge()}>{busy ? 'Mesclando…' : 'Mesclar jogos'}</Button>
            <button type="button" className="cancel-button" disabled={busy} onClick={() => setChosen(null)}>Voltar</button>
          </div>
        </> : <>
          <p className="library-subtitle">Escolha o cadastro duplicado que será absorvido por este jogo.</p>
          <label className="form-field">Buscar jogo<input type="search" autoFocus placeholder="Título do duplicado" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          {candidates.length === 0
            ? <p className="session-empty">{search.trim() ? 'Nenhum jogo encontrado.' : 'Nenhum candidato com o mesmo título. Busque pelo nome do outro cadastro.'}</p>
            : <ul className="session-list">{candidates.map((item) => <li key={item.id}>
              <div><strong>{item.title}</strong><span>{[item.releaseYear, suggestedIds.includes(item.id) ? 'mesmo título' : null].filter(Boolean).join(' · ') || 'Sem ano'}</span></div>
              <button type="button" className="session-edit" onClick={() => setChosen(item)}>Mesclar este</button>
            </li>)}</ul>}
        </>}
      </div>
    </section>
  </div>;
}
