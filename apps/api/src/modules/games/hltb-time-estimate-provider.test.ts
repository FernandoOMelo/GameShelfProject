import { describe, expect, it, vi } from 'vitest';
import { HltbTimeEstimateProvider } from './hltb-time-estimate-provider.js';

const homepage = '<html><script src="/_next/static/chunks/root.js"></script><script src="/_next/static/build-1/_buildManifest.js"></script></html>';
const manifest = '"/api/search/site","/api/search/site/init","/api/user/settings"';

describe('HltbTimeEstimateProvider', () => {
  it('discovers the search path, authenticates and maps completion times', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(Response.json({ token: 'token-1', hpKey: 'hpk', hpVal: 'hpv' }))
      .mockResolvedValueOnce(Response.json({ data: [{
        game_id: 2224,
        game_name: 'Dark Souls',
        release_world: 2011,
        comp_main: 7200,
        comp_plus: 9000,
        comp_100: 14400,
        comp_all: 9000,
      }] }));
    const provider = new HltbTimeEstimateProvider(fetcher, () => 1_700_000_000_000);

    const results = await provider.search('Dark Souls');

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://howlongtobeat.com/');
    expect(String(fetcher.mock.calls[1]?.[0])).toBe('https://howlongtobeat.com/_next/static/build-1/_buildManifest.js');
    expect(String(fetcher.mock.calls[2]?.[0])).toBe('https://howlongtobeat.com/api/search/site/init?t=1700000000000');
    expect(String(fetcher.mock.calls[3]?.[0])).toBe('https://howlongtobeat.com/api/search/site');
    expect(fetcher.mock.calls[3]?.[1]?.method).toBe('POST');
    expect(fetcher.mock.calls[3]?.[1]?.headers).toMatchObject({
      'x-auth-token': 'token-1', 'x-hp-key': 'hpk', 'x-hp-val': 'hpv', Referer: 'https://howlongtobeat.com/',
    });
    expect(JSON.parse(String(fetcher.mock.calls[3]?.[1]?.body))).toMatchObject({
      searchType: 'games', searchTerms: ['Dark', 'Souls'], size: 20, useCache: true, hpk: 'hpv',
    });
    expect(results).toEqual([{
      providerId: '2224', title: 'Dark Souls', releaseYear: 2011, mainHours: 2, mainExtraHours: 2.5, completionistHours: 4,
    }]);
  });

  it('reuses the discovered endpoint and cached token for later searches', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(Response.json({ token: 'token-1' }))
      .mockResolvedValueOnce(Response.json({ data: [{ game_id: 1, game_name: 'Hades', comp_main: 3600 }] }))
      .mockResolvedValueOnce(Response.json({ data: [{ game_id: 2, game_name: 'Nioh', comp_100: 7200 }] }));
    const provider = new HltbTimeEstimateProvider(fetcher, () => 1_700_000_000_000);

    await provider.search('Hades');
    const second = await provider.search('Nioh');

    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(second).toEqual([{ providerId: '2', title: 'Nioh', completionistHours: 2 }]);
  });

  it('retries once with fresh discovery and auth after a failed search', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(Response.json({ token: 'stale' }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(Response.json({ token: 'fresh' }))
      .mockResolvedValueOnce(Response.json({ data: [{ game_id: 3, game_name: 'Celeste', comp_main: 1800 }] }));
    const provider = new HltbTimeEstimateProvider(fetcher, () => 1_700_000_000_000);

    await expect(provider.search('Celeste')).resolves.toEqual([{ providerId: '3', title: 'Celeste', mainHours: 0.5 }]);
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(JSON.parse(String(fetcher.mock.calls[7]?.[1]?.body))).toMatchObject({ searchTerms: ['Celeste'] });
  });

  it('falls back to the JavaScript chunks when the build manifest has no API paths', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response('"no api paths here"'))
      .mockResolvedValueOnce(new Response('"`/api/find/init?t=" + Date.now(),"/api/find"'))
      .mockResolvedValueOnce(Response.json({ token: 'token-1' }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    const provider = new HltbTimeEstimateProvider(fetcher, () => 1_700_000_000_000);

    await expect(provider.search('Hades')).resolves.toEqual([]);
    expect(String(fetcher.mock.calls[3]?.[0])).toBe('https://howlongtobeat.com/api/find/init?t=1700000000000');
    expect(String(fetcher.mock.calls[4]?.[0])).toBe('https://howlongtobeat.com/api/find');
  });

  it('caps results at the API contract limit of ten', async () => {
    const data = Array.from({ length: 12 }, (_, index) => ({ game_id: index + 1, game_name: `Game ${index + 1}`, comp_main: 3600 }));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(homepage))
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(Response.json({ token: 'token-1' }))
      .mockResolvedValueOnce(Response.json({ data }));
    const provider = new HltbTimeEstimateProvider(fetcher, () => 1_700_000_000_000);

    const results = await provider.search('game');

    expect(results).toHaveLength(10);
    expect(results[0]).toEqual({ providerId: '1', title: 'Game 1', mainHours: 1 });
  });

  it('rejects blank and oversized queries without network requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new HltbTimeEstimateProvider(fetcher);

    await expect(provider.search('  ')).rejects.toThrow('entre 1 e 100');
    await expect(provider.search('x'.repeat(101))).rejects.toThrow('entre 1 e 100');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports discovery failures instead of inventing an endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>no next.js manifest here</html>'));
    const provider = new HltbTimeEstimateProvider(fetcher);

    await expect(provider.search('Hades')).rejects.toThrow('HowLongToBeat');
  });
});
