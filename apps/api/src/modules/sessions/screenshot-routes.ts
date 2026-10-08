import type { FastifyInstance } from 'fastify';
import { sessionScreenshotSchema } from '@gameshelf/contracts';
import type { GameRepository } from '../games/repository.js';
import { maxImageBytes, type GameImageStorage } from '../games/image-storage.js';
import type { SessionRepository } from './repository.js';
import type { ScreenshotRecord, ScreenshotRepository } from './screenshot-repository.js';

export const maxScreenshotsPerSession = 10;

// O upload envia o arquivo como corpo binário (Content-Type image/*), sem multipart:
// evita uma dependência extra para um único campo de arquivo.
export async function registerScreenshotRoutes(
  app: FastifyInstance,
  games: GameRepository,
  sessions: SessionRepository,
  screenshots: ScreenshotRepository,
  storage: GameImageStorage,
) {
  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: maxImageBytes }, (_request, body, done) => done(null, body));

  type Params = { gameId: string; sessionId: string };

  async function resolveSession(params: Params) {
    if (!isUuid(params.gameId) || !isUuid(params.sessionId)) return 'invalid' as const;
    if (!await games.find(params.gameId)) return 'missing' as const;
    return await sessions.findForGame(params.gameId, params.sessionId) ? 'ok' as const : 'missing' as const;
  }

  app.get<{ Params: Params }>('/games/:gameId/sessions/:sessionId/screenshots', async (request, reply) => {
    const state = await resolveSession(request.params);
    if (state === 'invalid') return reply.code(400).send({ error: 'ID inválido.' });
    if (state === 'missing') return reply.code(404).send({ error: 'Sessão não encontrada.' });
    return reply.send((await screenshots.listForSession(request.params.gameId, request.params.sessionId)).map(toResponse));
  });

  app.post<{ Params: Params }>('/games/:gameId/sessions/:sessionId/screenshots', async (request, reply) => {
    const state = await resolveSession(request.params);
    if (state === 'invalid') return reply.code(400).send({ error: 'ID inválido.' });
    if (state === 'missing') return reply.code(404).send({ error: 'Sessão não encontrada.' });
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) return reply.code(415).send({ error: 'Envie uma imagem JPEG, PNG ou WebP.' });
    const existing = await screenshots.listForSession(request.params.gameId, request.params.sessionId);
    if (existing.length >= maxScreenshotsPerSession) return reply.code(409).send({ error: `Cada sessão aceita até ${maxScreenshotsPerSession} imagens.` });
    let url: string;
    try {
      url = await storage.saveImage(request.body);
    } catch {
      return reply.code(415).send({ error: 'O arquivo não é uma imagem JPEG, PNG ou WebP válida.' });
    }
    try {
      return reply.code(201).send(toResponse(await screenshots.add(request.params.sessionId, url)));
    } catch (error) {
      await storage.removeImage(url);
      throw error;
    }
  });

  app.delete<{ Params: Params & { screenshotId: string } }>('/games/:gameId/sessions/:sessionId/screenshots/:screenshotId', async (request, reply) => {
    const state = await resolveSession(request.params);
    if (state === 'invalid' || !isUuid(request.params.screenshotId)) return reply.code(400).send({ error: 'ID inválido.' });
    if (state === 'missing') return reply.code(404).send({ error: 'Sessão não encontrada.' });
    const removed = await screenshots.remove(request.params.gameId, request.params.sessionId, request.params.screenshotId);
    if (!removed) return reply.code(404).send({ error: 'Imagem não encontrada.' });
    await storage.removeImage(removed.url);
    return reply.code(204).send();
  });
}

function toResponse(record: ScreenshotRecord) {
  return sessionScreenshotSchema.parse({ ...record, createdAt: record.createdAt.toISOString() });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
