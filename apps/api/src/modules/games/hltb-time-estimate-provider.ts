import { z } from 'zod';
import type { GameTimeEstimate, GameTimeEstimateProvider } from './time-estimate-provider.js';

/** HowLongToBeat has no public API. This client follows the reverse-engineered
 * website protocol: discover the current search path from the Next.js build
 * manifest, fetch a short-lived auth token from its `/init` route, then search.
 * See ADR-019.
 */
const BASE_URL = 'https://howlongtobeat.com/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_TTL_MS = 5 * 60 * 1000;
/** hltb keeps around 20 results; the API contract accepts at most 10. */
const REQUEST_SIZE = 20;
const RESULT_LIMIT = 10;

const authResponseSchema = z.object({
  token: z.string().min(1),
  hpKey: z.union([z.string(), z.number()]).optional(),
  hpVal: z.union([z.string(), z.number()]).optional(),
});
const hltbEntrySchema = z.object({
  game_id: z.number().int().positive(),
  game_name: z.string().min(1),
  release_world: z.number().int().optional(),
  comp_main: z.number().optional(),
  comp_plus: z.number().optional(),
  comp_100: z.number().optional(),
}).passthrough();
const searchResponseSchema = z.object({ data: z.array(hltbEntrySchema) });

type Fetcher = typeof fetch;
type HltbEntry = z.infer<typeof hltbEntrySchema>;
type HltbAuth = { token: string; key?: string; value?: string; expiresAt: number };

export class HltbTimeEstimateProvider implements GameTimeEstimateProvider {
  readonly id = 'howlongtobeat';
  private endpoint?: string;
  private auth?: HltbAuth;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async search(query: string): Promise<GameTimeEstimate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || normalizedQuery.length > 100) throw new Error('A busca deve ter entre 1 e 100 caracteres.');

    let payload: z.infer<typeof searchResponseSchema>;
    try {
      payload = await this.requestSearch(normalizedQuery);
    } catch (firstFailure) {
      // The site rotates both the search path and the auth token without notice.
      // Drop every cached value and try once more before giving up.
      this.endpoint = undefined;
      this.auth = undefined;
      try {
        payload = await this.requestSearch(normalizedQuery);
      } catch {
        throw firstFailure instanceof Error ? firstFailure : new Error('HowLongToBeat request failed.');
      }
    }

    return payload.data.slice(0, RESULT_LIMIT).map(mapHltbEntry);
  }

  private async requestSearch(query: string): Promise<z.infer<typeof searchResponseSchema>> {
    const endpoint = await this.getSearchUrl();
    const auth = await this.getAuth(endpoint);
    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: this.searchHeaders(auth),
      body: JSON.stringify(searchBody(query, auth)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HowLongToBeat search failed with HTTP ${response.status}.`);
    return searchResponseSchema.parse(await response.json());
  }

  private async getSearchUrl(): Promise<string> {
    if (this.endpoint) return this.endpoint;

    const homepage = await this.fetchText(BASE_URL);
    const path = (await this.searchPathFromManifest(homepage)) ?? (await this.searchPathFromChunks(homepage));
    if (!path) throw new Error('Não foi possível localizar a API do HowLongToBeat no site.');
    this.endpoint = new URL(path, BASE_URL).toString();
    return this.endpoint;
  }

  private async searchPathFromManifest(homepage: string): Promise<string | null> {
    const manifestSource = homepage.match(/"(\/_next\/static\/[^"]+\/_buildManifest\.js)"/)?.[1];
    if (!manifestSource) return null;
    const manifest = await this.fetchText(new URL(manifestSource, BASE_URL).toString());
    return findSearchPath(collectApiPaths(manifest));
  }

  private async searchPathFromChunks(homepage: string): Promise<string | null> {
    const sources = [...new Set([...homepage.matchAll(/"(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((match) => match[1]!))];
    const paths = new Set<string>();
    for (const source of sources) {
      const chunk = await this.fetchText(new URL(source, BASE_URL).toString());
      for (const path of collectApiPaths(chunk)) paths.add(path);
    }
    return findSearchPath(paths);
  }

  private async getAuth(endpoint: string): Promise<HltbAuth> {
    if (this.auth && this.auth.expiresAt > this.now()) return this.auth;

    const response = await this.fetcher(`${endpoint}/init?t=${this.now()}`, {
      headers: { 'User-Agent': USER_AGENT, referer: BASE_URL },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HowLongToBeat authentication failed with HTTP ${response.status}.`);

    const data = authResponseSchema.parse(await response.json());
    this.auth = {
      token: data.token,
      ...(data.hpKey !== undefined && { key: String(data.hpKey) }),
      ...(data.hpVal !== undefined && { value: String(data.hpVal) }),
      expiresAt: this.now() + TOKEN_TTL_MS,
    };
    return this.auth;
  }

  private async fetchText(url: string): Promise<string> {
    const response = await this.fetcher(url, { headers: { 'User-Agent': USER_AGENT, referer: BASE_URL }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HowLongToBeat request failed with HTTP ${response.status}.`);
    return response.text();
  }

  private searchHeaders(auth: HltbAuth) {
    return {
      'Content-Type': 'application/json',
      Origin: 'https://howlongtobeat.com',
      Referer: BASE_URL,
      'User-Agent': USER_AGENT,
      'x-auth-token': auth.token,
      ...(auth.key !== undefined && { 'x-hp-key': auth.key }),
      ...(auth.value !== undefined && { 'x-hp-val': auth.value }),
    };
  }
}

function collectApiPaths(content: string): Set<string> {
  return new Set([...content.matchAll(/["'`](\/api\/[a-zA-Z0-9_/%-]+)/g)].map((match) => match[1]!));
}

/** The search endpoint is the API path that also exposes an `/init` handshake. */
function findSearchPath(paths: Set<string>): string | null {
  const candidates = [...paths].filter((path) => !path.endsWith('/init') && paths.has(`${path}/init`)).sort();
  return candidates[0] ?? null;
}

function searchBody(query: string, auth: HltbAuth) {
  return {
    searchType: 'games',
    searchTerms: query.split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: REQUEST_SIZE,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { max: '', min: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
    ...(auth.key !== undefined && auth.value !== undefined && { [auth.key]: auth.value }),
  };
}

function mapHltbEntry(entry: HltbEntry): GameTimeEstimate {
  const mainHours = hoursFromSeconds(entry.comp_main);
  const mainExtraHours = hoursFromSeconds(entry.comp_plus);
  const completionistHours = hoursFromSeconds(entry.comp_100);
  return {
    providerId: String(entry.game_id),
    title: entry.game_name,
    ...(entry.release_world !== undefined && entry.release_world > 0 && { releaseYear: entry.release_world }),
    ...(mainHours !== undefined && { mainHours }),
    ...(mainExtraHours !== undefined && { mainExtraHours }),
    ...(completionistHours !== undefined && { completionistHours }),
  };
}

function hoursFromSeconds(seconds: number | undefined): number | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.round((seconds / 3600) * 100) / 100;
}
