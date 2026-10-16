import type { GameTimeEstimate } from '@gameshelf/contracts';
export type { GameTimeEstimate } from '@gameshelf/contracts';

/** External completion-time lookups. Like GameMetadataProvider, implementations
 * belong in infrastructure and must not depend on GameShelf persistence or a
 * specific external API.
 */
export interface GameTimeEstimateProvider {
  readonly id: string;
  search(query: string): Promise<GameTimeEstimate[]>;
}
