import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

const fetchMock = vi.fn();

function makeGame(id: string, title: string, status: string = 'BACKLOG') {
  return {
    id, title, description: null, coverUrl: null, backgroundUrl: null, releaseYear: null,
    developer: null, publisher: null, franchiseId: null, platformIds: [], genreIds: [],
    status, priority: 'NORMAL', estimatedMainHours: 10, estimatedCompletionistHours: null,
    personalEstimatedHours: null, notes: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockApi(games: unknown[] = [], initialQueue: unknown[] = []) {
  const queue = [...initialQueue] as Array<{ position: number; addedAt: string; game: { id: string; title: string } }>;
  let weeklyMinutes = 0;
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/games' && method === 'POST') return new Response(JSON.stringify({ id: 'new-game' }), { status: 201 });
    if (url.match(/^\/api\/games\/[^/]+$/) && method === 'DELETE') return new Response(null, { status: 204 });
    if (url === '/api/games') return new Response(JSON.stringify(games), { status: 200 });
    if (url === '/api/queue' && method === 'GET') return new Response(JSON.stringify(queue), { status: 200 });
    if (url === '/api/queue' && method === 'POST') {
      const { gameId } = JSON.parse(String(init?.body)) as { gameId: string };
      const queuedGame = games.find((item) => (item as { id: string }).id === gameId);
      const item = { position: queue.length, addedAt: new Date().toISOString(), game: queuedGame as { id: string; title: string } };
      queue.push(item);
      return new Response(JSON.stringify(item), { status: 201 });
    }
    if (url.startsWith('/api/queue/') && method === 'DELETE') {
      const gameId = url.split('/').at(-1);
      const index = queue.findIndex((item) => item.game.id === gameId);
      if (index >= 0) queue.splice(index, 1);
      queue.forEach((item, position) => { item.position = position; });
      return new Response(null, { status: 204 });
    }
    if (url === '/api/queue/order' && method === 'PUT') {
      const { gameIds } = JSON.parse(String(init?.body)) as { gameIds: string[] };
      queue.sort((left, right) => gameIds.indexOf(left.game.id) - gameIds.indexOf(right.game.id));
      queue.forEach((item, position) => { item.position = position; });
      return new Response(JSON.stringify(queue), { status: 200 });
    }
    if (url === '/api/dashboard') return new Response(JSON.stringify({
      gameCount: games.length, completedCount: 0, playingCount: 0, abandonedCount: 0,
      totalPlayedHours: 0, backlogRemainingHours: 0, weeklyHours: weeklyMinutes / 60,
      queueRemainingHours: 0, estimatedQueueWeeks: weeklyMinutes > 0 ? 0 : null,
      currentGame: null, queuePreview: queue.slice(0, 5),
    }), { status: 200 });
    if (url === '/api/planning/settings' && method === 'PUT') {
      weeklyMinutes = (JSON.parse(String(init?.body)) as { weeklyMinutes: number }).weeklyMinutes;
      return new Response(JSON.stringify({ weeklyMinutes }), { status: 200 });
    }
    if (url.includes('/sessions') && ['POST', 'PATCH'].includes(method)) {
      const session = JSON.parse(String(init?.body));
      const startedAt = new Date(session.startedAt);
      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
      return new Response(JSON.stringify({
        id: '00000000-0000-4000-8000-000000000040', gameId: url.split('/')[3], ...session,
        durationMinutes: endedAt ? Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000) : null,
        progress: session.progress ?? null, location: session.location ?? null, notes: session.notes ?? null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }), { status: method === 'POST' ? 201 : 200 });
    }
    if (url.includes('/sessions/') && method === 'DELETE') return new Response(null, { status: 204 });
    if (url.endsWith('/sessions')) return new Response('[]', { status: 200 });
    if (url.endsWith('/franchises') && method === 'POST') return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000010', name: JSON.parse(String(init?.body)).name }), { status: 201 });
    if (url.endsWith('/platforms') && method === 'POST') {
      const { name } = JSON.parse(String(init?.body));
      const id = name === 'Nintendo Switch' ? '00000000-0000-4000-8000-000000000020' : '00000000-0000-4000-8000-000000000021';
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (url.endsWith('/genres') && method === 'POST') {
      const { name } = JSON.parse(String(init?.body));
      const id = name === 'Ação' ? '00000000-0000-4000-8000-000000000030' : '00000000-0000-4000-8000-000000000031';
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    return new Response('[]', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('library page', () => {
  it('shows an empty state when the API has no games', async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByText('Sua biblioteca começa aqui')).toBeInTheDocument();
  });

  it('creates a game through the API', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar primeiro jogo' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Hades' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar jogo' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the game details page from a library card', async () => {
    const game = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: 'Escape from the Underworld.',
      coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: 'Supergiant Games', publisher: null, franchiseId: null,
      platformIds: [], genreIds: [], status: 'PLAYING', priority: 'HIGH', estimatedMainHours: 22, estimatedCompletionistHours: null,
      personalEstimatedHours: 30, notes: 'Reached Elysium.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    expect(screen.getByRole('heading', { name: 'Hades' })).toBeInTheDocument();
    expect(screen.getByText('Escape from the Underworld.')).toBeInTheDocument();
    expect(screen.getByText('30 h')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar jogo' })).toBeInTheDocument();
  });

  it('creates and associates a franchise, platform and genre', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar primeiro jogo' }));
    await screen.findByRole('heading', { name: 'Adicionar jogo' });
    screen.getByRole('textbox', { name: /Plataformas/ });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Metroid Dread' } });
    fireEvent.change(screen.getByLabelText('Franquia'), { target: { value: 'Metroid' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Plataformas/ }), { target: { value: 'Nintendo Switch, PC' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Gêneros/ }), { target: { value: 'Ação, Metroidvania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar jogo' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({ method: 'POST' })));
    const gameRequest = fetchMock.mock.calls.find(([url, init]) => url === '/api/games' && init?.method === 'POST');
    expect(gameRequest).toBeDefined();
    expect(JSON.parse(String(gameRequest?.[1]?.body))).toMatchObject({
      franchiseId: '00000000-0000-4000-8000-000000000010',
      platformIds: ['00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000021'],
      genreIds: ['00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000031'],
    });
  });

  it('registers a session from a game detail page and displays its duration', async () => {
    const game = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
      coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: 'Supergiant Games', publisher: null, franchiseId: null,
      platformIds: [], genreIds: [], status: 'PLAYING', priority: 'NORMAL', estimatedMainHours: null,
      estimatedCompletionistHours: null, personalEstimatedHours: null, notes: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Nenhuma sessão registrada.');
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-01-01T10:00' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endedAt"]')!, { target: { value: '' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Progresso (%)' }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Onde parou' }), { target: { value: 'Elysium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sessão' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions`, expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Elysium · 50%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar sessão' }));
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endedAt"]')!, { target: { value: '2026-01-01T11:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sessão' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions/00000000-0000-4000-8000-000000000040`, expect.objectContaining({ method: 'PATCH' })));
    expect(await screen.findByText('1 h 30 min')).toBeInTheDocument();
  });

  it('deletes a session from the history after confirmation', async () => {
    const game = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
      coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null, franchiseId: null,
      platformIds: [], genreIds: [], status: 'PLAYING', priority: 'NORMAL', estimatedMainHours: null,
      estimatedCompletionistHours: null, personalEstimatedHours: null, notes: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const session = {
      id: '00000000-0000-4000-8000-000000000040', gameId: game.id,
      startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T11:00:00.000Z', durationMinutes: 60,
      progress: null, location: 'Elysium', notes: null,
      createdAt: '2026-01-01T11:00:00.000Z', updatedAt: '2026-01-01T11:00:00.000Z',
    };
    mockApi([game]);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/sessions') && !init?.method) return new Response(JSON.stringify([session]), { status: 200 });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url === '/api/queue') return new Response('[]', { status: 200 });
      if (url === '/api/dashboard') return new Response(JSON.stringify({
        gameCount: 1, completedCount: 0, playingCount: 1, abandonedCount: 0, totalPlayedHours: 0,
        backlogRemainingHours: 0, weeklyHours: 0, queueRemainingHours: 0, estimatedQueueWeeks: null,
        currentGame: null, queuePreview: [],
      }), { status: 200 });
      return new Response(JSON.stringify([game]), { status: 200 });
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Elysium');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir sessão' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions/${session.id}`, { method: 'DELETE' }));
    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText('Sessão excluída.')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma sessão registrada.')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('adds games to the queue, displays the order and moves entries', async () => {
    const hades = makeGame('00000000-0000-4000-8000-000000000001', 'Hades');
    const hollowKnight = makeGame('00000000-0000-4000-8000-000000000002', 'Hollow Knight');
    mockApi([hades, hollowKnight]);
    render(<App />);
    await screen.findByRole('button', { name: 'Ver detalhes de Hades' });
    fireEvent.click(screen.getAllByRole('button', { name: '＋ Adicionar à fila' })[0]!);
    await screen.findByRole('button', { name: 'Na fila · Remover' });
    fireEvent.click(screen.getByRole('button', { name: /^Fila/ }));
    expect(await screen.findByRole('heading', { name: 'Fila de jogos' })).toBeInTheDocument();
    expect(screen.getByText('Hades')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Adicionar à fila' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Na fila · Remover' })).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /^Fila/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover Hollow Knight para cima' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mover .* para cima/ })[0]).toBeDisabled();
      expect(screen.getAllByRole('button', { name: /Mover .* para cima/ })[1]).toBeEnabled();
    });
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Hollow Knight');
  });

  it('filters library games and displays the dashboard with its weekly goal', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'PLAYING'), makeGame('00000000-0000-4000-8000-000000000002', 'Celeste')]);
    render(<App />);
    await screen.findByRole('button', { name: 'Ver detalhes de Hades' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'PLAYING' } });
    expect(screen.getByRole('button', { name: 'Ver detalhes de Hades' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver detalhes de Celeste' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Painel' }));
    expect(await screen.findByRole('heading', { name: 'Seu ritmo de jogo' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutos disponíveis por semana' }), { target: { value: '360' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(await screen.findByText('Meta semanal salva.')).toBeInTheDocument();
  });
});
