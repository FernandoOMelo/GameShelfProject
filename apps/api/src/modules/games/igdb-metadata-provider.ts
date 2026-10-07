import { z } from 'zod';
import type { GameMetadataCandidate, GameMetadataProvider } from './metadata-provider.js';

const tokenResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const igdbGameSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  summary: z.string().optional(),
  first_release_date: z.number().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  artworks: z.array(z.object({ image_id: z.string() })).optional(),
  franchise: z.object({ name: z.string() }).optional(),
  involved_companies: z.array(z.object({
    developer: z.boolean().optional(),
    publisher: z.boolean().optional(),
    company: z.object({ name: z.string() }),
  })).optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  platforms: z.array(z.object({ name: z.string() })).optional(),
});
const igdbGamesSchema = z.array(igdbGameSchema).max(10);
const igdbLocalizationsSchema = z.array(z.object({
  game: z.number().int().positive(),
  name: z.string().min(1),
  region: z.number().int(),
}));
const BRAZIL_REGION = 11;

type Fetcher = typeof fetch;

export class IgdbMetadataProvider implements GameMetadataProvider {
  readonly id = 'igdb';
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async search(query: string): Promise<GameMetadataCandidate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || normalizedQuery.length > 100) throw new Error('A busca deve ter entre 1 e 100 caracteres.');

    const accessToken = await this.getAccessToken();
    const escapedQuery = normalizedQuery.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/[\r\n]/g, ' ');
    const response = await this.fetcher('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: `search "${escapedQuery}"; fields id,name,summary,game_localizations,first_release_date,cover.image_id,artworks.image_id,franchise.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,genres.name,platforms.name; where version_parent = null; limit 10;`,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`IGDB search failed with HTTP ${response.status}.`);

    const games = igdbGamesSchema.parse(await response.json());
    const localizedNames = await this.getBrazilianNames(games.map(({ id }) => id), accessToken);
    return games.map((game) => mapIgdbGame(game, localizedNames.get(game.id)));
  }

  private async getBrazilianNames(gameIds: number[], accessToken: string): Promise<Map<number, string>> {
    if (gameIds.length === 0) return new Map();
    const response = await this.fetcher('https://api.igdb.com/v4/game_localizations', {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: `fields game,name,region; where game = (${gameIds.join(',')}) & region = ${BRAZIL_REGION}; limit 10;`,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`IGDB localization lookup failed with HTTP ${response.status}.`);
    const localizations = igdbLocalizationsSchema.parse(await response.json());
    return new Map(localizations.map(({ game, name }) => [game, name]));
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;

    const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
    tokenUrl.searchParams.set('client_id', this.clientId);
    tokenUrl.searchParams.set('client_secret', this.clientSecret);
    tokenUrl.searchParams.set('grant_type', 'client_credentials');
    const response = await this.fetcher(tokenUrl, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`IGDB authentication failed with HTTP ${response.status}.`);

    const token = tokenResponseSchema.parse(await response.json());
    this.token = { value: token.access_token, expiresAt: this.now() + Math.max(0, token.expires_in - 60) * 1000 };
    return token.access_token;
  }
}

function mapIgdbGame(game: z.infer<typeof igdbGameSchema>, localizedTitle?: string): GameMetadataCandidate {
  const companies = game.involved_companies ?? [];
  const imageUrl = (imageId: string, size: string) => `https://images.igdb.com/igdb/image/upload/${size}/${encodeURIComponent(imageId)}.jpg`;
  const cover = game.cover?.image_id;
  const background = game.artworks?.[0]?.image_id;
  const releaseYear = game.first_release_date === undefined
    ? undefined
    : new Date(game.first_release_date * 1000).getUTCFullYear();

  return {
    providerId: String(game.id),
    title: localizedTitle ?? game.name,
    ...(game.summary !== undefined && { description: game.summary }),
    ...(cover && { coverUrl: imageUrl(cover, 't_cover_big') }),
    ...(background && { backgroundUrl: imageUrl(background, 't_1080p') }),
    ...(releaseYear && { releaseYear }),
    ...(companies.find((company) => company.developer)?.company.name && {
      developer: companies.find((company) => company.developer)!.company.name,
    }),
    ...(companies.find((company) => company.publisher)?.company.name && {
      publisher: companies.find((company) => company.publisher)!.company.name,
    }),
    ...(game.franchise && { franchise: game.franchise.name }),
    ...(game.genres && { genres: game.genres.map(({ name }) => name) }),
    ...(game.platforms && { platforms: game.platforms.map(({ name }) => name) }),
  };
}
