import { describe, expect, it, vi } from 'vitest';
import { RawgClient } from './rawg-achievements.js';

describe('RawgClient', () => {
  it('searches RAWG and maps valid game candidates', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      results: [
        { id: 3498, slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V', released: '2013-09-17', background_image: 'https://image.example/gta.jpg' },
        { id: 0, slug: 'invalid', name: 'Ignored' },
      ],
    }));
    const client = new RawgClient('secret-key', fetcher);

    await expect(client.search('Grand Theft Auto V')).resolves.toEqual([{
      id: 3498,
      slug: 'grand-theft-auto-v',
      name: 'Grand Theft Auto V',
      released: '2013-09-17',
      backgroundImage: 'https://image.example/gta.jpg',
    }]);

    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe('https://api.rawg.io/api/games');
    expect(url.searchParams.get('key')).toBe('secret-key');
    expect(url.searchParams.get('search')).toBe('Grand Theft Auto V');
    expect(url.searchParams.get('search_precise')).toBe('true');
  });

  it('maps achievement data and drops malformed entries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      results: [
        { id: 40, name: 'First win', description: 'Win a match.', image: 'https://image.example/first-win.jpg', percent: 38.5 },
        { id: 41, name: '  ', percent: 9 },
        { id: 42, name: 'Unknown percentage', percent: 'not-a-number' },
      ],
    }));
    const client = new RawgClient('secret-key', fetcher);

    const achievements = await client.achievements(3498);

    expect(achievements).toEqual([
      expect.objectContaining({ rawgId: 40, name: 'First win', description: 'Win a match.', imageUrl: 'https://image.example/first-win.jpg', percent: 38.5 }),
      expect.objectContaining({ rawgId: 42, name: 'Unknown percentage', description: null, imageUrl: null, percent: null }),
    ]);
    expect(achievements.every((achievement) => /^[0-9a-f-]{36}$/i.test(achievement.id))).toBe(true);
    expect(String(fetcher.mock.calls[0]![0])).toContain('/games/3498/achievements?key=secret-key');
  });

  it('surfaces RAWG HTTP failures', async () => {
    const client = new RawgClient('secret-key', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(client.achievements(3498)).rejects.toThrow('HTTP 429');
  });
});
