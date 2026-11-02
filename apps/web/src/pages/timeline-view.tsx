import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Game, Platform, TimelineAchievement, TimelineEvent, TimelineResponse } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { AchievementsChart } from './achievements-chart';
import { PlatformIcon, platformStyle } from './platform-icons';
import { SessionScreenshots } from './session-screenshots';
import { apiUrl, formatCompactHours, formatDateTime, formatDuration } from './shared';

const recapLabels = [
  { key: 'notes', label: 'Resumo da história' },
  { key: 'keyDecisions', label: 'Decisões importantes' },
  { key: 'tips', label: 'Dicas e lembretes' },
] as const;
function recapEntries(event: { notes: string | null; keyDecisions: string | null; tips: string | null }) {
  return recapLabels.flatMap(({ key, label }) => event[key] ? [{ label, value: event[key]! }] : []);
}

const PAGE_SIZE = 40;
const pluralize = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Feed de atividade no estilo do Trophies Hunter: um cartão por acontecimento,
 * com capa, frase, data relativa e os ícones das conquistas. A sessão registrada
 * à mão é a fonte do tempo; as conquistas do Achievist que caem nela só a
 * enriquecem. Conquistas sem sessão aparecem sozinhas, só como informação.
 */
export function TimelineView({ games, platforms, onSelectGame }: { games: Game[]; platforms: Platform[]; onSelectGame: (game: Game) => void }) {
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

  return <section className="timeline-page" aria-labelledby="timeline-title">
    <div><p className="eyebrow">HISTÓRICO</p><h1 id="timeline-title">Linha do tempo</h1><p className="library-subtitle">Tudo o que aconteceu na sua biblioteca, do mais recente para o mais antigo.</p></div>
    <AchievementsChart />
    {error && <div className="notice" role="alert">{error}</div>}
    {loading ? <p className="empty-state">Carregando linha do tempo…</p> : events.length === 0 ? (
      <section className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h2>Nada registrado ainda</h2><p>Adicione um jogo ou registre uma sessão para começar seu histórico.</p></section>
    ) : <>
      <ol className="feed-list">{events.map((event) => <FeedCard key={eventId(event)} event={event} games={games} platforms={platforms} onSelectGame={onSelectGame} />)}</ol>
      {nextBefore && <Button type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Carregando…' : 'Carregar mais'}</Button>}
    </>}
  </section>;
}

type GameEvent = Exclude<TimelineEvent, { type: 'CHALLENGE_COMPLETED' }>;

function FeedCard({ event, games, platforms, onSelectGame }: { event: TimelineEvent; games: Game[]; platforms: Platform[]; onSelectGame: (game: Game) => void }) {
  if (event.type === 'CHALLENGE_COMPLETED') {
    return <li className="feed-card feed-card-challenge">
      <span className="feed-cover feed-cover-glyph" aria-hidden="true">★</span>
      <div className="feed-body">
        <FeedTop date={event.date} at={event.at} />
        <p className="feed-line"><strong>Completou a missão</strong> {event.title} · {pluralize(event.gamesCount, 'jogo', 'jogos')}</p>
      </div>
    </li>;
  }

  const achievements = 'achievements' in event ? event.achievements ?? [] : [];
  const unlockedCount = event.type === 'ACHIEVEMENTS_UNLOCKED' ? event.count : achievements.length;
  const game = games.find((item) => item.id === event.gameId);
  const platformId = ('platformId' in event ? event.platformId : null) ?? game?.platformId ?? null;
  const platform = platforms.find((item) => item.id === platformId);
  const ref = <GameRef event={event} platform={platform} game={game} onSelectGame={onSelectGame} />;

  let line: ReactNode;
  switch (event.type) {
    case 'SESSION':
      line = <>Jogou durante <b>{event.durationMinutes === null ? formatDuration(null) : formatCompactHours(event.durationMinutes / 60)}</b>{unlockedCount > 0 && <> e desbloqueou <b>{unlockedCount}</b> {unlockedCount === 1 ? 'conquista' : 'conquistas'}</>} em {ref}</>;
      break;
    case 'ACHIEVEMENTS_UNLOCKED':
      line = <>Desbloqueou <b>{event.count}</b> {event.count === 1 ? 'conquista' : 'conquistas'} em {ref}</>;
      break;
    case 'GAME_STARTED': line = <>Iniciou {ref}</>; break;
    case 'GAME_COMPLETED': line = <>Zerou {ref}</>; break;
    case 'GAME_ADDED': line = <>Adicionou {ref} à biblioteca</>; break;
    case 'EXTERNAL_PLAYTIME_IMPORTED':
      line = <>Importou <b>{formatCompactHours(event.importedMinutes / 60)}</b> de tempo da plataforma {event.platformName} em {ref}</>;
      break;
  }

  return <li className={`feed-card feed-${event.type.toLowerCase()}`}>
    <Cover event={event} />
    <div className="feed-body">
      <FeedTop date={event.date} at={event.at} />
      <p className="feed-line">{line}</p>
      {event.type === 'SESSION' && <>
        {(event.location || event.progress !== null) && <p className="timeline-detail">{[event.location, event.progress === null ? null : `${event.progress}%`].filter(Boolean).join(' · ')}</p>}
        {recapEntries(event).map((entry) => <p key={entry.label} className="timeline-detail session-journal-entry"><strong>{entry.label}</strong>{entry.value}</p>)}
      </>}
      {achievements.length > 0 && <AchievementRow achievements={achievements} total={event.type === 'ACHIEVEMENTS_UNLOCKED' ? event.count : achievements.length} />}
      {event.type === 'SESSION' && <SessionScreenshots gameId={event.gameId} sessionId={event.sessionId} />}
    </div>
  </li>;
}

function FeedTop({ date, at }: { date: string; at: string }) {
  return <div className="feed-top"><strong>Você</strong><time dateTime={date} title={formatDateTime(at)}>{relativeDay(date)}</time></div>;
}

function Cover({ event }: { event: GameEvent }) {
  return event.coverUrl
    ? <img className="feed-cover" src={event.coverUrl} alt="" loading="lazy" />
    : <span className="feed-cover feed-cover-glyph" aria-hidden="true">{event.gameTitle.slice(0, 1).toUpperCase()}</span>;
}

/** Ícone da plataforma na cor da marca, seguido do nome do jogo (abre os detalhes). */
function GameRef({ event, platform, game, onSelectGame }: { event: GameEvent; platform: Platform | undefined; game: Game | undefined; onSelectGame: (game: Game) => void }) {
  return <span className="feed-game">
    {platform && <span className="feed-platform" style={platformStyle(platform)} title={platform.name}><PlatformIcon iconKey={platform.iconKey} /></span>}
    {game
      ? <button type="button" className="timeline-game-link" onClick={() => onSelectGame(game)}>{event.gameTitle}</button>
      : <strong>{event.gameTitle}</strong>}
  </span>;
}

const MAX_VISIBLE_ICONS = 12;

function AchievementRow({ achievements, total }: { achievements: TimelineAchievement[]; total: number }) {
  const visible = achievements.slice(0, MAX_VISIBLE_ICONS);
  const hidden = total - visible.length;
  return <ul className="feed-achievements" aria-label="Conquistas desbloqueadas">
    {visible.map((achievement, index) => <li key={`${achievement.unlockedAt}-${index}`} className="feed-achievement" tabIndex={0}>
      {achievement.iconUrl ? <img src={achievement.iconUrl} alt={achievement.name ?? 'Conquista'} loading="lazy" /> : <span className="feed-achievement-fallback" aria-hidden="true">★</span>}
      <span className="feed-tooltip" role="tooltip">
        <strong>{achievement.name ?? 'Conquista secreta'}</strong>
        {achievement.description && <small>{achievement.description}</small>}
      </span>
    </li>)}
    {hidden > 0 && <li className="feed-achievements-more">+{hidden}</li>}
  </ul>;
}

/** "Hoje", "Ontem", "há N dias" até uma semana; depois a data por extenso. */
function relativeDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year!, month! - 1, day!);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `há ${days} dias`;
  return target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function eventId(event: TimelineEvent): string {
  if (event.type === 'SESSION') return `SESSION:${event.sessionId}`;
  if (event.type === 'CHALLENGE_COMPLETED') return `CHALLENGE:${event.title}:${event.gamesCount}`;
  if (event.type === 'EXTERNAL_PLAYTIME_IMPORTED') return `${event.type}:${event.importId}`;
  if (event.type === 'ACHIEVEMENTS_UNLOCKED') return `${event.type}:${event.gameId}:${event.date}`;
  return `${event.type}:${event.gameId}`;
}
