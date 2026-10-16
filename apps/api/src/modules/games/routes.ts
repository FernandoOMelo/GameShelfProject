import type { FastifyInstance } from 'fastify';
import { gameInputSchema, gameSchema, gameUpdateSchema } from '@gameshelf/contracts';
import type { GameRepository } from './repository.js';
import type { GameImageStorage } from './image-storage.js';
import type { BacklogRepository } from '../backlog/repository.js';
import type { ScreenshotRepository } from '../sessions/screenshot-repository.js';
import type { GameListRepository } from '../game-lists/repository.js';
import type { ChallengeCompletionRepository, MainChallengeRepository } from '../challenge/repository.js';
import { detectChallengeCompletion } from '../challenge/service.js';

type ChallengeTracking = { lists: GameListRepository; challenge: MainChallengeRepository; completions: ChallengeCompletionRepository };

export async function registerGameRoutes(app: FastifyInstance, repository: GameRepository, imageStorage?: GameImageStorage, backlog?: BacklogRepository, screenshots?: ScreenshotRepository, tracking?: ChallengeTracking) {
  async function recordChallengeCompletion(updated: { id: string; status: string; completedAt: string | null }) {
    if (!tracking) return;
    const challenge = await tracking.challenge.get();
    if (!challenge) return;
    const list = await tracking.lists.find(challenge.listId);
    if (!list) return;
    const stored = await repository.list();
    const gamesById = new Map<string, { status: string; completedAt: string | null }>(
      stored.map((game) => [game.id, { status: game.status, completedAt: game.completedAt }]),
    );
    gamesById.set(updated.id, { status: updated.status, completedAt: updated.completedAt });
    const completion = detectChallengeCompletion(challenge, list.gameIds, gamesById);
    if (completion) await tracking.completions.record(completion);
  }

  app.get('/games', async (_request, reply) => {
    const games = await repository.list();
    return reply.send(games.map((game) => gameSchema.parse(toResponse(game))));
  });

  app.get<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const game = await repository.find(id);
    if (!game) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    return reply.send(gameSchema.parse(toResponse(game)));
  });

  app.post('/games', async (request, reply) => {
    const parsed = gameInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const localized = await localizeMetadataImages(parsed.data, imageStorage);
    if (!localized) return reply.code(502).send({ error: 'Não foi possível armazenar as imagens localmente.' });
    let game: Awaited<ReturnType<GameRepository['create']>>;
    try {
      game = await repository.create(localized.input);
    } catch (error) {
      await localized.rollback();
      throw error;
    }
    return reply.code(201).send(gameSchema.parse(toResponse(game)));
  });

  app.patch<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const parsed = gameUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados inválidos.', issues: parsed.error.issues });
    const existing = await repository.find(id);
    if (!existing) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const nextStatus = parsed.data.status ?? existing.status;
    if (parsed.data.rating != null && nextStatus !== 'COMPLETED' && nextStatus !== 'ABANDONED') {
      return reply.code(400).send({ error: 'A avaliação só pode ser alterada para jogos zerados ou abandonados.' });
    }
    const nextCompletedAt = parsed.data.completedAt !== undefined ? parsed.data.completedAt : existing.completedAt;
    if ((parsed.data.gameOfYear ?? existing.gameOfYear) && !nextCompletedAt) {
      return reply.code(400).send({ error: 'Informe a data de conclusão para manter o jogo do ano.' });
    }
    const localized = await localizeMetadataImages(parsed.data, imageStorage);
    if (!localized) return reply.code(502).send({ error: 'Não foi possível armazenar as imagens localmente.' });
    let game: Awaited<ReturnType<GameRepository['update']>>;
    try {
      game = await repository.update(id, localized.input);
    } catch (error) {
      await localized.rollback();
      throw error;
    }
    if (!game) {
      await localized.rollback();
      return reply.code(404).send({ error: 'Jogo não encontrado.' });
    }
    if (backlog && (!game.owned || game.archived || game.status === 'COMPLETED' || game.status === 'ABANDONED')) await backlog.removeFromQueue(id);
    if (game.status === 'COMPLETED' && game.completedAt) await recordChallengeCompletion(game);
    return reply.send(gameSchema.parse(toResponse(game)));
  });

  app.delete<{ Params: { id: string } }>('/games/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!id) return reply.code(400).send({ error: 'ID inválido.' });
    const screenshotUrls = screenshots && imageStorage ? (await screenshots.listForGame(id)).map((item) => item.url) : [];
    if (!await repository.delete(id)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    await Promise.all(screenshotUrls.map((url) => imageStorage!.removeImage(url)));
    return reply.code(204).send();
  });
}

async function localizeMetadataImages<T extends { coverUrl?: string | null; backgroundUrl?: string | null }>(
  input: T,
  storage?: GameImageStorage,
): Promise<{ input: T; rollback: () => Promise<void> } | undefined> {
  const imported: string[] = [];
  const localized = { ...input };
  if (!storage) return { input: localized, rollback: async () => undefined };

  try {
    for (const field of ['coverUrl', 'backgroundUrl'] as const) {
      const sourceUrl = input[field];
      if (!sourceUrl || !isIgdbImageUrl(sourceUrl)) continue;
      const localUrl = await storage.importImage(sourceUrl);
      localized[field] = localUrl;
      imported.push(localUrl);
    }
  } catch {
    await Promise.all(imported.map((url) => storage.removeImage(url)));
    return undefined;
  }

  return {
    input: localized,
    rollback: async () => Promise.all(imported.map((url) => storage.removeImage(url))).then(() => undefined),
  };
}

function isIgdbImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.igdb.com' && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseId(id: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function toResponse(game: Awaited<ReturnType<GameRepository['find']>> extends infer T ? Exclude<T, undefined> : never) {
  return {
    ...game,
    status: game.status,
    rating: game.rating ?? null,
    platformId: game.platformId ?? null,
    owned: game.owned ?? false,
    archived: game.archived ?? false,
    startedAt: game.startedAt ?? null,
    completedAt: game.completedAt ?? null,
    estimatedMainHours: game.estimatedMainHours === null ? null : Number(game.estimatedMainHours),
    estimatedCompletionistHours: game.estimatedCompletionistHours === null ? null : Number(game.estimatedCompletionistHours),
    personalEstimatedHours: game.personalEstimatedHours === null ? null : Number(game.personalEstimatedHours),
    retroactivePlayedHours: Number(game.retroactivePlayedHours ?? 0),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}
