import { type AnyPgColumn, pgEnum, pgTable, text, timestamp, integer, numeric, uuid, check, primaryKey, boolean, date, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const franchises = pgTable('franchises', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Catálogo em dois níveis (ADR-025): uma plataforma sem `parent_id` é um grupo
// (PC, PlayStation); uma com `parent_id` é uma loja ou variante dentro dele
// (Steam, GOG). Só dois níveis: um grupo não pode ter avô. A profundidade é
// garantida na fronteira da API, não no banco, porque exigiria um gatilho.
export const platforms = pgTable('platforms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  parentId: uuid('parent_id').references((): AnyPgColumn => platforms.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('platforms_parent_idx').on(table.parentId),
  check('platforms_parent_not_self', sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`),
]);

export const genres = pgTable('genres', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameStatus = pgEnum('game_status', [
  'DESIRED', 'BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED',
]);

export const gamePriority = pgEnum('game_priority', ['LOW', 'NORMAL', 'HIGH']);

export const goalKind = pgEnum('goal_kind', ['COMPLETED_GAMES', 'PLAYED_HOURS']);
export const goalPeriod = pgEnum('goal_period', ['YEAR', 'MONTH']);
export const gameDifficulty = pgEnum('game_difficulty', ['C', 'B', 'A', 'AA', 'AAA']);

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  backgroundUrl: text('background_url'),
  releaseYear: integer('release_year'),
  developer: text('developer'),
  publisher: text('publisher'),
  franchiseId: uuid('franchise_id').references(() => franchises.id, { onDelete: 'restrict' }),
  platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'set null' }),
  status: gameStatus('status').notNull().default('BACKLOG'),
  owned: boolean('owned').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  startedAt: date('started_at'),
  completedAt: date('completed_at'),
  priority: gamePriority('priority').notNull().default('NORMAL'),
  estimatedMainHours: numeric('estimated_main_hours', { precision: 8, scale: 2 }),
  estimatedCompletionistHours: numeric('estimated_completionist_hours', { precision: 8, scale: 2 }),
  personalEstimatedHours: numeric('personal_estimated_hours', { precision: 8, scale: 2 }),
  retroactivePlayedHours: numeric('retroactive_played_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  rating: integer('rating'),
  difficulty: gameDifficulty('difficulty'),
  gameType: text('game_type'),
  completionCondition: text('completion_condition'),
  favorite: boolean('favorite').notNull().default(false),
  gameOfYear: boolean('game_of_year').notNull().default(false),
  excludedFromSuggestions: boolean('excluded_from_suggestions').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('games_title_not_blank', sql`length(trim(${table.title})) > 0`),
  check('games_release_year_valid', sql`${table.releaseYear} IS NULL OR ${table.releaseYear} BETWEEN 1 AND 9999`),
  check('games_estimated_main_hours_nonnegative', sql`${table.estimatedMainHours} IS NULL OR ${table.estimatedMainHours} >= 0`),
  check('games_estimated_completionist_hours_nonnegative', sql`${table.estimatedCompletionistHours} IS NULL OR ${table.estimatedCompletionistHours} >= 0`),
  check('games_personal_estimated_hours_nonnegative', sql`${table.personalEstimatedHours} IS NULL OR ${table.personalEstimatedHours} >= 0`),
  check('games_retroactive_played_hours_nonnegative', sql`${table.retroactivePlayedHours} >= 0`),
  check('games_game_of_year_requires_completion', sql`NOT ${table.gameOfYear} OR ${table.completedAt} IS NOT NULL`),
  check('games_rating_valid', sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 1 AND 11`),
  check('games_completion_not_before_start', sql`${table.startedAt} IS NULL OR ${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
]);

export const gameGenres = pgTable('game_genres', {
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  genreId: uuid('genre_id').notNull().references(() => genres.id, { onDelete: 'restrict' }),
}, (table) => [primaryKey({ columns: [table.gameId, table.genreId] })]);

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  // Jornada e plataforma da sessão são opcionais: sessões antigas e sessões sem
  // informação confiável permanecem válidas sem vínculo.
  playthroughId: uuid('playthrough_id').references((): AnyPgColumn => playthroughs.id, { onDelete: 'set null' }),
  platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  progress: integer('progress'),
  location: text('location'),
  notes: text('notes'),
  keyDecisions: text('key_decisions'),
  tips: text('tips'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('sessions_ended_at_not_before_started_at', sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`),
  check('sessions_progress_valid', sql`${table.progress} IS NULL OR ${table.progress} BETWEEN 0 AND 100`),
  index('sessions_playthrough_idx').on(table.playthroughId),
]);

export const queueEntries = pgTable('queue_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().unique().references(() => games.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check('queue_entries_position_nonnegative', sql`${table.position} >= 0`)]);

export const gameLists = pgTable('game_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check('game_lists_name_not_blank', sql`length(trim(${table.name})) > 0`)]);

export const gameListEntries = pgTable('game_list_entries', {
  listId: uuid('list_id').notNull().references(() => gameLists.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.listId, table.gameId] })]);

export const planningSettings = pgTable('planning_settings', {
  id: integer('id').primaryKey().default(1),
  weeklyMinutes: integer('weekly_minutes').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('planning_settings_singleton_id', sql`${table.id} = 1`),
  check('planning_settings_weekly_minutes_nonnegative', sql`${table.weeklyMinutes} >= 0`),
]);

export const mainChallenge = pgTable('main_challenge', {
  id: integer('id').primaryKey().default(1),
  title: text('title').notNull(),
  listId: uuid('list_id').notNull().references(() => gameLists.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('main_challenge_singleton_id', sql`${table.id} = 1`),
  check('main_challenge_title_not_blank', sql`length(trim(${table.title})) > 0`),
]);

export const savedFilters = pgTable('saved_filters', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  filters: jsonb('filters').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check('saved_filters_name_not_blank', sql`length(trim(${table.name})) > 0`)]);

export const challengeCompletions = pgTable('challenge_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  listId: uuid('list_id').references(() => gameLists.id, { onDelete: 'set null' }),
  gamesCount: integer('games_count').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('challenge_completions_list_games_count_unique').on(table.listId, table.gamesCount),
  check('challenge_completions_games_count_positive', sql`${table.gamesCount} > 0`),
]);

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: goalKind('kind').notNull(),
  period: goalPeriod('period').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull().default(0),
  target: integer('target').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('goals_kind_period_year_month_unique').on(table.kind, table.period, table.year, table.month),
  check('goals_target_positive', sql`${table.target} > 0`),
  check('goals_period_month', sql`(${table.period} = 'YEAR' AND ${table.month} = 0) OR (${table.period} = 'MONTH' AND ${table.month} BETWEEN 1 AND 12)`),
]);

export const sessionScreenshots = pgTable('session_screenshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('session_screenshots_session_id_idx').on(table.sessionId)]);


// ── Plataformas associadas e jornadas (ADR-023) ─────────────────────────────
// `games` continua sendo o cadastro canônico. `game_platforms` reintroduz a
// associação múltipla que o ADR-007 havia consolidado; `games.platform_id`
// permanece como plataforma principal, um resumo de exibição, nunca uma
// restrição sobre onde as sessões aconteceram.

export const gamePlatformFormat = pgEnum('game_platform_format', ['PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'CLOUD']);

export const gamePlatforms = pgTable('game_platforms', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id').notNull().references(() => platforms.id, { onDelete: 'restrict' }),
  edition: text('edition'),
  format: gamePlatformFormat('format'),
  owned: boolean('owned').notNull().default(false),
  isPrimary: boolean('is_primary').notNull().default(false),
  // Proveniência externa, preenchida apenas pela importação. `external_playtime_minutes`
  // nulo significa "a fonte não informa", nunca zero, e nunca se soma às sessões locais.
  externalSource: text('external_source'),
  externalId: text('external_id'),
  externalAccountLabel: text('external_account_label'),
  externalPlaytimeMinutes: integer('external_playtime_minutes'),
  externalLastPlayedAt: timestamp('external_last_played_at', { withTimezone: true }),
  externalSyncedAt: timestamp('external_synced_at', { withTimezone: true }),
  // Quanto do tempo externo já foi lançado como horas retroativas do jogo
  // (ADR-026). Guardar o que já foi lançado é o que torna a ação idempotente e
  // o que permite lançar só a diferença quando a fonte reporta mais tempo.
  externalPlaytimeImportedMinutes: integer('external_playtime_imported_minutes').notNull().default(0),
  // Se o tempo informado por esta plataforma entra no total consolidado da
  // biblioteca (ADR-027). Desligado por padrão: ligar sem conferir inflaria o
  // total de um jogo que já tem sessões registradas aqui.
  countsTowardTotal: boolean('counts_toward_total').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Edições diferentes da mesma plataforma são associações legítimas; `coalesce`
  // porque em Postgres duas linhas com edition nula não colidiriam.
  uniqueIndex('game_platforms_game_platform_edition_unique').on(table.gameId, table.platformId, sql`coalesce(${table.edition}, '')`),
  uniqueIndex('game_platforms_external_unique').on(table.externalSource, table.externalId).where(sql`${table.externalSource} IS NOT NULL AND ${table.externalId} IS NOT NULL`),
  uniqueIndex('game_platforms_single_primary').on(table.gameId).where(sql`${table.isPrimary}`),
  index('game_platforms_game_idx').on(table.gameId),
  check('game_platforms_edition_not_blank', sql`${table.edition} IS NULL OR length(trim(${table.edition})) > 0`),
  check('game_platforms_external_playtime_nonnegative', sql`${table.externalPlaytimeMinutes} IS NULL OR ${table.externalPlaytimeMinutes} >= 0`),
  check('game_platforms_external_pair', sql`(${table.externalSource} IS NULL) = (${table.externalId} IS NULL)`),
  check('game_platforms_imported_nonnegative', sql`${table.externalPlaytimeImportedMinutes} >= 0`),
]);

export const playthroughStatus = pgEnum('playthrough_status', ['PLANNED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED']);

// Uma jornada é uma experiência contínua de jogo: zero, uma ou várias por jogo.
// `sequence` ordena as jornadas do jogo e define o que é replay (sequence > 1).
// Não há plataforma obrigatória; a plataforma é registrada por sessão.
export const playthroughs = pgTable('playthroughs', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  label: text('label'),
  status: playthroughStatus('status').notNull().default('PLANNED'),
  primaryPlatformId: uuid('primary_platform_id').references(() => platforms.id, { onDelete: 'set null' }),
  startedAt: date('started_at'),
  completedAt: date('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('playthroughs_game_sequence_unique').on(table.gameId, table.sequence),
  index('playthroughs_game_idx').on(table.gameId),
  check('playthroughs_sequence_positive', sql`${table.sequence} > 0`),
  check('playthroughs_label_not_blank', sql`${table.label} IS NULL OR length(trim(${table.label})) > 0`),
  check('playthroughs_completion_not_before_start', sql`${table.startedAt} IS NULL OR ${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
  // Uma jornada concluída sempre registra a data da conclusão.
  check('playthroughs_completed_requires_date', sql`${table.status} <> 'COMPLETED' OR ${table.completedAt} IS NOT NULL`),
  // Planejada é o único estado que ainda não começou: datas ficam vazias e ela
  // não conta como jornada iniciada.
  check('playthroughs_planned_has_no_dates', sql`${table.status} <> 'PLANNED' OR (${table.startedAt} IS NULL AND ${table.completedAt} IS NULL)`),
]);

export const externalMatchStatus = pgEnum('external_match_status', ['PENDING', 'IGNORED']);

// Fila de correspondências a confirmar (ADR-024). A fonte externa não expõe
// `igdb_id`, então um jogo externo só vira associação de plataforma depois que o
// usuário confirma. Cada linha é o retrato da entrada externa, não um vínculo:
// o vínculo confirmado vive em `game_platforms.external_source/external_id`.
// Confirmar remove a linha; ignorar a mantém para que a próxima sincronização
// não volte a propor a mesma entrada.
export const externalGameMatches = pgTable('external_game_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  platformName: text('platform_name').notNull(),
  accountLabel: text('account_label'),
  playtimeMinutes: integer('playtime_minutes'),
  lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
  status: externalMatchStatus('status').notNull().default('PENDING'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('external_game_matches_source_external_unique').on(table.source, table.externalId),
  index('external_game_matches_status_idx').on(table.status),
  check('external_game_matches_title_not_blank', sql`length(trim(${table.title})) > 0`),
  // Nulo significa "a fonte não informa", nunca zero.
  check('external_game_matches_playtime_nonnegative', sql`${table.playtimeMinutes} IS NULL OR ${table.playtimeMinutes} >= 0`),
]);
