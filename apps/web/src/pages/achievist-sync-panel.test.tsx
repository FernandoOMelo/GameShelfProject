import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalIntegrationStatus, ExternalPendingMatch, ExternalSyncState, Game, Platform } from '@gameshelf/contracts';
import { AchievistSyncPanel } from './achievist-sync-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const games = [
  { id: 'game-1', title: 'Hades' },
  { id: 'game-2', title: 'HADES!' },
] as unknown as Game[];
const platforms: Platform[] = [{ id: 'platform-1', name: 'Steam', parentId: null }];

const state = (overrides: Partial<ExternalSyncState> = {}): ExternalSyncState => ({
  source: 'achievist', status: 'succeeded', startedAt: '2026-06-01T12:00:00.000Z', finishedAt: '2026-06-01T12:00:05.000Z',
  summary: { source: 'achievist', fetched: 4, updated: 1, pending: 1, ignored: 0, playtimeImported: 0, playtimeImportedMinutes: 0, achievementsSynced: 0, achievementsFailed: 0, gamesStarted: 0, sessionsCreated: 0, playthroughsCreated: 0 },
  error: null, ...overrides,
});

const match = (overrides: Partial<ExternalPendingMatch> = {}): ExternalPendingMatch => ({
  id: 'match-1', source: 'achievist', externalId: '501', title: 'Hades', platformName: 'Steam',
  accountLabel: 'fulano', externalPlaytimeMinutes: 1_200, externalLastPlayedAt: '2026-05-20T22:00:00.000Z',
  firstSeenAt: '2026-06-01T12:00:00.000Z', lastSeenAt: '2026-06-01T12:00:00.000Z',
  suggestions: [{ gameId: 'game-1', title: 'Hades' }], ambiguous: false, ...overrides,
});

/** Responde na ordem em que o painel consulta: diagnóstico, estado e fila. */
function serve(current: ExternalSyncState, pending: ExternalPendingMatch[], status: Partial<ExternalIntegrationStatus> = {}) {
  const integration: ExternalIntegrationStatus = { source: 'achievist', configured: true, reachable: true, accounts: 1, error: null, ...status };
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/status')) return Promise.resolve(Response.json(integration));
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
    expect(screen.getByRole('button', { name: /^Hades/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^HADES!/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Vincular a um jogo' })).toBeDisabled();
  });

  it('pre-selects the single suggestion but only links on confirmation', async () => {
    serve(state(), [match()]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    const chip = await screen.findByRole('button', { name: /^Hades/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/confirm'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Vincular a um jogo' }));

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
    await screen.findByText('Hades', { selector: 'strong' });

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações de Hades' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ignorar' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Ignorar entrada' })).getByRole('button', { name: 'Ignorar' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/pending/match-1/ignore'))).toBe(true));
  });

  it('tests the connection and reports how many accounts are connected', async () => {
    serve(state(), [], { reachable: true, accounts: 2 });
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByText(/2 contas conectadas no Achievist/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testar conexão' }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/status'));
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText(/Conexão confirmada/)).toBeInTheDocument();
    // O diagnóstico nunca exige usuário, senha ou URL no navegador.
    expect(screen.queryByText(/ACHIEVIST_USERNAME=/)).not.toBeInTheDocument();
  });

  it('reports a failed connection test without blaming the library', async () => {
    serve(state(), [], { reachable: false, accounts: null, error: 'O login no Achievist falhou com HTTP 401.' });
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('O login no Achievist falhou com HTTP 401.');
    expect(screen.getByRole('button', { name: 'Sincronizar agora' })).toBeInTheDocument();
  });

  it('finds another library game by search and links it', async () => {
    serve(state(), [match({ suggestions: [], ambiguous: false })]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    fireEvent.change(await screen.findByLabelText('Jogo correspondente a Hades'), { target: { value: 'hades!' } });
    fireEvent.click(screen.getByRole('button', { name: /^HADES!/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular a um jogo' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/pending/match-1/confirm'))).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('/confirm'))!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ gameId: 'game-2' });
  });

  it('filters the queue by ambiguity and by title', async () => {
    serve(state(), [
      match({ id: 'm1', title: 'Hades' }),
      match({ id: 'm2', title: 'Celeste', suggestions: [{ gameId: 'game-1', title: 'Hades' }, { gameId: 'game-2', title: 'HADES!' }], ambiguous: true }),
    ]);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);
    await screen.findByText('Celeste', { selector: 'strong' });

    fireEvent.click(screen.getByRole('button', { name: 'Ambíguos' }));
    expect(screen.queryByText('Hades', { selector: 'strong' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    fireEvent.change(screen.getByLabelText('Buscar entrada importada'), { target: { value: 'cele' } });
    expect(screen.queryByText('Hades', { selector: 'strong' })).not.toBeInTheDocument();
    expect(screen.getByText('Celeste', { selector: 'strong' })).toBeInTheDocument();
  });

  it('links every single-suggestion entry in a batch only after confirming', async () => {
    serve(state(), [
      match({ id: 'm1', title: 'Hades', suggestions: [{ gameId: 'game-1', title: 'Hades' }] }),
      match({ id: 'm2', title: 'Hades II', suggestions: [{ gameId: 'game-2', title: 'HADES!' }] }),
      match({ id: 'm3', title: 'Celeste', suggestions: [{ gameId: 'game-1', title: 'Hades' }, { gameId: 'game-2', title: 'HADES!' }], ambiguous: true }),
    ]);
    const serveQueue = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).endsWith('/confirm') ? Promise.resolve(Response.json({})) : serveQueue(input, init));
    render(<AchievistSyncPanel games={games} platforms={platforms} />);

    fireEvent.click(await screen.findByRole('button', { name: /Vincular todos com sugestão única \(2\)/ }));
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/confirm'))).toBe(true);
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Vincular com sugestão única' })).getByRole('button', { name: 'Vincular todos' }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/confirm')).length).toBe(2));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/m3/confirm'))).toBe(false);
  });

  it('shows an empty state when everything is linked', async () => {
    serve(state(), []);
    render(<AchievistSyncPanel games={games} platforms={platforms} />);
    expect(await screen.findByText(/Tudo vinculado/)).toBeInTheDocument();
  });
});
