import { describe, expect, it, vi } from 'vitest';
import { AchievistClient } from './client.js';

const loginResponse = () => new Response(JSON.stringify({ id: 1, username: 'user' }), {
  headers: { 'content-type': 'application/json', 'set-cookie': 'achievist_session=session-token; Path=/; HttpOnly; SameSite=lax' },
});

const accounts = (rows: unknown[]) => Response.json(rows);
const gamesPage = (games: unknown[], total: number) => Response.json({ total, page: 1, page_size: 200, games });

const game = (id: number, overrides: Record<string, unknown> = {}) => ({
  platform_game_id: id, platform: 'steam', platform_app_id: String(id), name: `Jogo ${id}`,
  playtime_minutes: 120, last_played_at: '2026-05-01T10:00:00+00:00', ...overrides,
});

describe('AchievistClient', () => {
  it('authenticates once, pages the library and maps entries to the GameShelf vocabulary', async () => {
    // Página cheia (200) força a segunda página; o jogo repetido entre páginas
    // tem de colapsar na mesma entrada, porque a chave é o identificador.
    const firstPage = Array.from({ length: 200 }, (_, index) => game(index + 1));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(accounts([{ platform: 'steam', display_name: 'fulano', enabled: true }]))
      .mockResolvedValueOnce(gamesPage(firstPage, 201))
      .mockResolvedValueOnce(gamesPage([game(1), game(201, { platform: 'retroachievements' })], 201));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    const entries = await client.fetchLibrary();

    expect(client.source).toBe('achievist');
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(String(fetcher.mock.calls[1]?.[0])).toBe('http://achievist-app:8000/api/accounts');
    expect(String(fetcher.mock.calls[2]?.[0])).toContain('/api/games?page=1&page_size=200');
    expect(String(fetcher.mock.calls[3]?.[0])).toContain('page=2');
    expect(fetcher.mock.calls[2]?.[1]?.headers).toMatchObject({ Cookie: 'achievist_session=session-token' });
    expect(entries).toHaveLength(201);
    expect(entries[0]).toEqual({
      externalId: '1', title: 'Jogo 1', platformName: 'Steam', accountLabel: 'fulano',
      playtimeMinutes: 120, lastPlayedAt: new Date('2026-05-01T10:00:00.000Z'),
    });
    // Chave de plataforma sem mapeamento conhecido ainda vira um nome legível.
    expect(entries.at(-1)).toMatchObject({ externalId: '201', platformName: 'RetroAchievements', accountLabel: null });
  });

  it('keeps "the source does not say" as null instead of inventing zero or a date', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(accounts([]))
      .mockResolvedValueOnce(gamesPage([game(7, { playtime_minutes: null, last_played_at: null }), game(8, { last_played_at: 'nunca' })], 2));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    const entries = await client.fetchLibrary();

    expect(entries[0]).toMatchObject({ playtimeMinutes: null, lastPlayedAt: null });
    expect(entries[1]).toMatchObject({ lastPlayedAt: null });
  });

  it('does not label an entry when the platform has more than one connected account', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(accounts([
        { platform: 'steam', display_name: 'conta-a', enabled: true },
        { platform: 'steam', display_name: 'conta-b', enabled: true },
      ]))
      .mockResolvedValueOnce(gamesPage([game(1)], 1));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    await expect(client.fetchLibrary()).resolves.toMatchObject([{ accountLabel: null }]);
  });

  it('logs in again when the session expires and retries the same request', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Not logged in' }), { status: 401 }))
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(accounts([]))
      .mockResolvedValueOnce(gamesPage([game(1)], 1));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    await expect(client.fetchLibrary()).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(String(fetcher.mock.calls[2]?.[0])).toBe('http://achievist-app:8000/api/auth/login');
  });

  it('reports the HTTP status without ever echoing the credentials', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ detail: 'Invalid username or password' }), { status: 401 }));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'senha-secreta', fetcher);

    const error = await client.fetchLibrary().then(() => undefined, (reason: unknown) => reason as Error);

    expect(error?.message).toBe('O login no Achievist falhou com HTTP 401.');
    expect(error?.message).not.toContain('senha-secreta');
  });

  it('fails when the login does not return a session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 1 }));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    await expect(client.fetchLibrary()).rejects.toThrow('cookie de sessão');
  });

  it('surfaces an unavailable source as an error instead of an empty library', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response('', { status: 502 }));
    const client = new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);

    await expect(client.fetchLibrary()).rejects.toThrow('HTTP 502');
  });
});

describe('conquistas da fonte', () => {
  const achievementsClient = (rows: unknown[]) => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(Response.json(rows));
    return new AchievistClient('http://achievist-app:8000', 'user', 'secret', fetcher);
  };

  it('normaliza a resposta e trata unlocked nulo como bloqueada', async () => {
    const client = achievementsClient([
      { platform_ach_id: 'A1', name: ' Primeira vitória ', description: ' Venceu ', icon_url: 'http://i/1.png', points: 30, rarity_pct: '12.5', unlocked: true, unlocked_at: '2026-02-01T10:00:00+00:00' },
      { platform_ach_id: 2, name: 'Bloqueada', description: null, icon_url: null, points: null, rarity_pct: null, unlocked: null, unlocked_at: null },
    ]);

    expect(await client.fetchAchievements('401')).toEqual([
      {
        externalId: 'A1', name: 'Primeira vitória', description: 'Venceu', iconUrl: 'http://i/1.png',
        points: 30, rarityPercent: 12.5, unlocked: true, unlockedAt: new Date('2026-02-01T10:00:00Z'),
      },
      {
        externalId: '2', name: 'Bloqueada', description: null, iconUrl: null,
        points: null, rarityPercent: null, unlocked: false, unlockedAt: null,
      },
    ]);
  });

  it('descarta conquista sem nome e data de desbloqueio sem desbloqueio', async () => {
    const client = achievementsClient([
      { platform_ach_id: 'A1', name: '   ', unlocked: true },
      { platform_ach_id: 'A2', name: 'Válida', unlocked: false, unlocked_at: '2026-02-01T10:00:00+00:00' },
    ]);

    const achievements = await client.fetchAchievements('401');

    expect(achievements).toHaveLength(1);
    expect(achievements[0]).toMatchObject({ externalId: 'A2', unlocked: false, unlockedAt: null });
  });

  it('ignora raridade fora da faixa em vez de propagar valor inválido', async () => {
    const client = achievementsClient([{ platform_ach_id: 'A1', name: 'X', rarity_pct: 150 }]);
    expect((await client.fetchAchievements('401'))[0]!.rarityPercent).toBeNull();
  });
});
