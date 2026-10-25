import type { Platform, PlatformSummary } from '@gameshelf/contracts';

export interface PlatformRepository {
  list(): Promise<Platform[]>;
  create(name: string, parentId?: string | null, presentation?: { catalogKey: string | null; iconKey: string | null }): Promise<Platform>;
  /** Renomeia a plataforma, mantendo grupo e vínculos (ADR-029). */
  rename(id: string, name: string): Promise<Platform | undefined>;
  /** Define ou remove o grupo da plataforma (ADR-025). */
  setParent(id: string, parentId: string | null): Promise<Platform | undefined>;
  /** Quantos jogos têm esta plataforma em `game_platforms`. */
  countGameLinks(id: string): Promise<number>;
  /** Remove a plataforma do catálogo. */
  remove(id: string): Promise<boolean>;
  /** Retorna resumo agregado por plataforma para a área de plataformas. */
  listSummaries(): Promise<PlatformSummary[]>;
}
