import { gameSchema, sessionSchema } from '@gameshelf/contracts';
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
