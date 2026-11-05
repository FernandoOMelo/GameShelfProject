import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerMetadataSyncRoutes } from './routes.js';
import type { MetadataSyncService } from './service.js';

const GAME = '00000000-0000-4000-8000-000000000001';

function build(overrides: Partial<Record<keyof MetadataSyncService, unknown>> = {}) {
  const service = {
    review: vi.fn(async () => ({ count: 1, items: [{ gameId: GAME, title: 'Hades', coverUrl: null, status: 'NEEDS_REVIEW', appliedFields: [], candidates: [{ providerId: 'igdb-2', title: 'Hades II' }], checkedAt: '2026-05-01T12:00:00.000Z' }] })),
    sweep: vi.fn(async () => ({ checked: 2, applied: 1, review: 1, notFound: 0, failed: false })),
    syncGame: vi.fn(async () => 'APPLIED_AUTO'),
    useCandidate: vi.fn(async () => 'OK'),
    searchAgain: vi.fn(async () => 'OK'),
    ignore: vi.fn(async () => true), confirm: vi.fn(async () => false), undo: vi.fn(async () => true),
    ...overrides,
  };
  const app = Fastify();
  void app.register((instance) => registerMetadataSyncRoutes(instance, service as unknown as MetadataSyncService));
  return { app, service };
}

const apps: Array<{ close: () => Promise<unknown> }> = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe('rotas de metadata-sync', () => {
  it('lista a revisão e roda a varredura manual', async () => {
    const { app } = build();
    apps.push(app);
    expect((await app.inject({ method: 'GET', url: '/metadata-sync/review' })).json()).toMatchObject({ count: 1, items: [{ title: 'Hades', status: 'NEEDS_REVIEW' }] });
    expect((await app.inject({ method: 'POST', url: '/metadata-sync/run' })).json()).toMatchObject({ checked: 2, applied: 1 });
  });

  it('usa um candidato, busca outro título e valida as entradas', async () => {
    const { app, service } = build();
    apps.push(app);
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/use`, payload: { providerId: 'igdb-2' } })).statusCode).toBe(200);
    expect(service.useCandidate).toHaveBeenCalledWith(GAME, 'igdb-2');
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/search`, payload: { query: 'Hades II' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/search`, payload: { query: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/metadata-sync/abc/ignore' })).statusCode).toBe(400);
  });

  it('responde 409 quando a ação não se aplica e 502 quando o provedor falha', async () => {
    const { app } = build({ syncGame: vi.fn(async () => 'FAILED') });
    apps.push(app);
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/ignore` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/confirm` })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: `/metadata-sync/${GAME}/sync` })).statusCode).toBe(502);
  });
});
