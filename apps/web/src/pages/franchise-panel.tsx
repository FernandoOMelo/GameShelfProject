import { useEffect, useState } from 'react';
import type { FranchiseGamesResponse } from '@gameshelf/contracts';
import { apiUrl, statusLabels } from './shared';

type Props = {
  franchiseId: string | null;
  onAddGame: (title: string) => void;
};

/** Outros jogos da mesma franquia no IGDB, cruzados com a biblioteca local. */
export function FranchisePanel({ franchiseId, onAddGame }: Props) {
  const [data, setData] = useState<FranchiseGamesResponse | 'loading' | 'failed' | 'unavailable' | null>(null);

  useEffect(() => {
    if (!franchiseId) { setData(null); return; }
    let active = true;
    setData('loading');
    (async () => {
      const response = await fetch(`${apiUrl}/franchises/${franchiseId}/igdb-games`);
      if (response.status === 503) { if (active) setData('unavailable'); return; }
      if (!response.ok) throw new Error('falhou');
      const body = await response.json() as FranchiseGamesResponse;
      if (active) setData(body);
    })().catch(() => { if (active) setData('failed'); });
    return () => { active = false; };
  }, [franchiseId]);

  if (!franchiseId) return <p className="session-empty">Este jogo não tem uma franquia associada.</p>;
  if (data === 'loading' || data === null) return <p className="session-empty">Carregando jogos da franquia…</p>;
  if (data === 'unavailable') return <p className="session-empty">Catálogo de franquias indisponível. Configure as credenciais do IGDB.</p>;
  if (data === 'failed') return <p role="alert" className="session-feedback">Não foi possível carregar os jogos da franquia.</p>;
  if (!data.games.length) return <p className="session-empty">A franquia {data.franchiseName} ainda não tem id do IGDB vinculado, ou não há outros jogos catalogados.</p>;

  return <ul className="franchise-game-grid">{data.games.map((game) => <li key={game.igdbId} className="franchise-game-card">
    <span className="franchise-game-cover">{game.coverUrl ? <img src={game.coverUrl} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">▧</span>}</span>
    <strong>{game.title}</strong>
    <span className="franchise-game-year">{game.releaseYear ?? 'Ano não informado'}</span>
    {game.inLibrary
      ? <span className="priority-badge franchise-game-status">{game.libraryGameStatus ? statusLabels[game.libraryGameStatus] : 'Na biblioteca'}</span>
      : <button type="button" className="session-edit" onClick={() => onAddGame(game.title)}>+ Adicionar</button>}
  </li>)}</ul>;
}
