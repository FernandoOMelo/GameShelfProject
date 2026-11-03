import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { IntegrationHealthTracker } from './health.js';
import { registerIntegrationHealthRoutes } from './health-routes.js';

describe('IntegrationHealthTracker', () => {
  it('registra sucesso e falha das chamadas reais do provider sem alterar o resultado', async () => {
    const tracker = new IntegrationHealthTracker();
    tracker.register({ key: 'rawg', name: 'RAWG', envVars: ['RAWG_API_KEY'], configured: true });
    const provider = tracker.track('rawg', {
      id: 'x',
      ok: async (value: number) => value * 2,
      fail: async () => { throw new Error('HTTP 401'); },
    }, ['ok', 'fail']);

    await expect(provider.ok(2)).resolves.toBe(4);
    expect(tracker.snapshot()[0]).toMatchObject({ lastOk: true, lastMessage: 'ok respondeu normalmente.' });
    await expect(provider.fail()).rejects.toThrow('HTTP 401');
    const [snapshot] = tracker.snapshot();
    expect(snapshot).toMatchObject({ lastOk: false, lastMessage: 'HTTP 401' });
    expect(snapshot?.lastSuccessAt).not.toBeNull();
  });

  it('testar roda a chamada leve, e avisa quando a integração não está configurada', async () => {
    const tracker = new IntegrationHealthTracker();
    tracker.register({ key: 'igdb', name: 'IGDB', envVars: ['IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'], configured: true, check: async () => '5 resultados' });
    tracker.register({ key: 'rawg', name: 'RAWG', envVars: ['RAWG_API_KEY'], configured: false });

    expect(await tracker.test('igdb')).toMatchObject({ lastOk: true, lastMessage: '5 resultados' });
    expect(await tracker.test('rawg')).toMatchObject({ lastOk: false, lastMessage: 'Não configurada: defina RAWG_API_KEY.' });
    expect(await tracker.test('achievist')).toBeUndefined();
  });
});

describe('rotas de saúde das integrações', () => {
  it('lista o estado e executa o teste sob demanda', async () => {
    const tracker = new IntegrationHealthTracker();
    tracker.register({ key: 'rawg', name: 'RAWG', envVars: ['RAWG_API_KEY'], configured: true, check: async () => 'ok' });
    const app = Fastify();
    await registerIntegrationHealthRoutes(app, tracker);

    expect((await app.inject('/integrations/health')).json()).toMatchObject([{ key: 'rawg', configured: true, lastOk: null }]);
    const tested = await app.inject({ method: 'POST', url: '/integrations/health/rawg/test' });
    expect(tested.json()).toMatchObject({ key: 'rawg', lastOk: true });
    expect((await app.inject({ method: 'POST', url: '/integrations/health/outra/test' })).statusCode).toBe(404);
    await app.close();
  });
});
