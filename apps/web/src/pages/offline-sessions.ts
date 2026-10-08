import { apiUrl } from './shared';

// Fila local de operações de sessão feitas sem conexão (ADR-015). Fica em localStorage: funciona
// mesmo onde o service worker não pode ser registrado (HTTP na rede local).
//
// Há duas operações, as mesmas que a interface faz online:
// - create: iniciar uma sessão (POST). Pode estar em aberto (endedAt nulo) até o usuário encerrá-la offline;
// - finish: encerrar uma sessão que já existe no servidor (PATCH com endedAt).
type Base = {
  clientId: string;
  gameId: string;
  gameTitle: string;
  queuedAt: string;
  // Preenchido quando o servidor recusa o envio (jogo excluído, dados inválidos): o item fica para o usuário descartar.
  error?: string;
};
export type PendingCreate = Base & {
  kind: 'create';
  payload: { startedAt: string; endedAt: string | null; progress: number | null; location: string | null; notes: string | null };
};
export type PendingFinish = Base & { kind: 'finish'; sessionId: string; endedAt: string };
export type PendingSession = PendingCreate | PendingFinish;
export type NewPending = Omit<PendingCreate, 'clientId' | 'queuedAt' | 'error'> | Omit<PendingFinish, 'clientId' | 'queuedAt' | 'error'>;

export const PENDING_SESSIONS_KEY = 'gameshelf-offline-sessions';
export const MAX_PENDING_SESSIONS = 50;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): Store | undefined {
  try { return window.localStorage ?? undefined; } catch { return undefined; }
}

function isPending(value: unknown): value is PendingSession {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.clientId !== 'string' || typeof item.gameId !== 'string' || typeof item.gameTitle !== 'string' || typeof item.queuedAt !== 'string') return false;
  if (item.kind === 'finish') return typeof item.sessionId === 'string' && typeof item.endedAt === 'string';
  const payload = item.payload as Record<string, unknown> | null | undefined;
  return item.kind === 'create' && typeof payload === 'object' && payload !== null && typeof payload.startedAt === 'string';
}

export function loadPending(store: Store | undefined = defaultStore()): PendingSession[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(PENDING_SESSIONS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isPending) : [];
  } catch { return []; }
}

export function savePending(items: PendingSession[], store: Store | undefined = defaultStore()): boolean {
  try {
    store?.setItem(PENDING_SESSIONS_KEY, JSON.stringify(items));
    return store !== undefined;
  } catch { return false; }
}

// Erro de rede do fetch (TypeError) ou navegador sabidamente offline. Respostas HTTP de erro não contam.
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

// Sessão iniciada offline e ainda não encerrada.
export const isOpenCreate = (item: PendingSession): item is PendingCreate => item.kind === 'create' && item.payload.endedAt === null && !item.error;

export type EnqueueResult = { ok: true; items: PendingSession[] } | { ok: false; reason: 'full' | 'storage' | 'open' };

export function enqueueSession(item: NewPending, store: Store | undefined = defaultStore(), now: Date = new Date()): EnqueueResult {
  const current = loadPending(store);
  if (current.length >= MAX_PENDING_SESSIONS) return { ok: false, reason: 'full' };
  // Uma sessão em aberto por jogo, como no servidor (o botão de iniciar some quando já há uma ativa).
  if (item.kind === 'create' && item.payload.endedAt === null && current.some((entry) => entry.gameId === item.gameId && isOpenCreate(entry))) return { ok: false, reason: 'open' };
  // Encerrar a mesma sessão duas vezes não precisa de duas operações.
  if (item.kind === 'finish' && current.some((entry) => entry.kind === 'finish' && entry.sessionId === item.sessionId)) return { ok: true, items: current };
  const next = [...current, { ...item, clientId: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`, queuedAt: now.toISOString() } as PendingSession];
  return savePending(next, store) ? { ok: true, items: next } : { ok: false, reason: 'storage' };
}

// Encerra, offline, uma sessão que também foi iniciada offline: vira uma sessão completa na fila.
export function finishOpenPending(clientId: string, endedAt: string, store: Store | undefined = defaultStore()): PendingSession[] {
  const next = loadPending(store).map((item) => item.clientId === clientId && item.kind === 'create' && item.payload.endedAt === null
    ? { ...item, payload: { ...item.payload, endedAt: new Date(Math.max(Date.parse(endedAt), Date.parse(item.payload.startedAt))).toISOString() } }
    : item);
  savePending(next, store);
  return next;
}

export function discardPending(clientId: string, store: Store | undefined = defaultStore()): PendingSession[] {
  const next = loadPending(store).filter((item) => item.clientId !== clientId);
  savePending(next, store);
  return next;
}

export type FlushResult = { synced: number; rejected: number; items: PendingSession[] };

let flushing: Promise<FlushResult> | undefined;

// Envia em ordem. Sucesso e 409 (criação já registrada em um envio anterior cuja resposta se perdeu) removem o item;
// falha de rede interrompe e mantém o restante; outras recusas marcam o item com o erro.
export function flushPending(fetcher: typeof fetch = fetch, store: Store | undefined = defaultStore()): Promise<FlushResult> {
  flushing ??= run(fetcher, store).finally(() => { flushing = undefined; });
  return flushing;
}

function request(item: PendingSession): [string, RequestInit] {
  const headers = { 'content-type': 'application/json' };
  return item.kind === 'create'
    ? [`${apiUrl}/games/${item.gameId}/sessions`, { method: 'POST', headers, body: JSON.stringify(item.payload) }]
    : [`${apiUrl}/games/${item.gameId}/sessions/${item.sessionId}`, { method: 'PATCH', headers, body: JSON.stringify({ endedAt: item.endedAt }) }];
}

async function run(fetcher: typeof fetch, store: Store | undefined): Promise<FlushResult> {
  let items = loadPending(store);
  let synced = 0;
  let rejected = 0;
  for (const item of items.filter((entry) => !entry.error)) {
    let response: Response;
    try {
      response = await fetcher(...request(item));
    } catch { break; }
    if (response.ok || (item.kind === 'create' && response.status === 409)) {
      items = items.filter((entry) => entry.clientId !== item.clientId);
      synced += 1;
    } else {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      items = items.map((entry) => entry.clientId === item.clientId ? { ...entry, error: body?.error ?? `O servidor recusou a sessão (${response.status}).` } : entry);
      rejected += 1;
    }
    savePending(items, store);
  }
  return { synced, rejected, items };
}
