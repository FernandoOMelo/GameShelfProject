import type { Platform } from '@gameshelf/contracts';

export interface PlatformRepository {
  list(): Promise<Platform[]>;
  create(name: string, parentId?: string | null): Promise<Platform>;
  /** Define ou remove o grupo da plataforma (ADR-025). */
  setParent(id: string, parentId: string | null): Promise<Platform | undefined>;
}
