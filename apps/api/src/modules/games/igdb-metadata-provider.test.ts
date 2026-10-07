import { describe, expect, it, vi } from 'vitest';
import { IgdbMetadataProvider } from './igdb-metadata-provider.js';

const brazilRegion = 11;

describe('IgdbMetadataProvider', () => {
  it('authenticates once, escapes the search text, and maps candidates', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json([{
        id: 123,
        name: 'Hades',
        summary: 'Escape the Underworld.',
        first_release_date: Date.UTC(2020, 8, 17) / 1000,
        cover: { image_id: 'cover-image' },
        artworks: [{ image_id: 'background-image' }],
        franchise: { name: 'Hades' },
        involved_companies: [
          { developer: true, company: { name: 'Supergiant Games' } },
          { publisher: true, company: { name: 'Supergiant Games' } },
        ],
        genres: [{ name: 'Role-playing' }],
        platforms: [{ name: 'PC' }],
      }]))
      .mockResolvedValueOnce(Response.json([{ game: 123, name: 'Hades (Brasil)', region: brazilRegion }]))
      .mockResolvedValueOnce(Response.json([{ id: 124, name: 'Hades II' }]))
      .mockResolvedValueOnce(Response.json([]));
    const provider = new IgdbMetadataProvider('client-id', 'client-secret', fetcher, () => 1_000_000);

    const first = await provider.search('Hades"; limit 100; //');
    const second = await provider.search('Hades II');

    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls[1]?.[1]?.body).toContain('search "Hades\\"; limit 100; //";');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(fetcher.mock.calls[1]?.[1]?.body).not.toContain('name_localizations');
    expect(fetcher.mock.calls[2]?.[1]?.body).toContain('where game = (123) & region = 11');
    expect(first).toEqual([{
      providerId: '123',
      title: 'Hades (Brasil)',
      description: 'Escape the Underworld.',
      releaseYear: 2020,
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cover-image.jpg',
      backgroundUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p/background-image.jpg',
      developer: 'Supergiant Games',
      publisher: 'Supergiant Games',
      franchise: 'Hades',
      genres: ['Role-playing'],
      platforms: ['PC'],
    }]);
    expect(second[0]).toMatchObject({ providerId: '124', title: 'Hades II' });
  });

  it('rejects blank and oversized queries without making network requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new IgdbMetadataProvider('client-id', 'client-secret', fetcher);

    await expect(provider.search('  ')).rejects.toThrow('entre 1 e 100');
    await expect(provider.search('x'.repeat(101))).rejects.toThrow('entre 1 e 100');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back to the canonical game title when no Brazilian localization exists', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json([{ id: 125, name: 'Example Game' }]))
      .mockResolvedValueOnce(Response.json([]));
    const provider = new IgdbMetadataProvider('client-id', 'client-secret', fetcher, () => 1_000_000);

    await expect(provider.search('Example Game')).resolves.toMatchObject([{ title: 'Example Game' }]);
  });
});
