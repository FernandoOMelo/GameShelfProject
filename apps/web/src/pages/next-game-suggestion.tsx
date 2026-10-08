import { useState } from 'react';
import type { Game, Suggestion } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl } from './shared';

export function NextGameSuggestion({ onSelectGame }: { onSelectGame: (game: Game) => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose() {
    setLoading(true);
    setFailed(false);
    try {
      const query = new URLSearchParams({ timezoneOffsetMinutes: String(new Date().getTimezoneOffset()) });
      const response = await fetch(`${apiUrl}/backlog/suggestions?${query}`);
      const body = response.ok ? await response.json() as Suggestion[] : null;
      if (!Array.isArray(body)) throw new Error('invalid');
      setSuggestions(body);
      setIndex(0);
    } catch { setFailed(true); } finally { setLoading(false); }
  }

  const current = suggestions?.[index];
  return <section className="panel next-game" aria-labelledby="next-game-title">
    <div className="section-heading">
      <h2 id="next-game-title">Próximo jogo</h2>
      <Button type="button" disabled={loading} onClick={() => void choose()}>{suggestions ? 'Sugerir de novo' : 'Me ajuda a escolher'}</Button>
    </div>
    {failed && <p role="alert" className="dashboard-empty">Não foi possível buscar uma sugestão.</p>}
    {suggestions && !current && !failed && <p className="dashboard-empty">Nenhum jogo disponível: adicione jogos possuídos ao backlog.</p>}
    {current && <div className="next-game-card">
      <button type="button" className="next-game-title" onClick={() => onSelectGame(current.game)}>{current.game.title}</button>
      <ul>{current.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      {suggestions!.length > 1 && <button type="button" className="session-edit" disabled={index >= suggestions!.length - 1} onClick={() => setIndex(index + 1)}>Outra opção ({index + 1}/{suggestions!.length})</button>}
    </div>}
  </section>;
}
