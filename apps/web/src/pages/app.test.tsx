import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

const fetchMock = vi.fn();

function makeGame(id: string, title: string, status: string = 'BACKLOG') {
  return {
    id, title, description: null, coverUrl: null, backgroundUrl: null, releaseYear: null,
    developer: null, publisher: null, franchiseId: null, platformId: null, genreIds: [], rating: null, owned: true, archived: false, startedAt: null, completedAt: null,
    status, priority: 'NORMAL', estimatedMainHours: 10, estimatedCompletionistHours: null,
    personalEstimatedHours: null, notes: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockApi(games: unknown[] = [], initialQueue: unknown[] = []) {
  const queue = [...initialQueue] as Array<{ position: number; addedAt: string; game: { id: string; title: string } }>;
  const lists: Array<{ id: string; name: string; gameIds: string[] }> = [];
  let weeklyMinutes = 0;
  const goals: Array<Record<string, unknown>> = [];
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.startsWith('/api/metadata/games?')) return new Response(JSON.stringify([{
      providerId: 'igdb-123', title: 'Hades', description: 'Escape the Underworld.', releaseYear: 2020,
      coverUrl: 'https://images.example/hades.jpg', developer: 'Supergiant Games', genres: ['Roguelike'], platforms: ['PC'],
    }]), { status: 200 });
    if (url === '/api/lists' && method === 'GET') return new Response(JSON.stringify(lists.map((list) => ({ id: list.id, name: list.name, gameCount: list.gameIds.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))), { status: 200 });
    if (url === '/api/lists' && method === 'POST') {
      const { name } = JSON.parse(String(init?.body)) as { name: string };
      const list = { id: `00000000-0000-4000-8000-${String(lists.length + 50).padStart(12, '0')}`, name, gameIds: [] };
      lists.push(list);
      return new Response(JSON.stringify({ id: list.id, name, gameCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), { status: 201 });
    }
    if (url.match(/^\/api\/lists\/[^/]+\/games$/) && method === 'POST') {
      const list = lists.find((item) => url.includes(item.id));
      const { gameId } = JSON.parse(String(init?.body)) as { gameId: string };
      if (list) list.gameIds.push(gameId);
      return new Response(null, { status: 204 });
    }
    if (url.match(/^\/api\/lists\/[^/]+\/games\/[^/]+$/) && method === 'DELETE') {
      const parts = url.split('/');
      const list = lists.find((item) => item.id === parts[3]);
      if (list) list.gameIds = list.gameIds.filter((id) => id !== parts[5]);
      return new Response(null, { status: 204 });
    }
    if (url.match(/^\/api\/lists\/[^/]+$/) && method === 'GET') {
      const list = lists.find((item) => url.endsWith(item.id));
      const listGames = list?.gameIds.map((id) => games.find((game) => (game as { id: string }).id === id)).filter(Boolean) ?? [];
      return new Response(JSON.stringify(list ? { id: list.id, name: list.name, gameCount: list.gameIds.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), games: listGames } : null), { status: list ? 200 : 404 });
    }
    if (url.match(/^\/api\/lists\/[^/]+$/) && method === 'PATCH') {
      const list = lists.find((item) => url.endsWith(item.id));
      const { name } = JSON.parse(String(init?.body)) as { name: string };
      if (list) list.name = name;
      return new Response(JSON.stringify(list ? { id: list.id, name, gameCount: list.gameIds.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : null), { status: list ? 200 : 404 });
    }
    if (url.match(/^\/api\/lists\/[^/]+$/) && method === 'DELETE') {
      const list = lists.findIndex((item) => url.endsWith(item.id));
      if (list >= 0) lists.splice(list, 1);
      return new Response(null, { status: 204 });
    }
    if (url === '/api/games' && method === 'POST') return new Response(JSON.stringify({ id: 'new-game' }), { status: 201 });
    if (url.match(/^\/api\/games\/[^/]+$/) && method === 'PATCH') {
      const id = url.split('/').at(-1);
      const game = games.find((item) => (item as { id: string }).id === id) as Record<string, unknown> | undefined;
      const updates = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (game) Object.assign(game, updates);
      return new Response(JSON.stringify(game), { status: game ? 200 : 404 });
    }
    if (url.match(/^\/api\/games\/[^/]+$/) && method === 'DELETE') return new Response(null, { status: 204 });
    if (url === '/api/games') return new Response(JSON.stringify(games), { status: 200 });
    if (url.startsWith('/api/goals') && method === 'GET') return new Response(JSON.stringify(goals), { status: 200 });
    if (url === '/api/goals' && method === 'POST') {
      const input = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (input.target === 99) return new Response(JSON.stringify({ error: 'duplicada' }), { status: 409 });
      goals.push({ id: '00000000-0000-4000-8000-000000000900', month: null, current: 3, percent: 25, elapsedPercent: 50, achieved: false, onTrack: false, ...input });
      return new Response(JSON.stringify(goals.at(-1)), { status: 201 });
    }
    if (url.startsWith('/api/goals/') && method === 'DELETE') { goals.splice(0, goals.length); return new Response(null, { status: 204 }); }
    if (url.startsWith('/api/backlog/suggestions')) return new Response(JSON.stringify(games.slice(0, 2).map((item, position) => ({ game: item, score: 50 - position, reasons: position === 0 ? ['Primeiro da fila', 'Prioridade alta'] : ['Pausado: dá para retomar de onde parou'] }))), { status: 200 });
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
    if (url.startsWith('/api/stats/replay')) return new Response(JSON.stringify({
      year: new Date().getFullYear(), totalMinutes: 270, sessionCount: 3, activeDays: 3, completedCount: 2,
      mostPlayedGame: { id: '00000000-0000-4000-8000-000000000001', title: 'Hades', coverUrl: null, minutes: 180 },
      topGenre: { name: 'RPG', minutes: 270 }, longestSession: null, busiestMonth: { month: 2, minutes: 180 }, gameOfYear: null,
    }), { status: 200 });
    if (url.startsWith('/api/stats/activity')) return new Response(JSON.stringify({
      year: new Date().getFullYear(), days: [{ date: `${new Date().getFullYear()}-03-01`, minutes: 90 }], activeDays: 1, totalMinutes: 90, maxDayMinutes: 90, currentStreak: 0, longestStreak: 3,
    }), { status: 200 });
    if (url === '/api/stats') return new Response(JSON.stringify({
      totals: { completedCount: 2, completedHours: 42, averageCompletedHours: 21, longestGame: { id: '00000000-0000-4000-8000-000000000001', title: 'Hades', coverUrl: null, hours: 30 }, shortestGame: null, journeyStart: '2024-01-01', journeyDays: 400 },
      ratingDistribution: [{ rating: 11, count: 1 }, { rating: 10, count: 0 }], difficultyDistribution: [{ difficulty: 'AAA', count: 0 }, { difficulty: 'C', count: 2 }],
      byGenre: [{ key: 'g1', name: 'RPG', completedCount: 2, hours: 42, averageRating: 9 }], byType: [], byPlatform: [],
      byYear: [{ year: 2025, completedCount: 2, hours: 42, gameOfYear: { id: '00000000-0000-4000-8000-000000000001', title: 'Hades', coverUrl: null, hours: 30 } }],
      favorites: [{ id: '00000000-0000-4000-8000-000000000001', title: 'Hades', coverUrl: null, hours: 30, rating: 11 }], topGenres: [], topTypes: [],
    }), { status: 200 });
    if (url === '/api/challenge' && method === 'GET') return new Response(JSON.stringify({ title: 'Zerar clássicos', listId: '00000000-0000-4000-8000-000000000050', listName: 'Clássicos', totalGames: 4, completedGames: 1, percent: 25 }), { status: 200 });
    if (url.startsWith('/api/dashboard')) {
      const playingGames = games.filter((item) => (item as { status?: string }).status === 'PLAYING' && !(item as { archived?: boolean }).archived).map((item) => ({ game: item, playedHours: 0, progress: null, lastSession: null, activeSession: null, estimatedHours: null, remainingHours: null }));
      return new Response(JSON.stringify({
      gameCount: games.length, desiredCount: 0, backlogCount: 0, completedCount: 0, playingCount: playingGames.length, pausedCount: 0, abandonedCount: 0, archivedCount: 0,
      totalPlayedHours: 0, backlogRemainingHours: 0, weeklyHours: weeklyMinutes / 60,
      queueRemainingHours: 0, estimatedQueueWeeks: weeklyMinutes > 0 ? 0 : null,
      backlogForecast: weeklyMinutes > 0
        ? { estimatedWeeks: 8, estimatedMonths: 1.8, gamesWithoutEstimate: 2, stalledGames: playingGames.slice(0, 1).map((entry) => ({ game: entry.game, daysStalled: 45, remainingHours: 12 })) }
        : { estimatedWeeks: null, estimatedMonths: null, gamesWithoutEstimate: 0, stalledGames: [] },
      currentGame: null, playingGames, period: { from: null, to: null }, periodStats: { playedHours: 0, sessions: 0, gamesPlayed: 0, gamesCompleted: 0 }, queuePreview: queue.slice(0, 5),
    }), { status: 200 });
    }
    if (url === '/api/planning/settings' && method === 'PUT') {
      weeklyMinutes = (JSON.parse(String(init?.body)) as { weeklyMinutes: number }).weeklyMinutes;
      return new Response(JSON.stringify({ weeklyMinutes }), { status: 200 });
    }
    if (url.includes('/sessions') && ['POST', 'PATCH'].includes(method)) {
      const session = JSON.parse(String(init?.body));
      const startedAt = new Date(session.startedAt);
      const endedAt = session.endedAt ? new Date(session.endedAt) : null;
      return new Response(JSON.stringify({
        id: url.split('/').at(-1)?.includes('-') ? url.split('/').at(-1) : '00000000-0000-4000-8000-000000000040', gameId: url.split('/')[3], ...session,
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
  it('edits a game with a local media path without URL validation errors', async () => {
    const game = { ...makeGame('00000000-0000-4000-8000-000000000009', 'Local game', 'PLAYING'), coverUrl: '/media/00000000-0000-4000-8000-000000000050.jpg' };
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Local game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar jogo' }));
    const coverInput = screen.getByLabelText(/Capa/) as HTMLInputElement;
    expect(coverInput).toHaveValue(game.coverUrl);
    expect(coverInput.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}`, expect.objectContaining({ method: 'PATCH' })));
    const update = fetchMock.mock.calls.find(([url, init]) => url === `/api/games/${game.id}` && init?.method === 'PATCH');
    expect(JSON.parse(String(update?.[1]?.body)).coverUrl).toBe(game.coverUrl);
  });

  it('opens on the dashboard and starts a session from a playing game card', async () => {
    const playing = makeGame('00000000-0000-4000-8000-000000000008', 'Hades', 'PLAYING');
    mockApi([playing]);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Seu ritmo de jogo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar jogando' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar jogando' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${playing.id}/sessions`, expect.objectContaining({ method: 'POST' })));
    fireEvent.change(screen.getByRole('combobox', { name: 'Período do painel' }), { target: { value: '7d' } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/dashboard?from='))).toBe(true));
  });

  it('searches metadata and fills the game form for review before saving', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: '＋ Adicionar jogo' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Hades' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar metadata' }));

    fireEvent.click(await screen.findByRole('button', { name: /Hades/ }));

    expect(screen.getByLabelText('Título')).toHaveValue('Hades');
    expect(screen.getByLabelText('Desenvolvedora')).toHaveValue('Supergiant Games');
    expect(screen.getByLabelText(/Capa/)).toHaveValue('https://images.example/hades.jpg');
    expect(document.querySelector<HTMLInputElement>('input[name="genreNames"]')).toHaveValue('Roguelike');
    expect(screen.getByRole('status')).toHaveTextContent('para revisão');
  });

  it('shows an empty state when the API has no games', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    expect(await screen.findByText('Sua biblioteca começa aqui')).toBeInTheDocument();
  });

  it('creates a game through the API', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
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
      platformId: null, genreIds: [], status: 'PLAYING', owned: false, startedAt: null, completedAt: null, priority: 'HIGH', estimatedMainHours: 22, estimatedCompletionistHours: null,
      personalEstimatedHours: 30, retroactivePlayedHours: 0, notes: 'Reached Elysium.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    expect(screen.getByRole('heading', { name: 'Hades' })).toBeInTheDocument();
    expect(screen.getByText('Escape from the Underworld.')).toBeInTheDocument();
    expect(screen.getByText('30 horas')).toBeInTheDocument();
    expect(screen.getByText('22 horas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar jogo' })).toBeInTheDocument();
  });

  it('navigates between filtered games and records retroactive hours without a session', async () => {
    const first = makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'PLAYING');
    const second = makeGame('00000000-0000-4000-8000-000000000002', 'Celeste', 'PLAYING');
    mockApi([first, second]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'PLAYING' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes de Hades' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo jogo →' }));
    expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Jogo anterior' }));
    expect(await screen.findByRole('heading', { name: 'Hades' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Horas retroativas' }), { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar horas' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${first.id}`, expect.objectContaining({ method: 'PATCH' })));
    const update = fetchMock.mock.calls.find(([url, init]) => url === `/api/games/${first.id}` && init?.method === 'PATCH');
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({ retroactivePlayedHours: 3.5 });
    expect(screen.getByText('Nenhuma sessão registrada.')).toBeInTheDocument();
  });

  it('creates and associates a franchise, platform and genre', async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar primeiro jogo' }));
    await screen.findByRole('heading', { name: 'Adicionar jogo' });
    screen.getByRole('textbox', { name: /Adicionar plataforma/ });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Metroid Dread' } });
    fireEvent.change(screen.getByLabelText('Franquia'), { target: { value: 'Metroid' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Adicionar plataforma/ }), { target: { value: 'Nintendo Switch' } });
    fireEvent.click(screen.getByLabelText('Possuo este jogo'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: 'COMPLETED' } });
    fireEvent.change(screen.getByLabelText('Data que zerei'), { target: { value: '2025-08-15' } });
    fireEvent.change(screen.getByLabelText('Avaliação'), { target: { value: '11' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Gêneros/ }), { target: { value: 'Ação, Metroidvania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar jogo' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({ method: 'POST' })));
    const gameRequest = fetchMock.mock.calls.find(([url, init]) => url === '/api/games' && init?.method === 'POST');
    expect(gameRequest).toBeDefined();
    expect(JSON.parse(String(gameRequest?.[1]?.body))).toMatchObject({
      franchiseId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000020',
      status: 'COMPLETED', owned: true, startedAt: null, completedAt: '2025-08-15',
      rating: 11,
      genreIds: ['00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000031'],
    });
  });

  it('creates a named list and adds or removes games from it', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'PLAYING')]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Listas' }));
    fireEvent.change(screen.getByLabelText('Nome da nova lista'), { target: { value: 'Favoritos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar lista' }));

    const gamePicker = await screen.findByLabelText('Jogo para adicionar');
    fireEvent.change(gamePicker, { target: { value: '00000000-0000-4000-8000-000000000001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByRole('button', { name: 'Hades Jogando' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(await screen.findByText('Esta lista ainda não tem jogos.')).toBeInTheDocument();
  });

  it('registers a session from a game detail page and displays its duration', async () => {
    const game = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
      coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: 'Supergiant Games', publisher: null, franchiseId: null,
      platformId: null, genreIds: [], status: 'PLAYING', owned: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: null,
      estimatedCompletionistHours: null, personalEstimatedHours: null, notes: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Nenhuma sessão registrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar jogando' }));
    await screen.findByText('SESSÃO EM ANDAMENTO');
    fireEvent.click(screen.getByRole('button', { name: 'Editar sessão' }));
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-01-01T10:00' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endedAt"]')!, { target: { value: '' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Progresso (%)' }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Onde parou' }), { target: { value: 'Elysium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sessão' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions/00000000-0000-4000-8000-000000000040`, expect.objectContaining({ method: 'PATCH' })));
    expect(await screen.findByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Elysium · 50%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar sessão' }));
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endedAt"]')!, { target: { value: '2026-01-01T11:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar sessão' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions/00000000-0000-4000-8000-000000000040`, expect.objectContaining({ method: 'PATCH' })));
    expect(await screen.findByText('1 hora e 30 minutos')).toBeInTheDocument();
  });

  it('starts a live session and opens its details after ending it', async () => {
    const game = makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'PLAYING');
    mockApi([game]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Nenhuma sessão registrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar jogando' }));
    await screen.findByText('SESSÃO EM ANDAMENTO');
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sessão' }));
    expect(await screen.findByRole('button', { name: 'Salvar sessão' })).toBeInTheDocument();
    expect(screen.getByLabelText('Onde parou')).toBeInTheDocument();
  });

  it('deletes a session from the history after confirmation', async () => {
    const game = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
      coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null, franchiseId: null,
      platformId: null, genreIds: [], status: 'PLAYING', owned: false, startedAt: null, completedAt: null, priority: 'NORMAL', estimatedMainHours: null,
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
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/dashboard')) return base(input, init);
      if (url.endsWith('/sessions') && !init?.method) return new Response(JSON.stringify([session]), { status: 200 });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url === '/api/queue') return new Response('[]', { status: 200 });
      if (url === '/api/dashboard') return new Response(JSON.stringify({
        gameCount: 1, desiredCount: 0, backlogCount: 0, completedCount: 0, playingCount: 1, pausedCount: 0, abandonedCount: 0, archivedCount: 0, totalPlayedHours: 0,
        backlogRemainingHours: 0, weeklyHours: 0, queueRemainingHours: 0, estimatedQueueWeeks: null,
        backlogForecast: { estimatedWeeks: null, estimatedMonths: null, gamesWithoutEstimate: 0, stalledGames: [] },
        currentGame: null, queuePreview: [],
      }), { status: 200 });
      return new Response(JSON.stringify([game]), { status: 200 });
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Elysium');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir sessão' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}/sessions/${session.id}`, { method: 'DELETE' }));
    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText('Sessão excluída.')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma sessão registrada.')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('lists, uploads and deletes session screenshots on demand', async () => {
    const gameId = '00000000-0000-4000-8000-000000000001';
    const sessionId = '00000000-0000-4000-8000-000000000040';
    const hades = makeGame(gameId, 'Hades');
    mockApi([hades]);
    const base = fetchMock.getMockImplementation()!;
    const shots = [{ id: '00000000-0000-4000-8000-000000000700', sessionId, url: '/media/a.png', createdAt: '2026-01-01T11:00:00.000Z' }];
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === `/api/games/${gameId}/sessions` && method === 'GET') {
        return new Response(JSON.stringify([{ id: sessionId, gameId, startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T11:00:00.000Z', durationMinutes: 60, progress: null, location: 'Elysium', notes: null, createdAt: '2026-01-01T11:00:00.000Z', updatedAt: '2026-01-01T11:00:00.000Z' }]), { status: 200 });
      }
      if (url.endsWith('/screenshots') && method === 'GET') return new Response(JSON.stringify(shots), { status: 200 });
      if (url.endsWith('/screenshots') && method === 'POST') {
        const created = { id: '00000000-0000-4000-8000-000000000701', sessionId, url: '/media/b.png', createdAt: '2026-01-01T12:00:00.000Z' };
        shots.push(created);
        return new Response(JSON.stringify(created), { status: 201 });
      }
      if (url.includes('/screenshots/') && method === 'DELETE') { shots.splice(0, 1); return new Response(null, { status: 204 }); }
      return base(input, init);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de Hades' }));
    await screen.findByText('Elysium');
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/screenshots'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Imagens' }));
    expect((await screen.findAllByAltText('Screenshot da sessão'))).toHaveLength(1);

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Adicionar imagem à sessão'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getAllByAltText('Screenshot da sessão')).toHaveLength(2));
    const upload = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/screenshots') && init?.method === 'POST');
    expect((upload?.[1]?.headers as Record<string, string>)['content-type']).toBe('image/png');

    fireEvent.change(screen.getByLabelText('Adicionar imagem à sessão'), { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Use uma imagem JPEG, PNG ou WebP.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir imagem' })[0]!);
    await waitFor(() => expect(screen.getAllByAltText('Screenshot da sessão')).toHaveLength(1));
  });

  it('adds games to the queue, displays the order and moves entries', async () => {
    const hades = makeGame('00000000-0000-4000-8000-000000000001', 'Hades');
    const hollowKnight = makeGame('00000000-0000-4000-8000-000000000002', 'Hollow Knight');
    mockApi([hades, hollowKnight]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
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

  it('shows the backlog forecast and stalled games once a weekly goal exists', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'PLAYING')]);
    render(<App />);
    expect(await screen.findByText('Defina a meta semanal para ver quando o backlog acaba.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutos disponíveis por semana' }), { target: { value: '360' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(await screen.findByText(/1,8 meses/)).toBeInTheDocument();
    expect(screen.getByText(/2 jogos sem estimativa/)).toBeInTheDocument();
    expect(screen.getByText(/45 dias · faltam/)).toBeInTheDocument();
  });
});

describe('goals', () => {
  it('creates a goal with its progress and removes it', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades')]);
    render(<App />);
    expect(await screen.findByText(/Defina metas anuais ou mensais/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova meta' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Alvo da meta' }), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar meta' }));
    expect(await screen.findByText(/Zerar 12 jogos/)).toBeInTheDocument();
    expect(screen.getByText(/3 de 12 \(25%\) · abaixo do ritmo/)).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/goals' && init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ kind: 'COMPLETED_GAMES', period: 'YEAR', target: 12 });
    fireEvent.click(screen.getByRole('button', { name: /Excluir meta/ }));
    expect(await screen.findByText(/Defina metas anuais ou mensais/)).toBeInTheDocument();
  });

  it('warns about a duplicated goal and sends the month for monthly goals', async () => {
    mockApi([]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova meta' }));
    fireEvent.change(screen.getByLabelText('Período da meta'), { target: { value: 'MONTH' } });
    fireEvent.change(screen.getByLabelText('Mês da meta'), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Alvo da meta' }), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar meta' }));
    expect(await screen.findByText('Você já tem uma meta deste tipo para esse período.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/goals' && init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ period: 'MONTH', month: 3, target: 99 });
  });
});

describe('next game suggestion', () => {
  it('suggests a game with its reasons and cycles through the options', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades'), makeGame('00000000-0000-4000-8000-000000000002', 'Celeste')]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Fila/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Me ajuda a escolher' }));
    expect(await screen.findByRole('button', { name: 'Hades' })).toBeInTheDocument();
    expect(screen.getByText('Primeiro da fila')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Outra opção/ }));
    expect(await screen.findByRole('button', { name: 'Celeste' })).toBeInTheDocument();
    expect(screen.getByText('Pausado: dá para retomar de onde parou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Outra opção/ })).toBeDisabled();
  });
});

describe('statistics and classification', () => {
  it('shows statistics tables and the main challenge progress', async () => {
    mockApi([makeGame('00000000-0000-4000-8000-000000000001', 'Hades', 'COMPLETED')]);
    render(<App />);
    expect(await screen.findByText('25%', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Zerar clássicos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Estatísticas' }));
    expect(await screen.findByRole('heading', { name: 'Estatísticas' })).toBeInTheDocument();
    expect(await screen.findByText('Linha do tempo anual')).toBeInTheDocument();
    expect(screen.getByText('Top 10 jogos favoritos')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'RPG' })).toBeInTheDocument();
    expect(screen.getByText('Jogo do ano')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /dias jogados/ })).toBeInTheDocument();
    expect(screen.getByText('Maior sequência').nextSibling).toHaveTextContent('3 dias');
    expect(await screen.findByText('Gênero mais jogado')).toBeInTheDocument();
    expect(screen.getByText('Mês mais ativo').parentElement).toHaveTextContent('fevereiro');
    fireEvent.click(screen.getByRole('button', { name: 'Replay do ano anterior' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/stats/replay') && String(url).includes(`year=${new Date().getFullYear() - 1}`))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Ano anterior' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`year=${new Date().getFullYear() - 1}`))).toBe(true));
  });

  it('sends difficulty, type, completion condition, favorite and game of the year when saving a game', async () => {
    mockApi([]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: '＋ Adicionar jogo' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Chrono Trigger' } });
    fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'RPG de Turno' } });
    fireEvent.change(screen.getByLabelText('Condição de zeramento'), { target: { value: 'Veja os créditos' } });
    fireEvent.click(screen.getByLabelText('Favorito'));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar jogo' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/games' && init?.method === 'POST');
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ difficulty: 'B', gameType: 'RPG de Turno', completionCondition: 'Veja os créditos', favorite: true, gameOfYear: false });
    });
  });
});
