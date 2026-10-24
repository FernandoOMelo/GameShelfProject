import { gamePlatformSchema, gameSchema, playthroughSchema, sessionSchema } from '@gameshelf/contracts';
import type { PlaythroughRecord } from '../playthroughs/repository.js';
import { isReplay } from '../playthroughs/service.js';
import type { GameRepository } from '../games/repository.js';
import type { SessionRepository } from '../sessions/repository.js';

export type GameRecord = Awaited<ReturnType<GameRepository['list']>>[number];
export type SessionRecord = Awaited<ReturnType<SessionRepository['listAll']>>[number];

// Converte registros do repositório (numeric como string, Date) para os contratos da API.
export function toGame(game: GameRecord) {
  return gameSchema.parse({
    ...game,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    retroactivePlayedHours: Number(game.retroactivePlayedHours ?? 0),
    createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(),
  });
}

export function toSession(session: SessionRecord) {
  return sessionSchema.parse({
    ...session,
    startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
    durationMinutes: session.endedAt === null ? null : Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000),
    createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
  });
}

export function toGamePlatform(record: {
  id: string; gameId: string; platformId: string; edition: string | null;
  format: 'PHYSICAL' | 'DIGITAL' | 'SUBSCRIPTION' | 'CLOUD' | null; owned: boolean; isPrimary: boolean;
  externalPlaytimeImportedMinutes: number; countsTowardTotal: boolean;
  externalSource: string | null; externalId: string | null; externalAccountLabel: string | null;
  externalPlaytimeMinutes: number | null; externalLastPlayedAt: Date | null; externalSyncedAt: Date | null;
  externalActivityStartedAt: Date | null; externalActivityEndedAt: Date | null; externalActivityDays: number;
  notes: string | null; createdAt: Date; updatedAt: Date;
}) {
  return gamePlatformSchema.parse({
    ...record,
    externalLastPlayedAt: record.externalLastPlayedAt?.toISOString() ?? null,
    externalSyncedAt: record.externalSyncedAt?.toISOString() ?? null,
    externalActivityStartedAt: record.externalActivityStartedAt?.toISOString() ?? null,
    externalActivityEndedAt: record.externalActivityEndedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toPlaythrough(record: PlaythroughRecord) {
  return playthroughSchema.parse({
    ...record,
    // Replay é derivado da ordenação, não de um contador separado.
    isReplay: isReplay(record),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
