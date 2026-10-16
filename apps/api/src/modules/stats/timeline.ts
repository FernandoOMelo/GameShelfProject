import type { Game, Session, TimelineEvent, TimelineResponse } from '@gameshelf/contracts';

type Completion = { title: string; gamesCount: number; completedAt: string };

type Input = {
  games: Game[];
  sessions: Session[];
  completions: Completion[];
  limit: number;
  before?: string;
  timezoneOffsetMinutes?: number;
};

export function buildTimeline({ games, sessions, completions, limit, before, timezoneOffsetMinutes = 0 }: Input): TimelineResponse {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const events = [
    ...games.flatMap((game) => gameEvents(game)),
    ...sessions.flatMap((session) => sessionEvents(session, gamesById.get(session.gameId), timezoneOffsetMinutes)),
    ...completions.map((completion) => challengeEvent(completion, timezoneOffsetMinutes)),
  ];

  const ordered = events.sort((a, b) => b.at.localeCompare(a.at) || eventKey(a).localeCompare(eventKey(b)));
  const page = (before ? ordered.filter((event) => event.at < before) : ordered).slice(0, limit + 1);
  const hasMore = page.length > limit;
  const visible = hasMore ? page.slice(0, limit) : page;
  return { events: visible, nextBefore: hasMore ? visible.at(-1)!.at : null };
}

function gameEvents(game: Game): TimelineEvent[] {
  const ref = { gameId: game.id, gameTitle: game.title, coverUrl: game.coverUrl };
  const events: TimelineEvent[] = [{ type: 'GAME_ADDED', at: game.createdAt, date: game.createdAt.slice(0, 10), ...ref }];
  if (game.startedAt) events.push({ type: 'GAME_STARTED', at: dayStart(game.startedAt), date: game.startedAt, ...ref });
  if (game.completedAt) events.push({ type: 'GAME_COMPLETED', at: dayStart(game.completedAt), date: game.completedAt, ...ref });
  return events;
}

function sessionEvents(session: Session, game: Game | undefined, offsetMinutes: number): TimelineEvent[] {
  if (!game || session.endedAt === null) return [];
  return [{
    type: 'SESSION',
    at: session.startedAt,
    date: localDay(session.startedAt, offsetMinutes),
    gameId: game.id,
    gameTitle: game.title,
    coverUrl: game.coverUrl,
    sessionId: session.id,
    durationMinutes: session.durationMinutes,
    progress: session.progress,
    location: session.location,
    notes: session.notes,
    keyDecisions: session.keyDecisions,
    tips: session.tips,
  }];
}

function challengeEvent(completion: Completion, offsetMinutes: number): TimelineEvent {
  return {
    type: 'CHALLENGE_COMPLETED',
    at: completion.completedAt,
    date: localDay(completion.completedAt, offsetMinutes),
    title: completion.title,
    gamesCount: completion.gamesCount,
  };
}

function dayStart(calendarDate: string): string {
  return `${calendarDate}T00:00:00.000Z`;
}

function localDay(instant: string, offsetMinutes: number): string {
  return new Date(Date.parse(instant) - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function eventKey(event: TimelineEvent): string {
  return event.type === 'CHALLENGE_COMPLETED' ? `${event.type}:${event.title}` : `${event.type}:${event.gameId}`;
}
