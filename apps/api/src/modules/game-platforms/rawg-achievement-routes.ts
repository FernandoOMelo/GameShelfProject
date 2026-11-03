import type { FastifyInstance } from 'fastify';
import { gameAchievementsResponseSchema, rawgAchievementCandidateSchema, rawgAchievementsResponseSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import { createRawgLinkAttempts, type RawgAchievementProvider, type RawgAchievementRepository } from './rawg-achievements.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { GamePlatformRepository } from './repository.js';
import type { ExternalAchievementRepository } from './achievement-repository.js';
import { buildAchievementsResponse, type ExternalAchievementGroup } from './achievement-merge.js';

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
type MergeSources = { gamePlatforms: GamePlatformRepository; externalAchievements: ExternalAchievementRepository; platforms?: PlatformRepository };

export function registerRawgAchievementRoutes(app: FastifyInstance, games: GameRepository, store: RawgAchievementRepository, provider?: RawgAchievementProvider, merge?: MergeSources) {
  const tryLink = provider ? createRawgLinkAttempts(provider, store) : undefined;

  // Um grupo por associação de plataforma: o mesmo jogo em duas plataformas tem
  // dois conjuntos de conquistas, e nenhum deve engolir o outro.
  async function externalGroups(gameId: string): Promise<ExternalAchievementGroup[]> {
    if (!merge) return [];
    const [links, platforms] = await Promise.all([merge.gamePlatforms.listForGame(gameId), merge.platforms?.list() ?? Promise.resolve([])]);
    const nameOf = (id: string) => platforms.find((platform) => platform.id === id)?.name ?? 'Plataforma';
    return Promise.all(links.map(async (link) => ({
      id: link.id,
      platformId: link.platformId,
      name: link.edition ? `${nameOf(link.platformId)} · ${link.edition}` : nameOf(link.platformId),
      items: (await merge.externalAchievements.listForGamePlatform(link.id)).map((item) => ({
        id: item.id, externalId: item.externalId, name: item.name, description: item.description, iconUrl: item.iconUrl,
        points: item.points, rarityPercent: item.rarityPercent === null ? null : Number(item.rarityPercent), unlocked: item.unlocked,
        unlockedAt: item.unlockedAt ? item.unlockedAt.toISOString() : null, syncedAt: item.syncedAt.toISOString(),
      })),
    })));
  }

  app.get<{ Params: { gameId: string } }>('/games/:gameId/achievements', async (request, reply) => {
    if (!validId(request.params.gameId)) return reply.code(400).send({ error: 'ID inválido.' });
    const game = await games.find(request.params.gameId);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    let { linkedGame, achievements } = await store.get(game.id);
    // Jogos cadastrados antes da chave RAWG, ou cuja busca automática falhou,
    // ficariam sem catálogo para sempre; a leitura tenta vincular (com cota).
    if (!linkedGame && tryLink && await tryLink({ id: game.id, title: game.title, releaseYear: game.releaseYear ?? null })) {
      ({ linkedGame, achievements } = await store.get(game.id));
    }
    return reply.send(gameAchievementsResponseSchema.parse(buildAchievementsResponse(linkedGame, achievements, await externalGroups(game.id))));
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
