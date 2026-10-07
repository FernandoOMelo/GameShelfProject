import type { FastifyInstance } from 'fastify';
import type { GameImageStorage } from './image-storage.js';

export async function registerMediaRoutes(app: FastifyInstance, storage: GameImageStorage) {
  app.get<{ Params: { filename: string } }>('/media/:filename', async (request, reply) => {
    const image = await storage.openImage(request.params.filename);
    if (!image) return reply.code(404).send({ error: 'Imagem não encontrada.' });
    return reply
      .type(image.contentType)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(image.stream);
  });
}
