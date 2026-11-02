import type { FranchiseGameCandidate, GameMetadataCandidate } from '@gameshelf/contracts';
export type { GameMetadataCandidate } from '@gameshelf/contracts';

/** Provider implementations belong in infrastructure and must not depend on
 * GameShelf persistence or a specific external API.
 */
export interface GameMetadataProvider {
  readonly id: string;
  search(query: string): Promise<GameMetadataCandidate[]>;
}

/** Capacidade opcional de listar outros jogos da mesma franquia (ADR-033). */
export interface FranchiseGamesProvider {
  franchiseGames(igdbFranchiseId: number): Promise<Array<Pick<FranchiseGameCandidate, 'igdbId' | 'title' | 'releaseYear' | 'coverUrl'>>>;
}
