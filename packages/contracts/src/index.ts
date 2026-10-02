import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('gameshelf-api'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const gameStatusSchema = z.enum(['BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED']);
export const gamePrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);

export const franchiseInputSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();
export const franchiseSchema = franchiseInputSchema.extend({ id: z.string().uuid() }).strict();
export type Franchise = z.infer<typeof franchiseSchema>;
export const platformInputSchema = franchiseInputSchema;
export const platformSchema = franchiseSchema;
export const genreInputSchema = franchiseInputSchema;
export const genreSchema = franchiseSchema;
export type Platform = z.infer<typeof platformSchema>;
export type Genre = z.infer<typeof genreSchema>;

const optionalText = z.string().trim().max(10000).nullable().optional();
const optionalUrl = z.string().url().max(2048).nullable().optional();
const optionalHours = z.number().finite().min(0).max(999999.99).nullable().optional();

export const gameInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  coverUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  releaseYear: z.number().int().min(1).max(9999).nullable().optional(),
  developer: z.string().trim().max(200).nullable().optional(),
  publisher: z.string().trim().max(200).nullable().optional(),
  franchiseId: z.string().uuid().nullable().optional(),
  platformIds: z.array(z.string().uuid()).max(50).optional(),
  genreIds: z.array(z.string().uuid()).max(50).optional(),
  status: gameStatusSchema.optional(),
  priority: gamePrioritySchema.optional(),
  estimatedMainHours: optionalHours,
  estimatedCompletionistHours: optionalHours,
  personalEstimatedHours: optionalHours,
  notes: optionalText,
}).strict();

export const gameUpdateSchema = gameInputSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});

export const gameSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  backgroundUrl: z.string().url().nullable(),
  releaseYear: z.number().int().nullable(),
  developer: z.string().nullable(),
  publisher: z.string().nullable(),
  franchiseId: z.string().uuid().nullable(),
  platformIds: z.array(z.string().uuid()),
  genreIds: z.array(z.string().uuid()),
  status: gameStatusSchema,
  priority: gamePrioritySchema,
  estimatedMainHours: z.number().nullable(),
  estimatedCompletionistHours: z.number().nullable(),
  personalEstimatedHours: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export type GameInput = z.infer<typeof gameInputSchema>;
export type GameUpdate = z.infer<typeof gameUpdateSchema>;
export type Game = z.infer<typeof gameSchema>;

const sessionFieldsSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  notes: optionalText,
}).strict();

export const sessionInputSchema = sessionFieldsSchema.refine((session) => !session.endedAt || Date.parse(session.endedAt) >= Date.parse(session.startedAt), {
  path: ['endedAt'],
  message: 'O término não pode ser anterior ao início.',
});

export const sessionUpdateSchema = sessionFieldsSchema.partial().refine((session) => Object.keys(session).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});

export const sessionSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nonnegative().nullable(),
  progress: z.number().int().min(0).max(100).nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export type SessionInput = z.infer<typeof sessionInputSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;
export type Session = z.infer<typeof sessionSchema>;

export const queueItemSchema = z.object({
  position: z.number().int().nonnegative(),
  addedAt: z.string().datetime(),
  game: gameSchema,
}).strict();
export const queueReorderSchema = z.object({
  gameIds: z.array(z.string().uuid()).max(1000),
}).strict().refine((value) => new Set(value.gameIds).size === value.gameIds.length, {
  path: ['gameIds'], message: 'A fila não pode conter jogos repetidos.',
});
export const weeklyMinutesSchema = z.object({ weeklyMinutes: z.number().int().min(0).max(10080) }).strict();
export type QueueItem = z.infer<typeof queueItemSchema>;
export type QueueReorder = z.infer<typeof queueReorderSchema>;
export type WeeklyMinutesInput = z.infer<typeof weeklyMinutesSchema>;

export const dashboardResponseSchema = z.object({
  gameCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  playingCount: z.number().int().nonnegative(),
  abandonedCount: z.number().int().nonnegative(),
  totalPlayedHours: z.number().nonnegative(),
  backlogRemainingHours: z.number().nonnegative(),
  weeklyHours: z.number().nonnegative(),
  queueRemainingHours: z.number().nonnegative(),
  estimatedQueueWeeks: z.number().nonnegative().nullable(),
  currentGame: z.object({
    game: gameSchema,
    playedHours: z.number().nonnegative(),
    progress: z.number().int().min(0).max(100).nullable(),
    lastSession: sessionSchema.nullable(),
    estimatedHours: z.number().nonnegative().nullable(),
    remainingHours: z.number().nonnegative().nullable(),
  }).strict().nullable(),
  queuePreview: z.array(queueItemSchema),
}).strict();
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
