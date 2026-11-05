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

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/reports/playtime') ? playtime : [];
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
