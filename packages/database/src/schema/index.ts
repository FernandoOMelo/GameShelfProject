import { pgEnum, pgTable, text, timestamp, integer, numeric, uuid, check, primaryKey, boolean, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const franchises = pgTable('franchises', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const platforms = pgTable('platforms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const genres = pgTable('genres', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameStatus = pgEnum('game_status', [
  'DESIRED', 'BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED',
]);

export const gamePriority = pgEnum('game_priority', ['LOW', 'NORMAL', 'HIGH']);

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
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  progress: integer('progress'),
  location: text('location'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('sessions_ended_at_not_before_started_at', sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`),
  check('sessions_progress_valid', sql`${table.progress} IS NULL OR ${table.progress} BETWEEN 0 AND 100`),
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
