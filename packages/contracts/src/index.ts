import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('gameshelf-api'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const gameStatusSchema = z.enum(['DESIRED', 'BACKLOG', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED']);
export const gamePrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);
export const gameDifficultySchema = z.enum(['C', 'B', 'A', 'AA', 'AAA']);
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida.');
const lifecycleFields = {
  owned: z.boolean().default(false),
  archived: z.boolean().default(false),
  startedAt: calendarDateSchema.nullable().default(null),
  completedAt: calendarDateSchema.nullable().default(null),
};

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
const mediaUrl = z.string().max(2048).refine((value) => {
  if (/^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(value)) return true;
  try { new URL(value); return true; } catch { return false; }
});
const optionalUrl = mediaUrl.nullable().optional();
const optionalHours = z.number().finite().min(0).max(999999.99).nullable().optional();

const gameInputBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  coverUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  releaseYear: z.number().int().min(1).max(9999).nullable().optional(),
  developer: z.string().trim().max(200).nullable().optional(),
  publisher: z.string().trim().max(200).nullable().optional(),
  franchiseId: z.string().uuid().nullable().optional(),
  platformId: z.string().uuid().nullable().optional(),
  genreIds: z.array(z.string().uuid()).max(50).optional(),
  status: gameStatusSchema.optional(),
  rating: z.number().int().min(1).max(11).nullable().optional(),
  difficulty: gameDifficultySchema.nullable().optional(),
  gameType: z.string().trim().max(100).nullable().optional(),
  completionCondition: z.string().trim().max(300).nullable().optional(),
  favorite: z.boolean().optional(),
  gameOfYear: z.boolean().optional(),
  priority: gamePrioritySchema.optional(),
  estimatedMainHours: optionalHours,
  estimatedCompletionistHours: optionalHours,
  personalEstimatedHours: optionalHours,
  retroactivePlayedHours: z.number().finite().min(0).max(999999.99).optional(),
  notes: optionalText,
  ...lifecycleFields,
}).strict();
const validGameDates = (value: { startedAt?: string | null; completedAt?: string | null }) => !value.startedAt || !value.completedAt || value.completedAt >= value.startedAt;
export const gameInputSchema = gameInputBaseSchema.refine(validGameDates, {
  path: ['completedAt'], message: 'A data de conclusão não pode ser anterior ao início.',
}).refine((value) => value.rating == null || value.status === 'COMPLETED' || value.status === 'ABANDONED', {
  path: ['rating'], message: 'A avaliação só pode ser informada para jogos zerados ou abandonados.',
}).refine((value) => !value.gameOfYear || Boolean(value.completedAt), {
  path: ['gameOfYear'], message: 'Informe a data de conclusão para marcar o jogo do ano.',
});

export const gameUpdateSchema = gameInputBaseSchema.partial().refine(validGameDates, {
  path: ['completedAt'], message: 'A data de conclusão não pode ser anterior ao início.',
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});

export const gameSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  coverUrl: mediaUrl.nullable(),
  backgroundUrl: mediaUrl.nullable(),
  releaseYear: z.number().int().nullable(),
  developer: z.string().nullable(),
  publisher: z.string().nullable(),
  franchiseId: z.string().uuid().nullable(),
  platformId: z.string().uuid().nullable(),
  genreIds: z.array(z.string().uuid()),
  status: gameStatusSchema,
  rating: z.number().int().min(1).max(11).nullable(),
  difficulty: gameDifficultySchema.nullable(),
  gameType: z.string().nullable(),
  completionCondition: z.string().nullable(),
  favorite: z.boolean(),
  gameOfYear: z.boolean(),
  owned: z.boolean(),
  archived: z.boolean(),
  startedAt: calendarDateSchema.nullable(),
  completedAt: calendarDateSchema.nullable(),
  priority: gamePrioritySchema,
  estimatedMainHours: z.number().nullable(),
  estimatedCompletionistHours: z.number().nullable(),
  personalEstimatedHours: z.number().nullable(),
  retroactivePlayedHours: z.number().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const completionPeriodSchema = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12).optional(), gameCount: z.number().int().nonnegative() }).strict();

export type GameInput = z.infer<typeof gameInputSchema>;
export type GameUpdate = z.infer<typeof gameUpdateSchema>;
export type Game = z.infer<typeof gameSchema>;

export const gameMetadataCandidateSchema = z.object({
  providerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  backgroundUrl: z.string().url().nullable().optional(),
  releaseYear: z.number().int().min(1).max(9999).nullable().optional(),
  developer: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  franchise: z.string().nullable().optional(),
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
}).strict();
export const gameMetadataCandidatesSchema = z.array(gameMetadataCandidateSchema).max(10);
export const metadataSearchQuerySchema = z.object({ query: z.string().trim().min(1).max(100) }).strict();
export type GameMetadataCandidate = z.infer<typeof gameMetadataCandidateSchema>;

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

export const gameListInputSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const gameListSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  gameCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export const gameListSchema = gameListSummarySchema.extend({ games: z.array(gameSchema) }).strict();
export type GameListInput = z.infer<typeof gameListInputSchema>;
export type GameListSummary = z.infer<typeof gameListSummarySchema>;
export type GameList = z.infer<typeof gameListSchema>;

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
  desiredCount: z.number().int().nonnegative(),
  backlogCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  playingCount: z.number().int().nonnegative(),
  pausedCount: z.number().int().nonnegative(),
  abandonedCount: z.number().int().nonnegative(),
  archivedCount: z.number().int().nonnegative(),
  completionByYear: z.array(completionPeriodSchema),
  completionByMonth: z.array(completionPeriodSchema),
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
    activeSession: sessionSchema.nullable(),
    estimatedHours: z.number().nonnegative().nullable(),
    remainingHours: z.number().nonnegative().nullable(),
  }).strict().nullable(),
  playingGames: z.array(z.object({
    game: gameSchema,
    playedHours: z.number().nonnegative(),
    progress: z.number().int().min(0).max(100).nullable(),
    lastSession: sessionSchema.nullable(),
    activeSession: sessionSchema.nullable(),
    estimatedHours: z.number().nonnegative().nullable(),
    remainingHours: z.number().nonnegative().nullable(),
  }).strict()),
  period: z.object({ from: z.string().nullable(), to: z.string().nullable() }).strict(),
  periodStats: z.object({
    playedHours: z.number().nonnegative(),
    sessions: z.number().int().nonnegative(),
    gamesPlayed: z.number().int().nonnegative(),
    gamesCompleted: z.number().int().nonnegative(),
  }).strict(),
  queuePreview: z.array(queueItemSchema),
}).strict();
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

const hoursSchema = z.number().nonnegative();
const statsGroupSchema = z.object({
  key: z.string(),
  name: z.string(),
  completedCount: z.number().int().nonnegative(),
  hours: hoursSchema,
  averageRating: z.number().min(1).max(11).nullable(),
}).strict();
const statsGameRefSchema = z.object({ id: z.string().uuid(), title: z.string(), coverUrl: mediaUrl.nullable(), hours: hoursSchema }).strict();

export const statsResponseSchema = z.object({
  totals: z.object({
    completedCount: z.number().int().nonnegative(),
    completedHours: hoursSchema,
    averageCompletedHours: hoursSchema.nullable(),
    longestGame: statsGameRefSchema.nullable(),
    shortestGame: statsGameRefSchema.nullable(),
    journeyStart: calendarDateSchema.nullable(),
    journeyDays: z.number().int().nonnegative(),
  }).strict(),
  ratingDistribution: z.array(z.object({ rating: z.number().int().min(1).max(11), count: z.number().int().nonnegative() }).strict()),
  difficultyDistribution: z.array(z.object({ difficulty: gameDifficultySchema, count: z.number().int().nonnegative() }).strict()),
  byGenre: z.array(statsGroupSchema),
  byType: z.array(statsGroupSchema),
  byPlatform: z.array(statsGroupSchema),
  byYear: z.array(z.object({
    year: z.number().int(),
    completedCount: z.number().int().nonnegative(),
    hours: hoursSchema,
    gameOfYear: statsGameRefSchema.nullable(),
  }).strict()),
  favorites: z.array(statsGameRefSchema.extend({ rating: z.number().int().nullable() }).strict()),
  topGenres: z.array(statsGroupSchema),
  topTypes: z.array(statsGroupSchema),
}).strict();
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type StatsGroup = z.infer<typeof statsGroupSchema>;

export const mainChallengeInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  listId: z.string().uuid(),
}).strict();
export const mainChallengeSchema = z.object({
  title: z.string(),
  listId: z.string().uuid(),
  listName: z.string(),
  totalGames: z.number().int().nonnegative(),
  completedGames: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
}).strict();
export type MainChallengeInput = z.infer<typeof mainChallengeInputSchema>;
export type MainChallenge = z.infer<typeof mainChallengeSchema>;
