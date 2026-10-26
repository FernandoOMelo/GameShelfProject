import { asc, eq, gamePlatforms, platforms, sql, type Database } from '@gameshelf/database';
import type { PlatformSummary } from '@gameshelf/contracts';
import type { PlatformRepository } from './repository.js';

const returning = {
  id: platforms.id,
  name: platforms.name,
  catalogKey: platforms.catalogKey,
  iconKey: platforms.iconKey,
  parentId: platforms.parentId,
} as const;

export class DrizzlePlatformRepository implements PlatformRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return this.db.select(returning).from(platforms).orderBy(asc(platforms.name));
  }

  async create(
    name: string,
    parentId: string | null = null,
    presentation: { catalogKey: string | null; iconKey: string | null } = { catalogKey: null, iconKey: null },
  ) {
    const [platform] = await this.db.insert(platforms)
      .values({ name, parentId, ...presentation })
      .returning(returning);
    return platform;
  }

  async rename(id: string, name: string) {
    const [platform] = await this.db.update(platforms).set({ name }).where(eq(platforms.id, id))
      .returning(returning);
    return platform;
  }

  async setParent(id: string, parentId: string | null) {
    const [platform] = await this.db.update(platforms).set({ parentId }).where(eq(platforms.id, id))
      .returning(returning);
    return platform;
  }

  async countGameLinks(id: string) {
    const [result] = await this.db.select({ value: sql<number>`count(*)::int` }).from(gamePlatforms)
      .where(eq(gamePlatforms.platformId, id));
    return result?.value ?? 0;
  }

  async remove(id: string) {
    const deleted = await this.db.delete(platforms).where(eq(platforms.id, id)).returning({ id: platforms.id });
    return deleted.length > 0;
  }

  async listSummaries(): Promise<PlatformSummary[]> {
    // Uma CTE por tipo de dado; todas agrupadas por platform_id.
    const rows = await this.db.execute(sql`
      WITH
        gp_stats AS (
          SELECT
            gp.platform_id,
            count(DISTINCT gp.game_id)::int                              AS game_count,
            count(DISTINCT CASE WHEN g.status = 'COMPLETED' THEN g.id END)::int AS completed_count,
            coalesce(sum(gp.external_playtime_minutes), 0)::int AS ext_minutes
          FROM game_platforms gp
          JOIN games g ON g.id = gp.game_id
          GROUP BY gp.platform_id
        ),
        local_stats AS (
          SELECT platform_id,
                 coalesce(sum(extract(epoch FROM (ended_at - started_at)) / 60), 0)::int AS local_minutes
          FROM sessions
          WHERE ended_at IS NOT NULL AND platform_id IS NOT NULL
          GROUP BY platform_id
        ),
        ach_stats AS (
          SELECT
            gp.platform_id,
            count(ea.id)::int                                    AS total,
            count(ea.id) FILTER (WHERE ea.unlocked)::int         AS unlocked
          FROM game_platforms gp
          JOIN external_achievements ea ON ea.game_platform_id = gp.id
          GROUP BY gp.platform_id
        ),
        -- Dominado: todas as conquistas conhecidas desbloqueadas (total > 0)
        dominated AS (
          SELECT gp.platform_id, count(DISTINCT gp.game_id)::int AS dominated_count
          FROM game_platforms gp
          JOIN (
            SELECT game_platform_id,
                   count(*) AS total,
                   count(*) FILTER (WHERE unlocked) AS unlocked_count
            FROM external_achievements
            GROUP BY game_platform_id
          ) ac ON ac.game_platform_id = gp.id
          WHERE ac.total > 0 AND ac.total = ac.unlocked_count
          GROUP BY gp.platform_id
        ),
        recent_covers AS (
          SELECT gp.platform_id,
                 array_agg(g.cover_url ORDER BY gp.updated_at DESC) FILTER (WHERE g.cover_url IS NOT NULL) AS covers
          FROM game_platforms gp
          JOIN games g ON g.id = gp.game_id
          GROUP BY gp.platform_id
        )
      SELECT
        p.id, p.name, p.catalog_key, p.icon_key, p.parent_id,
        coalesce(gs.game_count, 0)       AS game_count,
        coalesce(gs.completed_count, 0)  AS completed_count,
        coalesce(d.dominated_count, 0)   AS dominated_count,
        coalesce(ls.local_minutes, 0)    AS local_played_minutes,
        coalesce(gs.ext_minutes, 0)      AS external_played_minutes,
        coalesce(ac.unlocked, 0)         AS achievements_unlocked,
        coalesce(ac.total, 0)            AS achievements_total,
        coalesce(rc.covers[1:4], '{}')   AS recent_game_covers
      FROM platforms p
      LEFT JOIN gp_stats gs ON gs.platform_id = p.id
      LEFT JOIN local_stats ls ON ls.platform_id = p.id
      LEFT JOIN ach_stats ac ON ac.platform_id = p.id
      LEFT JOIN dominated d ON d.platform_id = p.id
      LEFT JOIN recent_covers rc ON rc.platform_id = p.id
      ORDER BY p.name
    `);

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      platform: {
        id: row['id'] as string,
        name: row['name'] as string,
        catalogKey: (row['catalog_key'] as string | null) ?? null,
        iconKey: (row['icon_key'] as string | null) ?? null,
        parentId: (row['parent_id'] as string | null) ?? null,
      },
      gameCount: (row['game_count'] as number) ?? 0,
      completedCount: (row['completed_count'] as number) ?? 0,
      dominatedCount: (row['dominated_count'] as number) ?? 0,
      localPlayedMinutes: (row['local_played_minutes'] as number) ?? 0,
      externalPlayedMinutes: (row['external_played_minutes'] as number) ?? 0,
      achievementsUnlocked: (row['achievements_unlocked'] as number) ?? 0,
      achievementsTotal: (row['achievements_total'] as number) ?? 0,
      recentGameCovers: ((row['recent_game_covers'] as Array<string | null>) ?? []).slice(0, 4),
    }));
  }
}
