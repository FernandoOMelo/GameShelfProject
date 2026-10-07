import { describe, expect, it } from 'vitest';
import type { GameMetadataCandidate, GameMetadataProvider } from './metadata-provider.js';

describe('GameMetadataProvider contract', () => {
  it('allows provider-neutral candidate metadata without persistence fields', async () => {
    const provider: GameMetadataProvider = {
      id: 'example-provider',
      async search(query) {
        expect(query).toBe('Example Game');
        return [{
          providerId: 'external-123',
          title: 'Example Game',
          releaseYear: 2024,
          genres: ['Adventure'],
          platforms: ['PC'],
        }];
      },
    };

    const candidates: GameMetadataCandidate[] = await provider.search('Example Game');
    expect(candidates).toEqual([{
      providerId: 'external-123',
      title: 'Example Game',
      releaseYear: 2024,
      genres: ['Adventure'],
      platforms: ['PC'],
    }]);
  });
});
