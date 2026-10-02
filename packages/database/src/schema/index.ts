import { pgEnum, pgTable, text, timestamp, integer, numeric, uuid, check, primaryKey } from 'drizzle-orm/pg-core';
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
  'BACKLOG', 'QUEUED', 'PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED',
]);

export const gamePriority = pgEnum('game_priority', ['LOW', 'NORMAL', 'HIGH']);

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
  status: gameStatus('status').notNull().default('BACKLOG'),
  priority: gamePriority('priority').notNull().default('NORMAL'),
  estimatedMainHours: numeric('estimated_main_hours', { precision: 8, scale: 2 }),
  estimatedCompletionistHours: numeric('estimated_completionist_hours', { precision: 8, scale: 2 }),
  personalEstimatedHours: numeric('personal_estimated_hours', { precision: 8, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('games_title_not_blank', sql`length(trim(${table.title})) > 0`),
  check('games_release_year_valid', sql`${table.releaseYear} IS NULL OR ${table.releaseYear} BETWEEN 1 AND 9999`),
  check('games_estimated_main_hours_nonnegative', sql`${table.estimatedMainHours} IS NULL OR ${table.estimatedMainHours} >= 0`),
  check('games_estimated_completionist_hours_nonnegative', sql`${table.estimatedCompletionistHours} IS NULL OR ${table.estimatedCompletionistHours} >= 0`),
  check('games_personal_estimated_hours_nonnegative', sql`${table.personalEstimatedHours} IS NULL OR ${table.personalEstimatedHours} >= 0`),
]);

export const gamePlatforms = pgTable('game_platforms', {
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id').notNull().references(() => platforms.id, { onDelete: 'restrict' }),
}, (table) => [primaryKey({ columns: [table.gameId, table.platformId] })]);

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

export const planningSettings = pgTable('planning_settings', {
  id: integer('id').primaryKey().default(1),
  weeklyMinutes: integer('weekly_minutes').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('planning_settings_singleton_id', sql`${table.id} = 1`),
  check('planning_settings_weekly_minutes_nonnegative', sql`${table.weeklyMinutes} >= 0`),
]);
