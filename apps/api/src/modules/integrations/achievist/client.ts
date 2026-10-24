import { z } from 'zod';
import type { ExternalAchievementEntry, ExternalLibraryEntry, ExternalLibraryProvider } from '../external-library.js';

export const ACHIEVIST_SOURCE = 'achievist';

const PAGE_SIZE = 200;
const TIMEOUT_MS = 15_000;
const SESSION_COOKIE = 'achievist_session';
// Guarda contra um `total` inconsistente: a biblioteca de um usuário único não
// chega perto disso, e o laço nunca pode ficar preso pedindo páginas.
const MAX_PAGES = 100;

const gamesPageSchema = z.object({
  total: z.number().int().nonnegative(),
  games: z.array(z.object({
    platform_game_id: z.number().int(),
    platform: z.string().min(1),
    name: z.string().min(1),
    playtime_minutes: z.number().int().nonnegative().nullable().optional(),
    last_played_at: z.string().nullable().optional(),
  })),
});

// `unlocked` vem nulo quando a conta não tem a linha da conquista (a fonte usa
// LEFT JOIN): ausência significa bloqueada, não desconhecida.
const achievementsSchema = z.array(z.object({
  platform_ach_id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  icon_url: z.string().nullable().optional(),
  points: z.number().nullable().optional(),
  rarity_pct: z.union([z.number(), z.string()]).nullable().optional(),
  unlocked: z.boolean().nullable().optional(),
  unlocked_at: z.string().nullable().optional(),
}));

const accountsSchema = z.array(z.object({
  platform: z.string().min(1),
  display_name: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
}));

/**
 * As chaves de plataforma da fonte são contas de loja ou serviço. O catálogo do
 * GameShelf guarda nomes legíveis, então a tradução acontece aqui, na borda:
 * nada fora do cliente conhece as chaves da fonte. Uma chave desconhecida vira
 * o próprio nome capitalizado, e o usuário pode escolher outra plataforma ao
 * confirmar a correspondência.
 */
const PLATFORM_NAMES: Record<string, string> = {
  steam: 'Steam',
  retroachievements: 'RetroAchievements',
  xbox: 'Xbox',
  psn: 'PlayStation',
  epic: 'Epic Games',
  gog: 'GOG',
  ea: 'EA',
  ubisoft: 'Ubisoft',
  wargaming: 'Wargaming',
  guildwars2: 'Guild Wars 2',
  googleplay: 'Google Play',
  roblox: 'Roblox',
};

type Fetcher = typeof fetch;

/**
 * Cliente isolado da API do Achievist (ADR-024). Concentra URL base, login por
 * cookie, reautenticação, timeout, paginação e normalização. A senha só existe
 * dentro desta classe e nunca entra em mensagem de erro ou log.
 */
export class AchievistClient implements ExternalLibraryProvider {
  readonly source = ACHIEVIST_SOURCE;
  private cookie?: string;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async fetchLibrary(): Promise<ExternalLibraryEntry[]> {
    const labels = await this.accountLabels();
    const entries = new Map<string, ExternalLibraryEntry>();

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const body = gamesPageSchema.parse(await this.get(`/api/games?page=${page}&page_size=${PAGE_SIZE}&sort=name`));
      for (const game of body.games) {
        const externalId = String(game.platform_game_id);
        // A fonte ordena com desempate estável, mas a importação é por
        // identificador: repetição entre páginas não pode virar entrada dupla.
        entries.set(externalId, {
          externalId,
          title: game.name.trim(),
          platformName: platformName(game.platform),
          accountLabel: labels.get(game.platform) ?? null,
          playtimeMinutes: game.playtime_minutes ?? null,
          lastPlayedAt: parseInstant(game.last_played_at),
        });
      }
      if (body.games.length < PAGE_SIZE || entries.size >= body.total) break;
    }

    return [...entries.values()];
  }

  async fetchAchievements(externalGameId: string): Promise<ExternalAchievementEntry[]> {
    const rows = achievementsSchema.parse(await this.get(`/api/games/${encodeURIComponent(externalGameId)}/achievements`));
    return rows
      // Conquista sem nome não tem o que exibir, e o banco rejeita nome vazio.
      .filter((row) => (row.name ?? '').trim().length > 0)
      .map((row) => {
        const unlocked = row.unlocked === true;
        return {
          externalId: row.platform_ach_id,
          name: row.name!.trim(),
          description: row.description?.trim() || null,
          iconUrl: row.icon_url ?? null,
          points: typeof row.points === 'number' && row.points >= 0 ? row.points : null,
          rarityPercent: parseRarity(row.rarity_pct),
          unlocked,
          // A fonte às vezes tem a conquista sem a data; desbloqueada sem data é
          // normal, data sem desbloqueio seria contradição e é descartada.
          unlockedAt: unlocked ? parseInstant(row.unlocked_at) : null,
        };
      });
  }

  /**
   * A listagem de biblioteca da fonte não diz de qual conta cada jogo veio, só
   * a plataforma. Quando a plataforma tem exatamente uma conta conectada, o
   * rótulo é dela sem ambiguidade; com mais de uma, fica sem rótulo em vez de
   * atribuir a conta errada.
   */
  private async accountLabels(): Promise<Map<string, string>> {
    const accounts = accountsSchema.parse(await this.get('/api/accounts'));
    const byPlatform = new Map<string, string[]>();
    for (const account of accounts) {
      if (account.enabled === false) continue;
      const label = account.display_name?.trim() || account.external_id?.trim();
      if (!label) continue;
      byPlatform.set(account.platform, [...byPlatform.get(account.platform) ?? [], label]);
    }
    return new Map([...byPlatform]
      .filter(([, labels]) => labels.length === 1)
      .map(([platform, labels]) => [platform, labels[0]]));
  }

  /**
   * Testa a conexão sem ler a biblioteca: login + lista de contas. Devolve o
   * número de contas conectadas na fonte; a mensagem de erro do login nunca
   * repete usuário ou senha.
   */
  async ping(): Promise<{ accounts: number }> {
    const accounts = accountsSchema.parse(await this.get('/api/accounts'));
    return { accounts: accounts.length };
  }

  /** GET autenticado. Sessão expirada (401) refaz o login uma vez e repete. */
  private async get(path: string): Promise<unknown> {
    const response = await this.request(path);
    if (response.status !== 401) return readJson(response, path);
    this.cookie = undefined;
    return readJson(await this.request(path), path);
  }

  private async request(path: string): Promise<Response> {
    const cookie = await this.session();
    return this.fetcher(new URL(path, this.baseUrl), {
      headers: { Accept: 'application/json', Cookie: cookie },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  private async session(): Promise<string> {
    if (this.cookie) return this.cookie;
    const response = await this.fetcher(new URL('/api/auth/login', this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // A mensagem nunca repete usuário ou senha: o que falhou é o login, e o
    // status basta para diagnosticar (401 credenciais, 429 tentativas).
    if (!response.ok) throw new Error(`O login no Achievist falhou com HTTP ${response.status}.`);
    const cookie = readSessionCookie(response);
    if (!cookie) throw new Error('O Achievist não devolveu o cookie de sessão.');
    this.cookie = cookie;
    return cookie;
  }
}

function platformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

async function readJson(response: Response, path: string): Promise<unknown> {
  if (!response.ok) throw new Error(`O Achievist respondeu HTTP ${response.status} em ${path}.`);
  return response.json();
}

function readSessionCookie(response: Response): string | undefined {
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') ?? ''];
  for (const header of headers) {
    const value = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(header)?.[1];
    if (value) return `${SESSION_COOKIE}=${value}`;
  }
  return undefined;
}

/** Data inválida da fonte vira ausência de informação, não uma data falsa. */
function parseRarity(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
