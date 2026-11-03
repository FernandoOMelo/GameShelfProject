import {
  dlcs, eq, externalAchievements, externalPlaytimeImports, gamePlatforms, games,
  queueEntries, rawgGameLinks, sessions, sql, type Database,
} from '@gameshelf/database';
import { mergeGameFields, type GameMergeRepository } from './merge.js';
import type { GameRecord } from './repository.js';

/**
 * Mescla dois cadastros do mesmo jogo (ADR-038). Tudo numa transação: se
 * qualquer passo falhar, nenhum dos dois jogos é alterado.
 */
export class DrizzleGameMergeRepository implements GameMergeRepository {
  constructor(private readonly db: Database) {}

  async merge(targetId: string, sourceId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [target] = await tx.select().from(games).where(eq(games.id, targetId)).for('update');
      const [source] = await tx.select().from(games).where(eq(games.id, sourceId)).for('update');
      if (!target || !source) return false;
      const fields = mergeGameFields(target as unknown as GameRecord, source as unknown as GameRecord);

      // Gêneros que só o absorvido tinha.
      await tx.execute(sql`insert into game_genres (game_id, genre_id)
        select ${targetId}, genre_id from game_genres where game_id = ${sourceId} on conflict do nothing`);

      // Plataformas: a mesma plataforma+edição vira uma só associação; as demais mudam de jogo.
      const targetLinks = await tx.select().from(gamePlatforms).where(eq(gamePlatforms.gameId, targetId));
      const sourceLinks = await tx.select().from(gamePlatforms).where(eq(gamePlatforms.gameId, sourceId));
      let targetHasPrimary = targetLinks.some((link) => link.isPrimary);
      for (const link of sourceLinks) {
        const twin = targetLinks.find((item) => item.platformId === link.platformId && (item.edition ?? '') === (link.edition ?? ''));
        if (!twin) {
          const keepPrimary = link.isPrimary && !targetHasPrimary;
          await tx.update(gamePlatforms).set({ gameId: targetId, isPrimary: keepPrimary, updatedAt: new Date() }).where(eq(gamePlatforms.id, link.id));
          targetHasPrimary ||= keepPrimary;
          continue;
        }
        // Conquistas repetidas (mesmo id externo) ficam com a do jogo que permanece.
        await tx.execute(sql`delete from external_achievements where game_platform_id = ${link.id}
          and external_id in (select external_id from external_achievements where game_platform_id = ${twin.id})`);
        await tx.update(externalAchievements).set({ gamePlatformId: twin.id }).where(eq(externalAchievements.gamePlatformId, link.id));
        await tx.update(externalPlaytimeImports).set({ gamePlatformId: twin.id }).where(eq(externalPlaytimeImports.gamePlatformId, link.id));
        const takeExternal = twin.externalSource === null && link.externalSource !== null;
        if (takeExternal) {
          // A origem externa é única no banco: liberar antes de reatribuir.
          await tx.update(gamePlatforms).set({ externalSource: null, externalId: null }).where(eq(gamePlatforms.id, link.id));
        }
        await tx.update(gamePlatforms).set({
          owned: twin.owned || link.owned,
          countsTowardTotal: twin.countsTowardTotal || link.countsTowardTotal,
          notes: twin.notes ?? link.notes,
          ...(takeExternal && {
            externalSource: link.externalSource, externalId: link.externalId, externalAccountLabel: link.externalAccountLabel,
            externalPlaytimeMinutes: link.externalPlaytimeMinutes, externalLastPlayedAt: link.externalLastPlayedAt,
            externalSyncedAt: link.externalSyncedAt, externalActivityStartedAt: link.externalActivityStartedAt,
            externalActivityEndedAt: link.externalActivityEndedAt, externalActivityDays: link.externalActivityDays,
            externalPlaytimeImportedMinutes: link.externalPlaytimeImportedMinutes,
          }),
          updatedAt: new Date(),
        }).where(eq(gamePlatforms.id, twin.id));
        await tx.delete(gamePlatforms).where(eq(gamePlatforms.id, link.id));
      }

      await tx.update(sessions).set({ gameId: targetId }).where(eq(sessions.gameId, sourceId));
      await tx.update(externalPlaytimeImports).set({ gameId: targetId }).where(eq(externalPlaytimeImports.gameId, sourceId));

      // Jornadas do absorvido seguem as do que permanece, sem repetir a sequência.
      await tx.execute(sql`update playthroughs set game_id = ${targetId},
        sequence = sequence + (select coalesce(max(sequence), 0) from playthroughs where game_id = ${targetId})
        where game_id = ${sourceId}`);

      // DLCs: as do absorvido passam para o que permanece; vínculos para o absorvido apontam para ele.
      await tx.update(dlcs).set({ gameId: targetId }).where(eq(dlcs.gameId, sourceId));
      await tx.update(dlcs).set({ linkedGameId: targetId }).where(eq(dlcs.linkedGameId, sourceId));
      await tx.execute(sql`update dlcs set linked_game_id = null where linked_game_id = game_id`);

      // Fila e listas: o que o absorvido tinha e o outro não.
      const [targetQueued] = await tx.select({ id: queueEntries.id }).from(queueEntries).where(eq(queueEntries.gameId, targetId));
      if (!targetQueued) await tx.update(queueEntries).set({ gameId: targetId }).where(eq(queueEntries.gameId, sourceId));
      await tx.execute(sql`insert into game_list_entries (list_id, game_id, added_at)
        select list_id, ${targetId}, added_at from game_list_entries where game_id = ${sourceId} on conflict do nothing`);

      // Catálogo RAWG: só um por jogo.
      const [targetRawg] = await tx.select({ id: rawgGameLinks.id }).from(rawgGameLinks).where(eq(rawgGameLinks.gameId, targetId));
      if (!targetRawg) await tx.update(rawgGameLinks).set({ gameId: targetId }).where(eq(rawgGameLinks.gameId, sourceId));

      // O que sobrou do absorvido (fila, listas, gêneros, catálogo repetido) sai por cascata.
      await tx.delete(games).where(eq(games.id, sourceId));
      const hours = (value: string | number | null) => (value === null ? null : String(value));
      await tx.update(games).set({
        ...fields,
        estimatedMainHours: hours(fields.estimatedMainHours),
        estimatedCompletionistHours: hours(fields.estimatedCompletionistHours),
        personalEstimatedHours: hours(fields.personalEstimatedHours),
        retroactivePlayedHours: String(fields.retroactivePlayedHours),
        updatedAt: new Date(),
      }).where(eq(games.id, targetId));
      return true;
    });
  }
}
