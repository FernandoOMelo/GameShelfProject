import { asc, eq, rawgAchievements, rawgGameLinks, type Database } from '@gameshelf/database';
import type { RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';

export type RawgAchievementProvider = { search(query: string): Promise<RawgAchievementCandidate[]>; achievements(id: number): Promise<RawgAchievement[]> };
export type RawgAchievementRepository = {
  get(gameId: string): Promise<{ linkedGame: RawgAchievementCandidate | null; achievements: RawgAchievement[]; refreshedAt: string | null }>;
  replace(gameId: string, candidate: RawgAchievementCandidate, achievements: RawgAchievement[]): Promise<{ linkedGame: RawgAchievementCandidate | null; achievements: RawgAchievement[]; refreshedAt: string | null }>;
};

export class RawgClient implements RawgAchievementProvider {
  constructor(private readonly key: string, private readonly fetcher: typeof fetch = fetch) {}
  async search(query: string) {
    const url = new URL('https://api.rawg.io/api/games');
    url.searchParams.set('key', this.key); url.searchParams.set('search', query); url.searchParams.set('search_precise', 'true'); url.searchParams.set('page_size', '5');
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`RAWG search failed with HTTP ${response.status}.`);
    const body = await response.json() as { results?: Array<{ id: number; slug: string; name: string; released?: string | null; background_image?: string | null }> };
    return (body.results ?? []).filter((item) => Number.isInteger(item.id) && item.id > 0 && item.slug && item.name).map((item) => ({ id: item.id, slug: item.slug, name: item.name, released: item.released ?? null, backgroundImage: item.background_image ?? null }));
  }
  async achievements(id: number) {
    const url = new URL(`https://api.rawg.io/api/games/${id}/achievements`); url.searchParams.set('key', this.key);
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`RAWG achievements failed with HTTP ${response.status}.`);
    const body = await response.json() as { results?: Array<{ id: number; name: string; description?: string | null; image?: string | null; percent?: string | number | null }> };
    return (body.results ?? []).filter((item) => Number.isInteger(item.id) && item.id > 0 && item.name?.trim()).map((item) => ({ id: crypto.randomUUID(), rawgId: item.id, name: item.name.trim(), description: item.description?.trim() || null, imageUrl: item.image ?? null, percent: item.percent == null || !Number.isFinite(Number(item.percent)) ? null : Number(item.percent) }));
  }
}

export class DrizzleRawgAchievementRepository implements RawgAchievementRepository {
  constructor(private readonly db: Database) {}
  async get(gameId: string) {
    const [link] = await this.db.select().from(rawgGameLinks).where(eq(rawgGameLinks.gameId, gameId));
    if (!link) return { linkedGame: null, achievements: [], refreshedAt: null };
    const rows = await this.db.select().from(rawgAchievements).where(eq(rawgAchievements.rawgGameLinkId, link.id)).orderBy(asc(rawgAchievements.name));
    return { linkedGame: { id: link.rawgId, slug: link.slug, name: link.name, released: link.released ?? null, backgroundImage: link.backgroundImage ?? null }, achievements: rows.map((row) => ({ id: row.id, rawgId: row.rawgId, name: row.name, description: row.description, imageUrl: row.imageUrl, percent: row.percent === null ? null : Number(row.percent) })), refreshedAt: link.syncedAt.toISOString() };
  }
  async replace(gameId: string, candidate: RawgAchievementCandidate, achievements: RawgAchievement[]) {
    await this.db.transaction(async (tx) => {
      const [link] = await tx.insert(rawgGameLinks).values({ gameId, rawgId: candidate.id, slug: candidate.slug, name: candidate.name, released: candidate.released, backgroundImage: candidate.backgroundImage, syncedAt: new Date() })
        .onConflictDoUpdate({ target: rawgGameLinks.gameId, set: { rawgId: candidate.id, slug: candidate.slug, name: candidate.name, released: candidate.released, backgroundImage: candidate.backgroundImage, syncedAt: new Date() } }).returning();
      await tx.delete(rawgAchievements).where(eq(rawgAchievements.rawgGameLinkId, link.id));
      if (achievements.length) await tx.insert(rawgAchievements).values(achievements.map((item) => ({ rawgGameLinkId: link.id, rawgId: item.rawgId, name: item.name, description: item.description, imageUrl: item.imageUrl, percent: item.percent === null ? null : String(item.percent) })));
    });
    return this.get(gameId);
  }
}
