import type { FastifyInstance } from 'fastify';
import {
  externalAchievementsResponseSchema, externalPlaytimeImportSchema,
  gamePlatformInputSchema, gamePlatformSchema, gamePlatformUpdateSchema,
} from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import { parseId } from '../shared/parse-id.js';
import { toGamePlatform } from '../shared/serialize.js';
import type { GamePlatformRepository } from './repository.js';
import { planPlaytimeImport } from './playtime-import.js';
import type { ExternalAchievementRepository } from './achievement-repository.js';
import type { ExternalLibraryProvider } from '../integrations/external-library.js';
import { toExternalAchievements } from './achievements.js';

export async function registerGamePlatformRoutes(
  app: FastifyInstance,
  games: GameRepository,
  platforms: PlatformRepository,
  repository: GamePlatformRepository,
  achievements?: { store: ExternalAchievementRepository; provider?: ExternalLibraryProvider },
) {
  // Conquistas são buscadas sob demanda, por jogo (ADR-028). Se a fonte estiver
  // fora do ar — ou desligada —, a resposta vem do espelho local com
  // `refreshedAt` nulo, em vez de falhar: ver conquista nunca pode derrubar a
  // tela de detalhes.
  app.get<{ Params: { gameId: string; id: string } }>('/games/:gameId/platforms/:id/achievements', async (request, reply) => {
    if (!achievements) return reply.code(404).send({ error: 'Conquistas não estão disponíveis nesta instalação.' });
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    const link = await repository.find(gameId, id);
    if (!link) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });

    let refreshedAt: Date | null = null;
    let records = await achievements.store.listForGamePlatform(id);
    const provider = achievements.provider;
    if (provider && link.externalSource === provider.source && link.externalId) {
      try {
        const fetched = await provider.fetchAchievements(link.externalId);
        refreshedAt = new Date();
        records = await achievements.store.replaceForGamePlatform(id, fetched, refreshedAt);
      } catch (error) {
        // A fonte caiu: segue com o que já havia sido espelhado.
        request.log.warn({ err: error instanceof Error ? error.message : 'erro' }, 'Falha ao buscar conquistas');
      }
    }
    return reply.send(externalAchievementsResponseSchema.parse(toExternalAchievements(records, refreshedAt)));
  });


  app.get<{ Params: { gameId: string } }>('/games/:gameId/platforms', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const records = await repository.listForGame(gameId);
    return reply.send(records.map(toGamePlatform));
  });

  app.post<{ Params: { gameId: string } }>('/games/:gameId/platforms', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const parsed = gamePlatformInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados da plataforma inválidos.', issues: parsed.error.issues });
    if (!(await platforms.list()).some((platform) => platform.id === parsed.data.platformId)) {
      return reply.code(400).send({ error: 'Plataforma não encontrada.' });
    }
    // A mesma plataforma e edição não podem ser associadas duas vezes ao mesmo jogo.
    const existing = await repository.listForGame(gameId);
    if (existing.some((item) => item.platformId === parsed.data.platformId && (item.edition ?? '') === (parsed.data.edition?.trim() ?? ''))) {
      return reply.code(409).send({ error: 'Esta plataforma já está associada ao jogo com a mesma edição.' });
    }
    const record = await repository.create(gameId, parsed.data);
    return reply.code(201).send(gamePlatformSchema.parse(toGamePlatform(record)));
  });

  app.patch<{ Params: { gameId: string; id: string } }>('/games/:gameId/platforms/:id', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = gamePlatformUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados da plataforma inválidos.', issues: parsed.error.issues });
    const existing = await repository.listForGame(gameId);
    const current = existing.find((item) => item.id === id);
    if (!current) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });
    const platformId = parsed.data.platformId ?? current.platformId;
    if (parsed.data.platformId && !(await platforms.list()).some((platform) => platform.id === platformId)) {
      return reply.code(400).send({ error: 'Plataforma não encontrada.' });
    }
    const edition = parsed.data.edition !== undefined ? (parsed.data.edition?.trim() ?? '') : (current.edition ?? '');
    if (existing.some((item) => item.id !== id && item.platformId === platformId && (item.edition ?? '') === edition)) {
      return reply.code(409).send({ error: 'Esta plataforma já está associada ao jogo com a mesma edição.' });
    }
    const record = await repository.update(gameId, id, parsed.data);
    if (!record) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });
    return reply.send(gamePlatformSchema.parse(toGamePlatform(record)));
  });

  // Lançar o tempo informado pela plataforma como horas retroativas do jogo.
  // Ação explícita e idempotente: só a parte ainda não lançada é somada, e a
  // sincronização nunca faz isso sozinha (ADR-026).
  app.post<{ Params: { gameId: string; id: string } }>('/games/:gameId/platforms/:id/import-playtime', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    const game = await games.find(gameId);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const link = await repository.find(gameId, id);
    if (!link) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });

    const plan = planPlaytimeImport(link, Number(game.retroactivePlayedHours ?? 0));
    if (!plan.ok) return reply.code(409).send({ error: plan.error });

    const updatedGame = await games.update(gameId, { retroactivePlayedHours: plan.retroactivePlayedHours });
    if (!updatedGame) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const updatedLink = await repository.markPlaytimeImported(id, plan.totalImportedMinutes);
    if (!updatedLink) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });

    return reply.send(externalPlaytimeImportSchema.parse({
      platform: toGamePlatform(updatedLink),
      importedMinutes: plan.importedMinutes,
      retroactivePlayedHours: Number(updatedGame.retroactivePlayedHours ?? 0),
    }));
  });

  // Desassociar não apaga sessões nem jornadas: elas continuam válidas, apenas
  // deixam de ter aquela plataforma como referência do jogo.
  app.delete<{ Params: { gameId: string; id: string } }>('/games/:gameId/platforms/:id', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const id = parseId(request.params.id);
    if (!gameId || !id) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await repository.delete(gameId, id)) return reply.code(404).send({ error: 'Plataforma associada não encontrada.' });
    return reply.code(204).send();
  });
}
