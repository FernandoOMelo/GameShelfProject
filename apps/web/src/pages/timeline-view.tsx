import { useCallback, useEffect, useState } from 'react';
import type { Game, TimelineEvent, TimelineResponse } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { apiUrl, formatDateTime, formatDuration } from './shared';
import { SessionScreenshots } from './session-screenshots';

const recapLabels = [
  { key: 'notes', label: 'Resumo da história' },
  { key: 'keyDecisions', label: 'Decisões importantes' },
  { key: 'tips', label: 'Dicas e lembretes' },
] as const;
function recapEntries(event: { notes: string | null; keyDecisions: string | null; tips: string | null }) {
  return recapLabels.flatMap(({ key, label }) => event[key] ? [{ label, value: event[key]! }] : []);
}

const PAGE_SIZE = 40;

const eventLabels: Record<TimelineEvent['type'], string> = {
  GAME_STARTED: 'Iniciou',
  GAME_COMPLETED: 'Zerou',
  GAME_ADDED: 'Adicionou à biblioteca',
  SESSION: 'Jogou',
  EXTERNAL_PLAYTIME_IMPORTED: 'Tempo importado',
  CHALLENGE_COMPLETED: 'Completou a missão',
};

export function TimelineView({ games, onSelectGame }: { games: Game[]; onSelectGame: (game: Game) => void }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), timezoneOffsetMinutes: String(new Date().getTimezoneOffset()) });
    if (before) params.set('before', before);
    const response = await fetch(`${apiUrl}/stats/timeline?${params}`);
    if (!response.ok) throw new Error('Não foi possível carregar a linha do tempo.');
    return await response.json() as TimelineResponse;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchPage().then((page) => {
      if (!active) return;
      setEvents(page.events);
      setNextBefore(page.nextBefore);
    }).catch(() => {
      if (active) setError('Não foi possível carregar a linha do tempo.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPage]);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextBefore);
      setEvents((current) => [...current, ...page.events]);
      setNextBefore(page.nextBefore);
    } catch {
      setError('Não foi possível carregar mais eventos.');
    } finally {
      setLoadingMore(false);
    }
  }

  const days = groupByDay(events);

  return <section className="timeline-page" aria-labelledby="timeline-title">
    <div><p className="eyebrow">HISTÓRICO</p><h1 id="timeline-title">Linha do tempo</h1><p className="library-subtitle">Tudo o que aconteceu na sua biblioteca, do mais recente para o mais antigo.</p></div>
    {error && <div className="notice" role="alert">{error}</div>}
    {loading ? <p className="empty-state">Carregando linha do tempo…</p> : days.length === 0 ? (
      <section className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h2>Nada registrado ainda</h2><p>Adicione um jogo ou registre uma sessão para começar seu histórico.</p></section>
    ) : <>
      <ol className="timeline-days">{days.map(([date, dayEvents]) => <li key={date}>
        <h2 className="timeline-date">{formatDayLabel(date)}</h2>
        <ol className="timeline-events">{dayEvents.map((event) => <li key={eventId(event)} className={`timeline-event timeline-${event.type.toLowerCase()}`}>
          {event.type === 'CHALLENGE_COMPLETED'
            ? <p className="timeline-headline"><strong>{eventLabels[event.type]}</strong> {event.title} · {event.gamesCount} {event.gamesCount === 1 ? 'jogo' : 'jogos'}</p>
            : <p className="timeline-headline"><strong>{eventLabels[event.type]}</strong> <GameLink event={event} games={games} onSelectGame={onSelectGame} /></p>}
          {event.type === 'SESSION' && <>
            <p className="timeline-detail">{formatDateTime(event.at)} · {formatDuration(event.durationMinutes)}</p>
            <p className="timeline-detail">{[event.location, event.progress === null ? null : `${event.progress}%`].filter(Boolean).join(' · ') || 'Sem progresso informado'}</p>
            {recapEntries(event).map((entry) => <p key={entry.label} className="timeline-detail session-journal-entry"><strong>{entry.label}</strong>{entry.value}</p>)}
            <SessionScreenshots gameId={event.gameId} sessionId={event.sessionId} />
          </>}
        </li>)}</ol>
      </li>)}</ol>
      {nextBefore && <Button type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Carregando…' : 'Carregar mais'}</Button>}
    </>}
  </section>;
}

function GameLink({ event, games, onSelectGame }: { event: Exclude<TimelineEvent, { type: 'CHALLENGE_COMPLETED' }>; games: Game[]; onSelectGame: (game: Game) => void }) {
  const game = games.find((item) => item.id === event.gameId);
  if (!game) return <span>{event.gameTitle}</span>;
  return <button type="button" className="timeline-game-link" onClick={() => onSelectGame(game)}>{event.gameTitle}</button>;
}

function groupByDay(events: TimelineEvent[]): Array<[string, TimelineEvent[]]> {
  const byDay = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.date);
    if (bucket) bucket.push(event); else byDay.set(event.date, [event]);
  }
  return [...byDay];
}

function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function eventId(event: TimelineEvent): string {
  if (event.type === 'SESSION') return `SESSION:${event.sessionId}`;
  if (event.type === 'CHALLENGE_COMPLETED') return `CHALLENGE:${event.title}:${event.gamesCount}`;
  return `${event.type}:${event.gameId}`;
}
