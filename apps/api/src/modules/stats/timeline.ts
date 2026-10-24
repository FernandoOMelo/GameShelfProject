import type { Game, Session, TimelineEvent, TimelineResponse } from '@gameshelf/contracts';

type Completion = { title: string; gamesCount: number; completedAt: string };

type PlaytimeImport = {
  id: string;
  gameId: string;
  platformName: string;
  source: string;
  importedMinutes: number;
  importedAt: string;
  externalLastPlayedAt: string | null;
  activityStartedAt: string | null;
  activityEndedAt: string | null;
  activityDays: number;
};

type Input = {
  games: Game[];
  sessions: Session[];
  completions: Completion[];
  playtimeImports?: PlaytimeImport[];
  limit: number;
  before?: string;
  timezoneOffsetMinutes?: number;
};

export function buildTimeline({
  games, sessions, completions, playtimeImports = [], limit, before, timezoneOffsetMinutes = 0,
}: Input): TimelineResponse {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const events = [
    ...games.flatMap((game) => gameEvents(game)),
    ...sessions.flatMap((session) => sessionEvents(session, gamesById.get(session.gameId), timezoneOffsetMinutes)),
    ...playtimeImports.flatMap((entry) => playtimeImportEvents(entry, gamesById.get(entry.gameId), timezoneOffsetMinutes)),
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

function playtimeImportEvents(
  entry: PlaytimeImport,
  game: Game | undefined,
  offsetMinutes: number,
): TimelineEvent[] {
  if (!game) return [];
  return [{
    type: 'EXTERNAL_PLAYTIME_IMPORTED',
    at: entry.importedAt,
    date: localDay(entry.importedAt, offsetMinutes),
    gameId: game.id,
    gameTitle: game.title,
    coverUrl: game.coverUrl,
    importId: entry.id,
    platformName: entry.platformName,
    source: entry.source,
    importedMinutes: entry.importedMinutes,
    externalLastPlayedAt: entry.externalLastPlayedAt,
    activityStartedAt: entry.activityStartedAt,
    activityEndedAt: entry.activityEndedAt,
    activityDays: entry.activityDays,
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
  if (event.type === 'CHALLENGE_COMPLETED') return `${event.type}:${event.title}`;
  if (event.type === 'EXTERNAL_PLAYTIME_IMPORTED') return `${event.type}:${event.importId}`;
  return `${event.type}:${event.gameId}`;
}
