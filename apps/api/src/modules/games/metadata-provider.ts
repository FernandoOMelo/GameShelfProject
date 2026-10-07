import type { GameMetadataCandidate } from '@gameshelf/contracts';
export type { GameMetadataCandidate } from '@gameshelf/contracts';

/** Provider implementations belong in infrastructure and must not depend on
 * GameShelf persistence or a specific external API.
 */
export interface GameMetadataProvider {
  readonly id: string;
  search(query: string): Promise<GameMetadataCandidate[]>;
}
