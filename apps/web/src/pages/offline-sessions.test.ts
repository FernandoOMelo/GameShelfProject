import { describe, expect, it, vi } from 'vitest';
import {
  discardPending, enqueueSession, finishOpenPending, flushPending, isNetworkFailure, isOpenCreate, loadPending, MAX_PENDING_SESSIONS,
  PENDING_SESSIONS_KEY, type NewPending,
} from './offline-sessions';

function memoryStore(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[PENDING_SESSIONS_KEY, initial]]);
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

const closed = { startedAt: '2026-03-01T10:00:00.000Z', endedAt: '2026-03-01T11:00:00.000Z', progress: 40, location: 'Hyrule', notes: null };
const open = { ...closed, endedAt: null };
type Payload = { startedAt: string; endedAt: string | null; progress: number | null; location: string | null; notes: string | null };
const create = (gameId: string, payload: Payload = closed): NewPending => ({ kind: 'create', gameId, gameTitle: `Jogo ${gameId}`, payload });
const finish = (gameId: string, sessionId: string): NewPending => ({ kind: 'finish', gameId, gameTitle: `Jogo ${gameId}`, sessionId, endedAt: '2026-03-01T12:00:00.000Z' });
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

describe('offline session queue', () => {
  it('persists queued operations in order and survives a reload', () => {
    const store = memoryStore();
    expect(enqueueSession(create('a'), store).ok).toBe(true);
    expect(enqueueSession(finish('b', 's1'), store).ok).toBe(true);
    expect(loadPending(store).map((entry) => [entry.kind, entry.gameId])).toEqual([['create', 'a'], ['finish', 'b']]);
    expect(new Set(loadPending(store).map((entry) => entry.clientId)).size).toBe(2);
  });

  it('ignores corrupted storage and malformed entries', () => {
    expect(loadPending(memoryStore('not json'))).toEqual([]);
    expect(loadPending(memoryStore('{"a":1}'))).toEqual([]);
    const valid = { clientId: 'x', kind: 'create', gameId: 'g', gameTitle: 't', queuedAt: 'q', payload: closed };
    const entries = [{ nope: true }, valid, { ...valid, kind: 'other' }, { clientId: 'y', kind: 'finish', gameId: 'g', gameTitle: 't', queuedAt: 'q' }];
    expect(loadPending(memoryStore(JSON.stringify(entries)))).toEqual([valid]);
    expect(loadPending(undefined)).toEqual(expect.any(Array));
  });

  it('refuses to grow past the limit and reports unusable storage', () => {
    const store = memoryStore();
    for (let index = 0; index < MAX_PENDING_SESSIONS; index += 1) enqueueSession(create(String(index)), store);
    expect(enqueueSession(create('extra'), store)).toEqual({ ok: false, reason: 'full' });
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(enqueueSession(create('a'), broken)).toEqual({ ok: false, reason: 'storage' });
  });

  it('allows one open session per game and does not queue the same finish twice', () => {
    const store = memoryStore();
    expect(enqueueSession(create('a', open), store).ok).toBe(true);
    expect(enqueueSession(create('a', open), store)).toEqual({ ok: false, reason: 'open' });
    expect(enqueueSession(create('b', open), store).ok).toBe(true);
    enqueueSession(finish('c', 's1'), store);
    enqueueSession(finish('c', 's1'), store);
    expect(loadPending(store).filter((entry) => entry.kind === 'finish')).toHaveLength(1);
  });

  it('turns an open offline session into a complete one when it is finished offline, never before its start', () => {
    const store = memoryStore();
    enqueueSession(create('a', open), store);
    const [entry] = loadPending(store);
    expect(isOpenCreate(entry!)).toBe(true);
    const [finished] = finishOpenPending(entry!.clientId, '2026-03-01T12:30:00.000Z', store);
    expect(finished).toMatchObject({ kind: 'create', payload: { endedAt: '2026-03-01T12:30:00.000Z' } });
    expect(isOpenCreate(finished!)).toBe(false);
    enqueueSession(create('b', open), store);
    const second = loadPending(store)[1]!;
    const [, clamped] = finishOpenPending(second.clientId, '2000-01-01T00:00:00.000Z', store);
    expect(clamped).toMatchObject({ payload: { endedAt: open.startedAt } });
  });

  it('discards a single entry', () => {
    const store = memoryStore();
    enqueueSession(create('a'), store);
    enqueueSession(create('b'), store);
    const [first] = loadPending(store);
    expect(discardPending(first!.clientId, store).map((entry) => entry.gameId)).toEqual(['b']);
  });

  it('tells network failures from HTTP errors', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new Error('Dados inválidos.'))).toBe(false);
  });
});

describe('flushing the queue', () => {
  it('sends creations as POST and finishes as PATCH, in order; a 409 on a creation counts as already registered', async () => {
    const store = memoryStore();
    enqueueSession(create('a'), store);
    enqueueSession(finish('b', 's9'), store);
    enqueueSession(create('c'), store);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ id: 's1' }, 201)).mockResolvedValueOnce(json({ id: 's9' }, 200)).mockResolvedValueOnce(json({ error: 'Já existe' }, 409));
    const result = await flushPending(fetcher, store);
    expect(result).toMatchObject({ synced: 3, rejected: 0, items: [] });
    expect(fetcher.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual(['POST /api/games/a/sessions', 'PATCH /api/games/b/sessions/s9', 'POST /api/games/c/sessions']);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual(closed);
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ endedAt: '2026-03-01T12:00:00.000Z' });
    expect(loadPending(store)).toEqual([]);
  });

  it('sends a session still open as an open session', async () => {
    const store = memoryStore();
    enqueueSession(create('a', open), store);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 201));
    await flushPending(fetcher, store);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({ endedAt: null });
  });

  it('stops at the first network failure and keeps the rest for later', async () => {
    const store = memoryStore();
    for (const id of ['a', 'b', 'c']) enqueueSession(create(id), store);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 201)).mockRejectedValueOnce(new TypeError('offline'));
    const result = await flushPending(fetcher, store);
    expect(result.synced).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(loadPending(store).map((entry) => entry.gameId)).toEqual(['b', 'c']);
  });

  it('keeps a rejected operation with the server error, continues with the others and does not resend it', async () => {
    const store = memoryStore();
    enqueueSession(finish('a', 's1'), store);
    enqueueSession(create('b'), store);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: 'Sessão não encontrada.' }, 404)).mockResolvedValueOnce(json({}, 201));
    const result = await flushPending(fetcher, store);
    expect(result).toMatchObject({ synced: 1, rejected: 1 });
    expect(loadPending(store)).toEqual([expect.objectContaining({ gameId: 'a', error: 'Sessão não encontrada.' })]);
    const again = vi.fn<typeof fetch>();
    expect(await flushPending(again, store)).toMatchObject({ synced: 0, rejected: 0 });
    expect(again).not.toHaveBeenCalled();
  });

  it('does not treat a 409 on a finish as success', async () => {
    const store = memoryStore();
    enqueueSession(finish('a', 's1'), store);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ error: 'conflito' }, 409));
    expect(await flushPending(fetcher, store)).toMatchObject({ synced: 0, rejected: 1 });
  });

  it('shares one run between concurrent calls', async () => {
    const store = memoryStore();
    enqueueSession(create('a'), store);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 201));
    const [first, second] = await Promise.all([flushPending(fetcher, store), flushPending(fetcher, store)]);
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
