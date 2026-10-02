import { eq, games, gameGenres, gamePlatforms, genres, platforms, type Database } from '@gameshelf/database';
import type { GameInput, GameUpdate } from '@gameshelf/contracts';
import type { GameRepository, GameRecord } from './repository.js';

export class DrizzleGameRepository implements GameRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<GameRecord[]> {
    const records = await this.db.select().from(games).orderBy(games.title);
    return Promise.all(records.map((game) => this.withRelations(game)));
  }

  async find(id: string): Promise<GameRecord | undefined> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id)).limit(1);
    return game ? this.withRelations(game) : undefined;
  }

  async create(input: GameInput): Promise<GameRecord> {
    return this.db.transaction(async (tx) => {
      const { platformIds, genreIds, ...fields } = input;
      const [game] = await tx.insert(games).values(normalizeCreateInput(fields)).returning();
      if (platformIds?.length) await tx.insert(gamePlatforms).values(platformIds.map((platformId) => ({ gameId: game.id, platformId })));
      if (genreIds?.length) await tx.insert(gameGenres).values(genreIds.map((genreId) => ({ gameId: game.id, genreId })));
      return { ...game, platformIds: platformIds ?? [], genreIds: genreIds ?? [] };
    });
  }

  async update(id: string, input: GameUpdate): Promise<GameRecord | undefined> {
    return this.db.transaction(async (tx) => {
      const { platformIds, genreIds, ...fields } = input;
      const values = normalizeUpdateInput(fields);
      const [game] = await tx.update(games).set({ ...values, updatedAt: new Date() })
        .where(eq(games.id, id)).returning();
      if (!game) return undefined;
      if (platformIds !== undefined) {
        await tx.delete(gamePlatforms).where(eq(gamePlatforms.gameId, id));
        if (platformIds.length) await tx.insert(gamePlatforms).values(platformIds.map((platformId) => ({ gameId: id, platformId })));
      }
      if (genreIds !== undefined) {
        await tx.delete(gameGenres).where(eq(gameGenres.gameId, id));
        if (genreIds.length) await tx.insert(gameGenres).values(genreIds.map((genreId) => ({ gameId: id, genreId })));
      }
      return {
        ...game,
        platformIds: platformIds ?? (await tx.select({ platformId: gamePlatforms.platformId }).from(gamePlatforms).where(eq(gamePlatforms.gameId, id))).map((row) => row.platformId),
        genreIds: genreIds ?? (await tx.select({ genreId: gameGenres.genreId }).from(gameGenres).where(eq(gameGenres.gameId, id))).map((row) => row.genreId),
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(games).where(eq(games.id, id)).returning({ id: games.id });
    return deleted.length > 0;
  }

  private async withRelations(game: Omit<GameRecord, 'platformIds' | 'genreIds'>): Promise<GameRecord> {
    const [platformRows, genreRows] = await Promise.all([
      this.db.select({ id: gamePlatforms.platformId }).from(gamePlatforms)
        .innerJoin(platforms, eq(gamePlatforms.platformId, platforms.id)).where(eq(gamePlatforms.gameId, game.id)),
      this.db.select({ id: gameGenres.genreId }).from(gameGenres)
        .innerJoin(genres, eq(gameGenres.genreId, genres.id)).where(eq(gameGenres.gameId, game.id)),
    ]);
    return { ...game, platformIds: platformRows.map((row) => row.id), genreIds: genreRows.map((row) => row.id) };
  }
}

function normalizeHours<T extends { estimatedMainHours?: number | null; estimatedCompletionistHours?: number | null; personalEstimatedHours?: number | null }>(input: T) {
  const {
    estimatedMainHours,
    estimatedCompletionistHours,
    personalEstimatedHours,
    ...fields
  } = input;
  return {
    ...fields,
    ...(estimatedMainHours !== undefined && { estimatedMainHours: estimatedMainHours?.toString() ?? null }),
    ...(estimatedCompletionistHours !== undefined && { estimatedCompletionistHours: estimatedCompletionistHours?.toString() ?? null }),
    ...(personalEstimatedHours !== undefined && { personalEstimatedHours: personalEstimatedHours?.toString() ?? null }),
  };
}

function normalizeCreateInput(input: GameInput) {
  return normalizeHours(input);
}

function normalizeUpdateInput(input: GameUpdate) {
  return normalizeHours(input);
}
