import type { FastifyInstance } from 'fastify';
import { gameAchievementsResponseSchema, rawgAchievementCandidateSchema, rawgAchievementsResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { RawgAchievementProvider, RawgAchievementRepository } from './rawg-achievements.js';
import type { GamePlatformRepository } from './repository.js';
import type { ExternalAchievementRepository } from './achievement-repository.js';
import { buildAchievementsResponse } from './achievement-merge.js';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function registerRawgAchievementRoutes(app: FastifyInstance, games: GameRepository, store: RawgAchievementRepository, provider?: RawgAchievementProvider, merge?: { gamePlatforms: GamePlatformRepository; externalAchievements: ExternalAchievementRepository }) {
  app.get<{ Params: { gameId: string } }>('/games/:gameId/achievements', async (request, reply) => {
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const { linkedGame, achievements } = await store.get(request.params.gameId);
    const external = merge ? (await Promise.all((await merge.gamePlatforms.listForGame(request.params.gameId)).map((link) => merge.externalAchievements.listForGamePlatform(link.id)))).flat() : [];
    return reply.send(gameAchievementsResponseSchema.parse(buildAchievementsResponse(linkedGame, achievements, external.map((item) => ({
      id: item.id, externalId: item.externalId, name: item.name, description: item.description, iconUrl: item.iconUrl,
      points: item.points, rarityPercent: item.rarityPercent === null ? null : Number(item.rarityPercent), unlocked: item.unlocked,
      unlockedAt: item.unlockedAt ? item.unlockedAt.toISOString() : null, syncedAt: item.syncedAt.toISOString(),
    })))));
  });
  app.get<{ Params: { gameId: string } }>('/games/:gameId/rawg-achievements', async (request, reply) => {
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send(rawgAchievementsResponseSchema.parse(await store.get(request.params.gameId)));
  });
  app.get<{ Params: { gameId: string } }>('/games/:gameId/rawg-achievements/candidates', async (request, reply) => {
    if (!provider) return reply.code(503).send({ error: 'Catálogo RAWG indisponível. Configure RAWG_API_KEY.' });
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    const game = await games.find(request.params.gameId);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send((await provider.search(game.title)).map((item) => rawgAchievementCandidateSchema.parse(item)));
  });
  app.put<{ Params: { gameId: string } }>('/games/:gameId/rawg-achievements', async (request, reply) => {
    if (!provider) return reply.code(503).send({ error: 'Catálogo RAWG indisponível. Configure RAWG_API_KEY.' });
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await games.find(request.params.gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const parsed = rawgAchievementCandidateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Escolha uma referência RAWG válida.' });
    try { return reply.send(rawgAchievementsResponseSchema.parse(await store.replace(request.params.gameId, parsed.data, await provider.achievements(parsed.data.id)))); }
    catch { return reply.code(502).send({ error: 'Não foi possível buscar as conquistas na RAWG.' }); }
  });
}
