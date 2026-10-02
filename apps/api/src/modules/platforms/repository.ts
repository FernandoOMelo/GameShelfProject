import type { Platform } from '@gameshelf/contracts';

export interface PlatformRepository {
  list(): Promise<Platform[]>;
  create(name: string): Promise<Platform>;
}
