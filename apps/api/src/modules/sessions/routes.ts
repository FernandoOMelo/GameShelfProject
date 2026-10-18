import type { FastifyInstance } from 'fastify';
import { sessionInputSchema, sessionSchema, sessionUpdateSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import type { GameImageStorage } from '../games/image-storage.js';
import type { SessionRecord, SessionRepository } from './repository.js';
import type { ScreenshotRepository } from './screenshot-repository.js';
import type { PlaythroughRepository } from '../playthroughs/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';

type SessionContext = { playthroughs?: PlaythroughRepository; platforms?: PlatformRepository };

export async function registerSessionRoutes(
  app: FastifyInstance,
  gameRepository: GameRepository,
  sessionRepository: SessionRepository,
  screenshotCleanup?: { screenshots: ScreenshotRepository; storage: GameImageStorage },
  context: SessionContext = {},
) {
  // A jornada precisa ser do mesmo jogo da sessão; o banco não consegue garantir
  // isso em uma chave estrangeira de coluna única, então a regra vive aqui.
  async function invalidLinks(gameId: string, input: { playthroughId?: string | null; platformId?: string | null }): Promise<string | undefined> {
    if (input.playthroughId && context.playthroughs) {
      if (!await context.playthroughs.find(gameId, input.playthroughId)) return 'Jornada não encontrada para este jogo.';
    }
    if (input.platformId && context.platforms) {
      if (!(await context.platforms.list()).some((platform) => platform.id === input.platformId)) return 'Plataforma não encontrada.';
    }
    return undefined;
  }
  app.get<{ Params: { gameId: string } }>('/games/:gameId/sessions', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await gameRepository.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const records = await sessionRepository.listForGame(gameId);
    return reply.send(records.map((record) => sessionSchema.parse(toResponse(record))));
  });

  app.post<{ Params: { gameId: string } }>('/games/:gameId/sessions', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    if (!gameId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await gameRepository.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const parsed = sessionInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Dados da sessão inválidos.', issues: parsed.error.issues });
    // Reenvios da fila offline (ADR-015) chegam com o mesmo início; uma sessão por jogo e horário de início.
    const startedAt = new Date(parsed.data.startedAt).getTime();
    if ((await sessionRepository.listForGame(gameId)).some((item) => item.startedAt.getTime() === startedAt)) {
      return reply.code(409).send({ error: 'Já existe uma sessão deste jogo iniciada neste horário.' });
    }
    const linkError = await invalidLinks(gameId, parsed.data);
    if (linkError) return reply.code(400).send({ error: linkError });
    const record = await sessionRepository.create(gameId, parsed.data);
    return reply.code(201).send(sessionSchema.parse(toResponse(record)));
  });

  app.patch<{ Params: { gameId: string; sessionId: string } }>('/games/:gameId/sessions/:sessionId', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const sessionId = parseId(request.params.sessionId);
    if (!gameId || !sessionId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await gameRepository.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    const existing = await sessionRepository.findForGame(gameId, sessionId);
    if (!existing) return reply.code(404).send({ error: 'Sessão não encontrada.' });
    const patch = sessionUpdateSchema.safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: 'Dados da sessão inválidos.', issues: patch.error.issues });
    const merged = sessionInputSchema.safeParse({
      playthroughId: existing.playthroughId,
      platformId: existing.platformId,
      startedAt: existing.startedAt.toISOString(),
      endedAt: existing.endedAt?.toISOString() ?? null,
      progress: existing.progress,
      location: existing.location,
      notes: existing.notes,
      keyDecisions: existing.keyDecisions,
      tips: existing.tips,
      ...patch.data,
    });
    if (!merged.success) return reply.code(400).send({ error: 'A sessão resultante possui dados inválidos.', issues: merged.error.issues });
    const linkError = await invalidLinks(gameId, merged.data);
    if (linkError) return reply.code(400).send({ error: linkError });
    const updated = await sessionRepository.update(gameId, sessionId, merged.data);
    if (!updated) return reply.code(404).send({ error: 'Sessão não encontrada.' });
    return reply.send(sessionSchema.parse(toResponse(updated)));
  });

  app.delete<{ Params: { gameId: string; sessionId: string } }>('/games/:gameId/sessions/:sessionId', async (request, reply) => {
    const gameId = parseId(request.params.gameId);
    const sessionId = parseId(request.params.sessionId);
    if (!gameId || !sessionId) return reply.code(400).send({ error: 'ID inválido.' });
    if (!await gameRepository.find(gameId)) return reply.code(404).send({ error: 'Jogo não encontrado.' });
    // As linhas somem por cascata; os arquivos precisam ser apagados à parte.
    const screenshotUrls = screenshotCleanup ? (await screenshotCleanup.screenshots.listForSession(gameId, sessionId)).map((item) => item.url) : [];
    const deleted = await sessionRepository.delete(gameId, sessionId);
    if (!deleted) return reply.code(404).send({ error: 'Sessão não encontrada.' });
    await Promise.all(screenshotUrls.map((url) => screenshotCleanup!.storage.removeImage(url)));
    return reply.code(204).send();
  });
}

function parseId(id: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function toResponse(session: SessionRecord) {
  return {
    ...session,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationMinutes: session.endedAt === null
      ? null
      : Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
