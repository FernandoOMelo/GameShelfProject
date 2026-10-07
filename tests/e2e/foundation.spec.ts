import { expect, test } from '@playwright/test';

test('shows the games library shell', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/dashboard') ? {
    gameCount: 0, desiredCount: 0, backlogCount: 0, completedCount: 0, playingCount: 0, pausedCount: 0, abandonedCount: 0, archivedCount: 0,
    totalPlayedHours: 0, backlogRemainingHours: 0, weeklyHours: 0,
    queueRemainingHours: 0, estimatedQueueWeeks: null, currentGame: null, playingGames: [], period: { from: null, to: null }, periodStats: { playedHours: 0, sessions: 0, gamesPlayed: 0, gamesCompleted: 0 }, queuePreview: [],
  } : [] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu ritmo de jogo', exact: true })).toBeVisible();
  await expect(page.getByText('LOCAL')).toBeVisible();
});

test('adds a game to the queue and opens the weekly planning dashboard', async ({ page }) => {
  const game = {
    id: '00000000-0000-4000-8000-000000000001', title: 'Hades', description: null,
    coverUrl: null, backgroundUrl: null, releaseYear: 2020, developer: null, publisher: null, franchiseId: null,
    platformId: null, genreIds: [], status: 'BACKLOG', owned: true, archived: false, startedAt: null, completedAt: null, priority: 'HIGH', estimatedMainHours: 20,
    estimatedCompletionistHours: null, personalEstimatedHours: 18, notes: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const queue: Array<{ position: number; addedAt: string; game: typeof game }> = [];
  let weeklyMinutes = 360;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/games') return route.fulfill({ json: [game] });
    if (url.pathname === '/api/franchises' || url.pathname === '/api/platforms' || url.pathname === '/api/genres') return route.fulfill({ json: [] });
    if (url.pathname === '/api/queue' && method === 'GET') return route.fulfill({ json: queue });
    if (url.pathname === '/api/queue' && method === 'POST') {
      queue.push({ position: queue.length, addedAt: new Date().toISOString(), game });
      return route.fulfill({ status: 201, json: queue.at(-1) });
    }
    if (url.pathname === '/api/dashboard') return route.fulfill({ json: {
      gameCount: 1, desiredCount: 0, backlogCount: 1, completedCount: 0, playingCount: 0, pausedCount: 0, abandonedCount: 0, archivedCount: 0,
      totalPlayedHours: 0, backlogRemainingHours: 18, weeklyHours: weeklyMinutes / 60,
      queueRemainingHours: queue.length ? 18 : 0, estimatedQueueWeeks: queue.length ? 3 : 0,
      currentGame: null, playingGames: [], period: { from: null, to: null }, periodStats: { playedHours: 0, sessions: 0, gamesPlayed: 0, gamesCompleted: 0 }, queuePreview: queue,
    } });
    if (url.pathname === '/api/planning/settings' && method === 'PUT') {
      weeklyMinutes = (route.request().postDataJSON() as { weeklyMinutes: number }).weeklyMinutes;
      return route.fulfill({ json: { weeklyMinutes } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Biblioteca' }).click();
  await page.getByRole('button', { name: '＋ Adicionar à fila' }).click();
  await expect(page.getByRole('button', { name: 'Na fila · Remover' })).toBeVisible();
  await page.getByRole('button', { name: /Fila/ }).click();
  await expect(page.getByRole('heading', { name: 'Fila de jogos' })).toBeVisible();
  await expect(page.getByText('Hades')).toBeVisible();
  await page.getByRole('button', { name: 'Painel' }).click();
  await expect(page.getByRole('heading', { name: 'Seu ritmo de jogo' })).toBeVisible();
  await expect(page.getByText('cerca de 3 semanas')).toBeVisible();
});
