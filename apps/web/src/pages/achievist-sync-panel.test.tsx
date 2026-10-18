import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalPendingMatch, ExternalSyncState, Game, Platform } from '@gameshelf/contracts';
import { AchievistSyncPanel } from './achievist-sync-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const games = [
  { id: 'game-1', title: 'Hades' },
  { id: 'game-2', title: 'HADES!' },
] as unknown as Game[];
const platforms: Platform[] = [{ id: 'platform-1', name: 'Steam' }];

const state = (overrides: Partial<ExternalSyncState> = {}): ExternalSyncState => ({
  source: 'achievist', status: 'succeeded', startedAt: '2026-06-01T12:00:00.000Z', finishedAt: '2026-06-01T12:00:05.000Z',
  summary: { source: 'achievist', fetched: 4, updated: 1, pending: 1, ignored: 0, sessionsCreated: 0, playthroughsCreated: 0 },
  error: null, ...overrides,
});

const match = (overrides: Partial<ExternalPendingMatch> = {}): ExternalPendingMatch => ({
  id: 'match-1', source: 'achievist', externalId: '501', title: 'Hades', platformName: 'Steam',
  accountLabel: 'fulano', externalPlaytimeMinutes: 1_200, externalLastPlayedAt: '2026-05-20T22:00:00.000Z',
  firstSeenAt: '2026-06-01T12:00:00.000Z', lastSeenAt: '2026-06-01T12:00:00.000Z',
  suggestions: [{ gameId: 'game-1', title: 'Hades' }], ambiguous: false, ...overrides,
});

/** Responde na ordem em que o painel consulta: estado e depois a fila. */
function serve(current: ExternalSyncState, pending: ExternalPendingMatch[]) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/sync')) return Promise.resolve(Response.json(current, { status: init?.method === 'POST' ? 202 : 200 }));
    if (url.endsWith('/pending')) return Promise.resolve(Response.json(pending));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
}

describe('AchievistSyncPanel', () => {
  it('states that nothing is created by a sync and summarises the last run', async () => {
    serve(state(), [match()]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByText(/4 entradas lidas/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma sessão ou jornada criada/)).toBeInTheDocument();
    expect(screen.getByText(/nunca cria sessão, jornada ou replay/)).toBeInTheDocument();
    expect(screen.getByText(/Tempo informado pela plataforma: 20 horas/)).toBeInTheDocument();
  });

  it('marks an ambiguous match and leaves the choice empty', async () => {
    serve(state(), [match({ ambiguous: true, suggestions: [{ gameId: 'game-1', title: 'Hades' }, { gameId: 'game-2', title: 'HADES!' }] })]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByText(/2 jogos da sua biblioteca têm este título/)).toBeInTheDocument();
    expect(screen.getByLabelText('Jogo correspondente a Hades')).toHaveValue('');
  });

  it('pre-selects the single suggestion but only links on confirmation', async () => {
    serve(state(), [match()]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    const select = await screen.findByLabelText('Jogo correspondente a Hades');
    expect(select).toHaveValue('game-1');
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/confirm'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculo' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/pending/match-1/confirm'))).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('/confirm'))!;
    expect(JSON.parse(String(init?.body))).toEqual({ gameId: 'game-1', platformId: 'platform-1' });
  });

  it('reports a failed run without suggesting the library is broken', async () => {
    serve(state({ status: 'failed', summary: null, error: 'O Achievist respondeu HTTP 502 em /api/games.' }), []);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByText(/HTTP 502/)).toBeInTheDocument();
    expect(screen.getByText(/A biblioteca e as sessões seguem normais/)).toBeInTheDocument();
  });

  it('explains how to enable the integration when it is off, and asks for nothing else', async () => {
    serve(state({ status: 'disabled', summary: null, startedAt: null, finishedAt: null, error: 'A integração está desligada: configure ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD.' }), []);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByText(/A integração está desligada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith('/pending'))).toBe(true);
  });

  it('keeps an entry out of future runs when the user ignores it', async () => {
    serve(state(), [match()]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);
    await screen.findByText('Hades');

    fireEvent.click(screen.getByRole('button', { name: 'Ignorar' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/pending/match-1/ignore'))).toBe(true));
  });
});
