import { eq, games, gameGenres, genres, sql, type Database } from '@gameshelf/database';
import type { GameInput, GameUpdate } from '@gameshelf/contracts';
import type { GameRepository, GameRecord } from './repository.js';

export class DrizzleGameRepository implements GameRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<GameRecord[]> {
    const records = await this.db.select().from(games).orderBy(games.title);
    return Promise.all(records.map((game) => this.withRelations(game as unknown as Omit<GameRecord, 'genreIds'>)));
  }

  async find(id: string): Promise<GameRecord | undefined> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id)).limit(1);
    return game ? this.withRelations(game as unknown as Omit<GameRecord, 'genreIds'>) : undefined;
  }

  async create(input: GameInput): Promise<GameRecord> {
    return this.db.transaction(async (tx) => {
      const { genreIds, startedAt, completedAt, ...fields } = input;
      const [game] = await tx.insert(games).values(normalizeCreateInput({ ...fields, startedAt: startedAt ?? null, completedAt: completedAt ?? null })).returning();
      if (genreIds?.length) await tx.insert(gameGenres).values(genreIds.map((genreId) => ({ gameId: game.id, genreId })));
      await keepSingleGameOfYear(tx, game);
      return { ...(game as unknown as GameRecord), genreIds: genreIds ?? [] };
    });
  }

  async update(id: string, input: GameUpdate): Promise<GameRecord | undefined> {
    return this.db.transaction(async (tx) => {
      const { genreIds, ...fields } = input;
      const [game] = await tx.update(games).set({ ...normalizeUpdateInput(fields), updatedAt: new Date() })
        .where(eq(games.id, id)).returning();
      if (!game) return undefined;
      await keepSingleGameOfYear(tx, game);
      if (genreIds !== undefined) {
        await tx.delete(gameGenres).where(eq(gameGenres.gameId, id));
        if (genreIds.length) await tx.insert(gameGenres).values(genreIds.map((genreId) => ({ gameId: id, genreId })));
      }
      const genreRows = await tx.select({ id: gameGenres.genreId }).from(gameGenres).where(eq(gameGenres.gameId, id));
      return { ...(game as unknown as GameRecord), genreIds: genreIds ?? genreRows.map((row) => row.id) };
    });
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(games).where(eq(games.id, id)).returning({ id: games.id });
    return deleted.length > 0;
  }

  private async withRelations(game: Omit<GameRecord, 'genreIds'>): Promise<GameRecord> {
    const genreRows = await this.db.select({ id: gameGenres.genreId }).from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id)).where(eq(gameGenres.gameId, game.id));
    return { ...game, genreIds: genreRows.map((row) => row.id) };
  }
}

// Only one game per completion year can carry the "game of the year" mark.
async function keepSingleGameOfYear(tx: Pick<Database, 'update'>, game: { id: string; gameOfYear: boolean; completedAt: string | null }) {
  if (!game.gameOfYear || !game.completedAt) return;
  const year = Number(game.completedAt.slice(0, 4));
  await tx.update(games).set({ gameOfYear: false })
    .where(sql`${games.gameOfYear} AND ${games.id} <> ${game.id} AND extract(year from ${games.completedAt}) = ${year}`);
}

function normalizeHours<T extends { estimatedMainHours?: number | null; estimatedCompletionistHours?: number | null; personalEstimatedHours?: number | null; retroactivePlayedHours?: number }>(input: T) {
  const { estimatedMainHours, estimatedCompletionistHours, personalEstimatedHours, retroactivePlayedHours, ...fields } = input;
  return {
    ...fields,
    ...(estimatedMainHours !== undefined && { estimatedMainHours: estimatedMainHours?.toString() ?? null }),
    ...(estimatedCompletionistHours !== undefined && { estimatedCompletionistHours: estimatedCompletionistHours?.toString() ?? null }),
    ...(personalEstimatedHours !== undefined && { personalEstimatedHours: personalEstimatedHours?.toString() ?? null }),
    ...(retroactivePlayedHours !== undefined && { retroactivePlayedHours: retroactivePlayedHours.toString() }),
  };
}

function normalizeCreateInput(input: GameInput) { return normalizeHours(input); }
function normalizeUpdateInput(input: GameUpdate) { return normalizeHours(input); }
