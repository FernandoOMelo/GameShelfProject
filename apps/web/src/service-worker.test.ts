// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: Record<string, unknown>) => void;

// Executa o public/sw.js real num sandbox com um CacheStorage em memória.
function loadWorker(fetchImpl: (request: Request) => Promise<Response>) {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (input: Request | string) => typeof input === 'string' ? `http://localhost${input}` : input.url;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: async (urls: string[]) => { for (const url of urls) store.set(keyOf(url), new Response(`shell ${url}`)); },
        put: async (input: Request | string, response: Response) => { store.set(keyOf(input), response); },
        match: async (input: Request | string) => store.get(keyOf(input))?.clone(),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { origin: 'http://localhost' }, clients: { claim: vi.fn(async () => undefined) }, skipWaiting: vi.fn(async () => undefined),
    addEventListener: (type: string, handler: Handler) => { handlers.set(type, handler); },
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, caches, fetch: fetchImpl, URL, Response, Promise });
  return { handlers, stores, self };
}

async function dispatch(worker: ReturnType<typeof loadWorker>, request: Request): Promise<Response | undefined> {
  let answer: Promise<Response> | undefined;
  worker.handlers.get('fetch')!({ request, respondWith: (promise: Promise<Response>) => { answer = promise; } });
  return answer;
}

const get = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
// A spec proíbe `new Request(url, { mode: 'navigate' })`; o worker só lê method, url e mode.
const navigate = (path: string) => ({ method: 'GET', url: `http://localhost${path}`, mode: 'navigate' }) as unknown as Request;
let online = true;
const network = vi.fn(async (request: Request) => {
  if (!online) throw new TypeError('offline');
  return new Response(`network ${new URL(request.url).pathname}`, { status: 200 });
});

beforeEach(() => { online = true; network.mockClear(); });

describe('service worker', () => {
  it('precaches the shell on install and drops old caches on activate', async () => {
    const worker = loadWorker(network);
    let installed: Promise<unknown> | undefined;
    worker.handlers.get('install')!({ waitUntil: (promise: Promise<unknown>) => { installed = promise; } });
    await installed;
    expect(worker.stores.get('gameshelf-v1')?.size).toBe(4);
    expect(worker.self.skipWaiting).toHaveBeenCalled();

    worker.stores.set('gameshelf-v0', new Map());
    let activated: Promise<unknown> | undefined;
    worker.handlers.get('activate')!({ waitUntil: (promise: Promise<unknown>) => { activated = promise; } });
    await activated;
    expect([...worker.stores.keys()]).toEqual(['gameshelf-v1']);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });

  it('serves API reads from the network and falls back to the last copy when offline', async () => {
    const worker = loadWorker(network);
    expect(await (await dispatch(worker, get('/api/games')))!.text()).toBe('network /api/games');
    online = false;
    expect(await (await dispatch(worker, get('/api/games')))!.text()).toBe('network /api/games');
    const unseen = (await dispatch(worker, get('/api/dashboard')))!;
    expect(unseen.status).toBe(503);
    expect(await unseen.json()).toEqual({ error: expect.stringContaining('Sem conexão') });
  });

  it('does not cache failed API responses', async () => {
    const worker = loadWorker(async () => new Response('boom', { status: 500 }));
    expect((await dispatch(worker, get('/api/games')))!.status).toBe(500);
    expect(worker.stores.get('gameshelf-v1')?.has('http://localhost/api/games')).toBeFalsy();
  });

  it('falls back to the cached app shell for any page when offline', async () => {
    const worker = loadWorker(network);
    const page = navigate('/biblioteca');
    await dispatch(worker, page);
    online = false;
    expect(await (await dispatch(worker, page))!.text()).toBe('network /biblioteca');
    const other = navigate('/fila');
    expect(await (await dispatch(worker, other))!.text()).toBe('network /biblioteca');
  });

  it('serves hashed assets and media from the cache after the first load', async () => {
    const worker = loadWorker(network);
    await dispatch(worker, get('/assets/index-abc.js'));
    await dispatch(worker, get('/media/cover.png'));
    network.mockClear();
    online = false;
    expect(await (await dispatch(worker, get('/assets/index-abc.js')))!.text()).toBe('network /assets/index-abc.js');
    expect(await (await dispatch(worker, get('/media/cover.png')))!.text()).toBe('network /media/cover.png');
    expect(network).not.toHaveBeenCalled();
  });

  it('never intercepts writes, backups, other origins or itself', async () => {
    const worker = loadWorker(network);
    expect(await dispatch(worker, get('/api/games/x/sessions', { method: 'POST', body: '{}' }))).toBeUndefined();
    expect(await dispatch(worker, get('/api/backup/export'))).toBeUndefined();
    expect(await dispatch(worker, new Request('https://images.igdb.com/a.jpg'))).toBeUndefined();
    expect(await dispatch(worker, get('/sw.js'))).toBeUndefined();
  });
});
