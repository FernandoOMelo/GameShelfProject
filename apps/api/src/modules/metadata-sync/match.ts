import type { GameMetadataCandidate } from '@gameshelf/contracts';

/** Compara títulos sem caixa, acentos, ™®© nem pontuação ("Pokémon™: Red" = "pokemon red"). */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[™®©'’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type MatchOutcome =
  | { kind: 'MATCH'; candidate: GameMetadataCandidate; candidates: GameMetadataCandidate[] }
  | { kind: 'REVIEW'; candidates: GameMetadataCandidate[] }
  | { kind: 'NONE' };

/**
 * Só há correspondência automática quando exatamente um candidato tem o mesmo
 * título (e o mesmo ano, se o jogo tem ano). Vários iguais (remakes) ou só
 * parecidos vão para revisão; nenhum candidato é "não encontrado".
 */
export function pickMatch(game: { title: string; releaseYear: number | null }, candidates: GameMetadataCandidate[]): MatchOutcome {
  if (candidates.length === 0) return { kind: 'NONE' };
  const wanted = normalizeTitle(game.title);
  const exact = candidates.filter((candidate) => normalizeTitle(candidate.title) === wanted
    && (game.releaseYear === null || candidate.releaseYear == null || candidate.releaseYear === game.releaseYear));
  const [only] = exact;
  return exact.length === 1 && only ? { kind: 'MATCH', candidate: only, candidates } : { kind: 'REVIEW', candidates };
}
