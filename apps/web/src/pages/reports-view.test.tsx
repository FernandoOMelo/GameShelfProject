import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReportsView } from './reports-view';

const playtime = {
  totalMinutes: 300, sessionCount: 2, averageSessionMinutes: 150, activeDays: 2, availableYears: [2026],
  byMonth: [{ month: '2026-02', minutes: 300, sessions: 2 }], byYear: [{ year: 2026, minutes: 300, sessions: 2 }],
  byWeekday: Array.from({ length: 7 }, (_, weekday) => ({ weekday, minutes: weekday === 6 ? 300 : 0, sessions: weekday === 6 ? 2 : 0 })),
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: hour === 21 ? 300 : 0, sessions: hour === 21 ? 2 : 0 })),
  sessionLengths: [{ key: 'UP_TO_30', sessions: 0 }, { key: 'UP_TO_60', sessions: 0 }, { key: 'UP_TO_120', sessions: 0 }, { key: 'UP_TO_240', sessions: 2 }, { key: 'OVER_240', sessions: 0 }],
  byPlatform: [{ id: null, name: 'Sem plataforma', minutes: 300, sessions: 2, share: 100 }], byGenre: [], byDeveloper: [],
  topGames: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Hades', minutes: 300, sessions: 2, share: 100 }],
  highlights: { busiestWeekday: 6, busiestMonth: '2026-02', peakHour: 21, averageMonthlyMinutes: 300 },
};

const playthroughs = {
  totals: { gamesWithJourneys: 1, journeysStarted: 2, journeysCompleted: 2, journeysAbandoned: 0, replaysStarted: 1, averageJourneysPerGame: 2, completionRate: 100, averageDaysToComplete: 20, averageDaysBetweenReplays: 400 },
  firstVsLater: { firstAverageHours: 42, laterAverageHours: 31, firstCount: 1, laterCount: 1 },
  byPlatform: [{ name: 'PC', journeys: 2 }], mostAbandoned: [],
  mostReplayed: [{ gameId: '00000000-0000-4000-8000-000000000001', title: 'Hades', journeys: 2, completed: 2, abandoned: 0, history: [
    { id: '00000000-0000-4000-8000-000000000501', sequence: 1, label: null, status: 'COMPLETED', platformName: 'PC', startedAt: '2022-01-01', completedAt: '2022-02-01', days: 31, hours: 42 },
    { id: '00000000-0000-4000-8000-000000000502', sequence: 2, label: null, status: 'COMPLETED', platformName: 'PC', startedAt: '2024-01-01', completedAt: '2024-01-21', days: 20, hours: 31 },
  ] }],
};

const backlog = {
  totals: { backlogCount: 3, neverStarted: 1, averageAgeDays: 216, estimatedRemainingHours: 15, withoutEstimate: 1, desiredCount: 1, ownedCount: 4 },
  aging: [{ key: 'UP_TO_30', games: 1 }, { key: 'UP_TO_90', games: 0 }, { key: 'UP_TO_180', games: 1 }, { key: 'UP_TO_365', games: 0 }, { key: 'OVER_365', games: 1 }],
  byReleaseYear: [{ year: 2020, games: 2 }], byGenre: [{ id: null, name: 'Sem gênero', games: 2, estimatedHours: 5 }], byPlatform: [],
  oldest: [{ gameId: '00000000-0000-4000-8000-000000000002', title: 'Antigo', addedAt: '2025-01-01T00:00:00.000Z', ageDays: 516, estimatedHours: 5 }],
};

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/reports/backlog') ? backlog : url.includes('/reports/playtime') ? playtime : url.includes('/reports/playthroughs') ? playthroughs : [];
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ReportsView', () => {
  it('pede uma categoria antes de consultar qualquer relatório', () => {
    const fetchMock = mockApi();
    render(<ReportsView onOpenGame={() => undefined} />);
    expect(screen.getByText('Escolha um relatório')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra o envelhecimento do backlog e abre o jogo mais antigo', async () => {
    mockApi();
    const onOpenGame = vi.fn();
    render(<ReportsView onOpenGame={onOpenGame} />);
    fireEvent.click(screen.getByRole('button', { name: /Biblioteca e backlog/ }));
    expect(await screen.findByText('Mais de 1 ano')).toBeInTheDocument();
    expect(screen.getByText('216 dias')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Antigo' }));
    expect(onOpenGame).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002');
  });

  it('mostra o histórico de jornadas dos jogos rejogados', async () => {
    mockApi();
    render(<ReportsView onOpenGame={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Jornadas e replays/ }));
    expect(await screen.findByText('42h → 31h')).toBeInTheDocument();
    expect(screen.getByText('2 jornadas')).toBeInTheDocument();
    expect(screen.getAllByText('Zerada')).toHaveLength(2);
  });

  it('mostra o resumo de hábitos e envia o período escolhido', async () => {
    const fetchMock = mockApi();
    const onOpenGame = vi.fn();
    render(<ReportsView onOpenGame={onOpenGame} />);
    fireEvent.click(screen.getByRole('button', { name: /Tempo de jogo/ }));
    expect(await screen.findByText('Dia da semana mais ativo')).toBeInTheDocument();
    expect(screen.getAllByText('sábado').length).toBeGreaterThan(0);
    expect(screen.getByText('21h–22h')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hades' }));
    expect(onOpenGame).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 12 meses' }));
    await screen.findByText('Dia da semana mais ativo');
    const urls = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes('/reports/playtime'));
    expect(urls.at(-1)).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  });
});
