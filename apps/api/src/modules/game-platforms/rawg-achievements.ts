import { asc, eq, rawgAchievements, rawgGameLinks, type Database } from '@gameshelf/database';
import type { RawgAchievement, RawgAchievementCandidate } from '@gameshelf/contracts';

export type RawgAchievementProvider = { search(query: string): Promise<RawgAchievementCandidate[]>; achievements(id: number): Promise<RawgAchievement[]> };
export type RawgAchievementRepository = {
  get(gameId: string): Promise<{ linkedGame: RawgAchievementCandidate | null; achievements: RawgAchievement[]; refreshedAt: string | null }>;
  replace(gameId: string, candidate: RawgAchievementCandidate, achievements: RawgAchievement[]): Promise<{ linkedGame: RawgAchievementCandidate | null; achievements: RawgAchievement[]; refreshedAt: string | null }>;
};

const normalizeTitle = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Procura o jogo na RAWG por título (e ano, quando ajuda a desempatar) e grava
 * o catálogo de conquistas. Devolve `false` quando nada foi encontrado. Falhas
 * de rede sobem para quem chamou decidir se importam.
 */
export async function linkRawgCatalog(
  provider: RawgAchievementProvider,
  store: RawgAchievementRepository,
  game: { id: string; title: string; releaseYear: number | null },
): Promise<boolean> {
  const candidates = await provider.search(game.title);
  if (candidates.length === 0) return false;
  const target = normalizeTitle(game.title);
  const candidate = candidates.find((item) => normalizeTitle(item.name) === target)
    ?? (game.releaseYear ? candidates.find((item) => item.released?.slice(0, 4) === String(game.releaseYear)) : undefined)
    ?? candidates[0]!;
  await store.replace(game.id, candidate, await provider.achievements(candidate.id));
  return true;
}

/**
 * Vincula o catálogo RAWG sob demanda, no máximo uma vez por janela por jogo e
 * sem duplicar tentativas simultâneas: abrir a ficha dispara mais de uma
 * leitura de conquistas ao mesmo tempo, e a RAWG tem cota.
 */
export function createRawgLinkAttempts(provider: RawgAchievementProvider, store: RawgAchievementRepository, cooldownMs = 10 * 60_000) {
  const lastAttempt = new Map<string, number>();
  const inFlight = new Map<string, Promise<boolean>>();
  return (game: { id: string; title: string; releaseYear: number | null }): Promise<boolean> => {
    const running = inFlight.get(game.id);
    if (running) return running;
    const previous = lastAttempt.get(game.id);
    if (previous !== undefined && Date.now() - previous < cooldownMs) return Promise.resolve(false);
    lastAttempt.set(game.id, Date.now());
    const attempt = linkRawgCatalog(provider, store, game).catch(() => false).finally(() => { inFlight.delete(game.id); });
    inFlight.set(game.id, attempt);
    return attempt;
  };
}

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
    // A RAWG pagina as conquistas (10 por página por padrão): segue `next` até o fim.
    type Item = { id: number; name: string; description?: string | null; image?: string | null; percent?: string | number | null };
    const items: Item[] = [];
    let next: string | null = (() => { const url = new URL(`https://api.rawg.io/api/games/${id}/achievements`); url.searchParams.set('key', this.key); url.searchParams.set('page_size', '40'); return url.toString(); })();
    for (let page = 0; next && page < 10; page += 1) {
      const response = await this.fetcher(next, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`RAWG achievements failed with HTTP ${response.status}.`);
      const body = await response.json() as { next?: string | null; results?: Item[] };
      items.push(...(body.results ?? []));
      next = body.next ?? null;
    }
    return items.filter((item) => Number.isInteger(item.id) && item.id > 0 && item.name?.trim()).map((item) => ({ id: crypto.randomUUID(), rawgId: item.id, name: item.name.trim(), description: item.description?.trim() || null, imageUrl: item.image ?? null, percent: item.percent == null || !Number.isFinite(Number(item.percent)) ? null : Number(item.percent) }));
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
