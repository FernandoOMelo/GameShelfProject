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
// Plataformas têm dois níveis (ADR-025): sem `parentId` é um grupo (PC,
// PlayStation); com `parentId` é uma loja ou variante dentro dele (Steam, GOG).
// O padrão nulo mantém backups anteriores importáveis.
export const platformInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
}).strict();
export const platformUpdateSchema = z.object({
  parentId: z.string().uuid().nullable(),
}).strict();
export const platformSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullable().default(null),
}).strict();
export type PlatformInput = z.infer<typeof platformInputSchema>;
export type PlatformUpdate = z.infer<typeof platformUpdateSchema>;
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
  excludedFromSuggestions: z.boolean().optional(),
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
  // Todas as plataformas associadas ao jogo (ADR-023). Derivada de game_platforms;
  // o padrão vazio mantém backups antigos importáveis.
  platformIds: z.array(z.string().uuid()).default([]),
  genreIds: z.array(z.string().uuid()),
  status: gameStatusSchema,
  rating: z.number().int().min(1).max(11).nullable(),
  difficulty: gameDifficultySchema.nullable(),
  gameType: z.string().nullable(),
  completionCondition: z.string().nullable(),
  favorite: z.boolean(),
  gameOfYear: z.boolean(),
  excludedFromSuggestions: z.boolean(),
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

export const gameTimeEstimateSchema = z.object({
  providerId: z.string().min(1),
  title: z.string().min(1),
  releaseYear: z.number().int().min(1).max(9999).nullable().optional(),
  mainHours: optionalHours,
  mainExtraHours: optionalHours,
  completionistHours: optionalHours,
}).strict();
export const gameTimeEstimatesSchema = z.array(gameTimeEstimateSchema).max(10);
export type GameTimeEstimate = z.infer<typeof gameTimeEstimateSchema>;

const sessionFieldsSchema = z.object({
  playthroughId: z.string().uuid().nullable().optional(),
  platformId: z.string().uuid().nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  notes: optionalText,
  keyDecisions: optionalText,
  tips: optionalText,
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
  playthroughId: z.string().uuid().nullable().default(null),
  platformId: z.string().uuid().nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nonnegative().nullable(),
  progress: z.number().int().min(0).max(100).nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  keyDecisions: z.string().nullable(),
  tips: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const sessionScreenshotSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  url: mediaUrl,
  createdAt: z.string().datetime(),
}).strict();
export type SessionScreenshot = z.infer<typeof sessionScreenshotSchema>;

export type SessionInput = z.infer<typeof sessionInputSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;
export type Session = z.infer<typeof sessionSchema>;

// ── Associação de plataforma (ADR-023) ──────────────────────────────────────
// "O jogo existe nesta plataforma", "eu possuo", "eu joguei" e "eu zerei" são
// informações distintas: a associação cobre existência e posse. Jogar e zerar
// ficam nas sessões e nas jornadas.
export const gamePlatformFormatSchema = z.enum(['PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'CLOUD']);
export type GamePlatformFormat = z.infer<typeof gamePlatformFormatSchema>;

const gamePlatformFieldsSchema = z.object({
  platformId: z.string().uuid(),
  edition: z.string().trim().max(120).nullable().optional(),
  format: gamePlatformFormatSchema.nullable().optional(),
  owned: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  notes: optionalText,
}).strict();

export const gamePlatformInputSchema = gamePlatformFieldsSchema;
export const gamePlatformUpdateSchema = gamePlatformFieldsSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});
export const gamePlatformSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  platformId: z.string().uuid(),
  edition: z.string().nullable(),
  format: gamePlatformFormatSchema.nullable(),
  owned: z.boolean(),
  isPrimary: z.boolean(),
  // Proveniência externa: sempre separada do tempo registrado localmente.
  externalSource: z.string().nullable(),
  externalId: z.string().nullable(),
  externalAccountLabel: z.string().nullable(),
  externalPlaytimeMinutes: z.number().int().nonnegative().nullable(),
  externalLastPlayedAt: z.string().datetime().nullable(),
  externalSyncedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type GamePlatformInput = z.infer<typeof gamePlatformInputSchema>;
export type GamePlatformUpdate = z.infer<typeof gamePlatformUpdateSchema>;
export type GamePlatform = z.infer<typeof gamePlatformSchema>;

// ── Jornadas e fator replay (ADR-023) ───────────────────────────────────────
export const playthroughStatusSchema = z.enum(['PLANNED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED']);
export type PlaythroughStatus = z.infer<typeof playthroughStatusSchema>;

const playthroughFieldsSchema = z.object({
  label: z.string().trim().max(120).nullable().optional(),
  status: playthroughStatusSchema.optional(),
  primaryPlatformId: z.string().uuid().nullable().optional(),
  startedAt: calendarDateSchema.nullable().optional(),
  completedAt: calendarDateSchema.nullable().optional(),
  notes: optionalText,
}).strict();

// Mesmas regras do banco, aplicadas na fronteira: uma jornada planejada ainda
// não começou e uma jornada concluída sempre tem data de conclusão.
const validPlaythrough = <T extends z.ZodTypeAny>(schema: T) => schema
  .refine((value: { startedAt?: string | null; completedAt?: string | null }) => !value.startedAt || !value.completedAt || value.completedAt >= value.startedAt, {
    path: ['completedAt'], message: 'A data de conclusão não pode ser anterior ao início.',
  })
  .refine((value: { status?: PlaythroughStatus; completedAt?: string | null }) => value.status !== 'COMPLETED' || Boolean(value.completedAt), {
    path: ['completedAt'], message: 'Informe a data de conclusão da jornada.',
  })
  .refine((value: { status?: PlaythroughStatus; startedAt?: string | null; completedAt?: string | null }) => value.status !== 'PLANNED' || (!value.startedAt && !value.completedAt), {
    path: ['status'], message: 'Uma jornada planejada não tem datas de início ou conclusão.',
  });

export const playthroughInputSchema = validPlaythrough(playthroughFieldsSchema);
export const playthroughUpdateSchema = playthroughFieldsSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});
export const playthroughSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  sequence: z.number().int().positive(),
  label: z.string().nullable(),
  status: playthroughStatusSchema,
  primaryPlatformId: z.string().uuid().nullable(),
  startedAt: calendarDateSchema.nullable(),
  completedAt: calendarDateSchema.nullable(),
  notes: z.string().nullable(),
  // Derivado da ordenação: a primeira jornada do jogo não é um replay.
  isReplay: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type PlaythroughInput = z.infer<typeof playthroughInputSchema>;
export type PlaythroughUpdate = z.infer<typeof playthroughUpdateSchema>;
export type Playthrough = z.infer<typeof playthroughSchema>;

// Métricas de replay de um jogo. "Iniciada" é toda jornada que deixou de ser
// planejada; "replay iniciado" é toda jornada iniciada com sequence > 1.
export const playthroughMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  started: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  abandoned: z.number().int().nonnegative(),
  replaysStarted: z.number().int().nonnegative(),
  activePlaythroughId: z.string().uuid().nullable(),
}).strict();
export type PlaythroughMetrics = z.infer<typeof playthroughMetricsSchema>;

// ── Importação de plataformas externas (ADR-024) ────────────────────────────
// A fonte externa informa biblioteca e tempo acumulado por plataforma; ela não
// tem evento de sessão, então nada aqui cria sessão, jornada ou replay, e o
// tempo externo nunca é somado às horas registradas localmente.
export const externalSyncSummarySchema = z.object({
  source: z.string(),
  /** Entradas lidas da fonte nesta rodada. */
  fetched: z.number().int().nonnegative(),
  /** Associações já vinculadas que tiveram o tempo acumulado atualizado. */
  updated: z.number().int().nonnegative(),
  /** Entradas sem vínculo confirmado, aguardando o usuário. */
  pending: z.number().int().nonnegative(),
  /** Entradas que o usuário já marcou para ignorar. */
  ignored: z.number().int().nonnegative(),
  // Explícito no contrato porque é um limite da decisão, não um detalhe: a
  // sincronização nunca cria sessões nem jornadas.
  sessionsCreated: z.literal(0),
  playthroughsCreated: z.literal(0),
}).strict();
export type ExternalSyncSummary = z.infer<typeof externalSyncSummarySchema>;

export const externalSyncStateSchema = z.object({
  source: z.string(),
  /** `disabled` quando as credenciais não estão configuradas. */
  status: z.enum(['disabled', 'idle', 'running', 'succeeded', 'failed']),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  summary: externalSyncSummarySchema.nullable(),
  error: z.string().nullable(),
}).strict();
export type ExternalSyncState = z.infer<typeof externalSyncStateSchema>;

/** Sugestão por título normalizado. É só sugestão: nunca é aplicada sozinha. */
export const externalMatchSuggestionSchema = z.object({
  gameId: z.string().uuid(),
  title: z.string(),
}).strict();

export const externalPendingMatchSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  externalId: z.string(),
  title: z.string(),
  platformName: z.string(),
  accountLabel: z.string().nullable(),
  externalPlaytimeMinutes: z.number().int().nonnegative().nullable(),
  externalLastPlayedAt: z.string().datetime().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  suggestions: z.array(externalMatchSuggestionSchema),
  /** Mais de uma sugestão é ambiguidade: a decisão fica com o usuário. */
  ambiguous: z.boolean(),
}).strict();
export type ExternalPendingMatch = z.infer<typeof externalPendingMatchSchema>;

export const externalMatchConfirmSchema = z.object({
  gameId: z.string().uuid(),
  /** Plataforma do catálogo; sem ela, o nome da fonte é resolvido ou criado. */
  platformId: z.string().uuid().optional(),
}).strict();
export type ExternalMatchConfirm = z.infer<typeof externalMatchConfirmSchema>;

export const gameListInputSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const gameListCreateSchema = gameListInputSchema.extend({
  gameIds: z.array(z.string().uuid()).max(1000).optional(),
}).strict().refine((value) => !value.gameIds || new Set(value.gameIds).size === value.gameIds.length, {
  path: ['gameIds'], message: 'A lista não pode conter jogos repetidos.',
});
export type GameListCreate = z.infer<typeof gameListCreateSchema>;
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

export const librarySortSchema = z.enum(['TITLE', 'STARTED_DESC', 'COMPLETED_DESC']);
export type LibrarySort = z.infer<typeof librarySortSchema>;

const filterChoice = z.string().trim().max(200).default('ALL');

export const libraryFilterStateSchema = z.object({
  query: z.string().trim().max(200).default(''),
  status: z.union([gameStatusSchema, z.literal('ALL')]).default('ALL'),
  priority: z.union([gamePrioritySchema, z.literal('ALL')]).default('ALL'),
  platformId: filterChoice,
  genreId: filterChoice,
  franchiseId: filterChoice,
  developer: filterChoice,
  listId: filterChoice,
  completedYear: filterChoice,
  archived: z.boolean().default(false),
  sortBy: librarySortSchema.default('TITLE'),
}).strict();
export type LibraryFilterState = z.infer<typeof libraryFilterStateSchema>;

export const savedFilterInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: libraryFilterStateSchema,
}).strict();
export const savedFilterUpdateSchema = savedFilterInputSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});
export const savedFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filters: libraryFilterStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type SavedFilterInput = z.infer<typeof savedFilterInputSchema>;
export type SavedFilterUpdate = z.infer<typeof savedFilterUpdateSchema>;
export type SavedFilter = z.infer<typeof savedFilterSchema>;

export const queueItemSchema = z.object({
  position: z.number().int().nonnegative(),
  addedAt: z.string().datetime(),
  game: gameSchema,
}).strict();
export const queueFromListSchema = z.object({ listId: z.string().uuid() }).strict();
export type QueueFromList = z.infer<typeof queueFromListSchema>;
export const queueReorderSchema = z.object({
  gameIds: z.array(z.string().uuid()).max(1000),
}).strict().refine((value) => new Set(value.gameIds).size === value.gameIds.length, {
  path: ['gameIds'], message: 'A fila não pode conter jogos repetidos.',
});
export const weeklyMinutesSchema = z.object({ weeklyMinutes: z.number().int().min(0).max(10080) }).strict();
export type QueueItem = z.infer<typeof queueItemSchema>;
export type QueueReorder = z.infer<typeof queueReorderSchema>;
export type WeeklyMinutesInput = z.infer<typeof weeklyMinutesSchema>;

export const suggestionSchema = z.object({
  game: gameSchema,
  score: z.number(),
  reasons: z.array(z.string()),
}).strict();
export type Suggestion = z.infer<typeof suggestionSchema>;

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
  backlogForecast: z.object({
    estimatedWeeks: z.number().nonnegative().nullable(),
    estimatedMonths: z.number().nonnegative().nullable(),
    gamesWithoutEstimate: z.number().int().nonnegative(),
    stalledGames: z.array(z.object({
      game: gameSchema,
      daysStalled: z.number().int().nonnegative(),
      remainingHours: z.number().nonnegative().nullable(),
    }).strict()),
  }).strict(),
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

const externalPlaytimeGroupSchema = z.object({
  key: z.string(),
  name: z.string(),
  hours: hoursSchema,
}).strict();

export const libraryStatsSchema = z.object({
  gameCount: z.number().int().nonnegative(),
  platformLinkCount: z.number().int().nonnegative(),
  playthroughCount: z.number().int().nonnegative(),
  playthroughsStarted: z.number().int().nonnegative(),
  playthroughsCompleted: z.number().int().nonnegative(),
  replaysStarted: z.number().int().nonnegative(),
  gamesWithCompletedPlaythrough: z.number().int().nonnegative(),
  gamesWithoutPlaythrough: z.number().int().nonnegative(),
  localPlayedHours: hoursSchema,
  externalPlaytimeHours: hoursSchema,
  externalPlaytimeByPlatform: z.array(externalPlaytimeGroupSchema),
}).strict();
export type LibraryStats = z.infer<typeof libraryStatsSchema>;

export const statsResponseSchema = z.object({
  library: libraryStatsSchema,
  totals: z.object({
    completedCount: z.number().int().nonnegative(),
    completedHours: hoursSchema,
    averageCompletedHours: hoursSchema.nullable(),
    longestGame: statsGameRefSchema.nullable(),
    shortestGame: statsGameRefSchema.nullable(),
    journeyStart: calendarDateSchema.nullable(),
    journeyDays: z.number().int().nonnegative(),
    completionRate: z.number().min(0).max(100),
    averageHoursPerGame: hoursSchema.nullable(),
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
  byReleaseYear: z.array(z.object({ year: z.number().int(), count: z.number().int().positive() }).strict()),
  byDeveloper: z.array(statsGroupSchema),
}).strict();
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type StatsGroup = z.infer<typeof statsGroupSchema>;

export const activityQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
}).strict();
export const activityResponseSchema = z.object({
  year: z.number().int(),
  days: z.array(z.object({ date: calendarDateSchema, minutes: z.number().int().positive() }).strict()),
  activeDays: z.number().int().nonnegative(),
  totalMinutes: z.number().int().nonnegative(),
  maxDayMinutes: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
}).strict();
export type ActivityResponse = z.infer<typeof activityResponseSchema>;

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().datetime().optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
}).strict();

const timelineGameRefSchema = z.object({
  gameId: z.string().uuid(),
  gameTitle: z.string(),
  coverUrl: mediaUrl.nullable(),
});
const timelineBaseSchema = z.object({ at: z.string().datetime(), date: calendarDateSchema });

export const timelineEventSchema = z.discriminatedUnion('type', [
  timelineBaseSchema.extend({ type: z.literal('GAME_ADDED') }).merge(timelineGameRefSchema).strict(),
  timelineBaseSchema.extend({ type: z.literal('GAME_STARTED') }).merge(timelineGameRefSchema).strict(),
  timelineBaseSchema.extend({ type: z.literal('GAME_COMPLETED') }).merge(timelineGameRefSchema).strict(),
  timelineBaseSchema.extend({
    type: z.literal('SESSION'),
    sessionId: z.string().uuid(),
    durationMinutes: z.number().int().nonnegative().nullable(),
    progress: z.number().int().min(0).max(100).nullable(),
    location: z.string().nullable(),
    notes: z.string().nullable(),
    keyDecisions: z.string().nullable(),
    tips: z.string().nullable(),
  }).merge(timelineGameRefSchema).strict(),
  timelineBaseSchema.extend({
    type: z.literal('CHALLENGE_COMPLETED'),
    title: z.string(),
    gamesCount: z.number().int().positive(),
  }).strict(),
]);

export const timelineResponseSchema = z.object({
  events: z.array(timelineEventSchema),
  nextBefore: z.string().datetime().nullable(),
}).strict();

export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;

export const replayResponseSchema = z.object({
  year: z.number().int(),
  totalMinutes: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  activeDays: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  mostPlayedGame: z.object({ id: z.string().uuid(), title: z.string(), coverUrl: mediaUrl.nullable(), minutes: z.number().int().positive() }).strict().nullable(),
  topGenre: z.object({ name: z.string(), minutes: z.number().int().positive() }).strict().nullable(),
  longestSession: z.object({ gameId: z.string().uuid(), title: z.string(), date: calendarDateSchema, minutes: z.number().int().positive() }).strict().nullable(),
  busiestMonth: z.object({ month: z.number().int().min(1).max(12), minutes: z.number().int().positive() }).strict().nullable(),
  gameOfYear: statsGameRefSchema.nullable(),
}).strict();
export type ReplayResponse = z.infer<typeof replayResponseSchema>;

export const goalKindSchema = z.enum(['COMPLETED_GAMES', 'PLAYED_HOURS']);
export const goalPeriodSchema = z.enum(['YEAR', 'MONTH']);
export const goalInputSchema = z.object({
  kind: goalKindSchema,
  period: goalPeriodSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  target: z.number().int().min(1).max(100000),
}).strict().superRefine((value, context) => {
  if (value.period === 'MONTH' && value.month === undefined) context.addIssue({ code: 'custom', path: ['month'], message: 'Informe o mês da meta mensal.' });
  if (value.period === 'YEAR' && value.month !== undefined) context.addIssue({ code: 'custom', path: ['month'], message: 'Metas anuais não têm mês.' });
});
export const goalTargetSchema = z.object({ target: z.number().int().min(1).max(100000) }).strict();
export const goalProgressSchema = z.object({
  id: z.string().uuid(),
  kind: goalKindSchema,
  period: goalPeriodSchema,
  year: z.number().int(),
  month: z.number().int().min(1).max(12).nullable(),
  target: z.number().int().positive(),
  current: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  elapsedPercent: z.number().min(0).max(100),
  achieved: z.boolean(),
  onTrack: z.boolean(),
}).strict();
export const goalsQuerySchema = z.object({ timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0) }).strict();
export type GoalInput = z.infer<typeof goalInputSchema>;
export type GoalProgress = z.infer<typeof goalProgressSchema>;

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

// Backup completo (ADR-014). Usa as mesmas formas da API; a integridade entre coleções é
// verificada à parte, em apps/api (findBackupIssues).
export const backupDataSchema = z.object({
  franchises: z.array(franchiseSchema),
  platforms: z.array(platformSchema),
  genres: z.array(genreSchema),
  games: z.array(gameSchema),
  sessions: z.array(sessionSchema.omit({ durationMinutes: true }).extend({
    keyDecisions: z.string().nullable().default(null),
    tips: z.string().nullable().default(null),
    playthroughId: z.string().uuid().nullable().default(null),
    platformId: z.string().uuid().nullable().default(null),
  })),
  gamePlatforms: z.array(gamePlatformSchema).default([]),
  playthroughs: z.array(playthroughSchema).default([]),
  screenshots: z.array(sessionScreenshotSchema),
  queue: z.array(z.object({ gameId: z.string().uuid(), position: z.number().int().nonnegative(), addedAt: z.string().datetime() }).strict()),
  lists: z.array(z.object({
    id: z.string().uuid(), name: z.string().trim().min(1).max(100), gameIds: z.array(z.string().uuid()),
    createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  }).strict()),
  challenge: z.object({ title: z.string().trim().min(1).max(200), listId: z.string().uuid() }).strict().nullable(),
  goals: z.array(z.object({
    id: z.string().uuid(), kind: goalKindSchema, period: goalPeriodSchema,
    year: z.number().int().min(2000).max(2100), month: z.number().int().min(0).max(12), target: z.number().int().min(1).max(100000),
  }).strict()),
  weeklyMinutes: z.number().int().min(0).max(10080),
}).strict();
export const backupSchema = z.object({
  app: z.literal('gameshelf'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  data: backupDataSchema,
}).strict();
export type BackupData = z.infer<typeof backupDataSchema>;
export type Backup = z.infer<typeof backupSchema>;
