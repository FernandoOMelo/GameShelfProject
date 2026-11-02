import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game, GamePlatform, Platform, TimelineEvent } from '@gameshelf/contracts';
import { AchievementsChart } from './achievements-chart';
import { GameJourneyPanel } from './game-journey-panel';
import { TimelineView } from './timeline-view';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.unstubAllGlobals(); });

const platforms: Platform[] = [{ id: 'p1', name: 'PlayStation 5', parentId: null }];
const link = (overrides: Partial<GamePlatform> = {}): GamePlatform => ({
  id: 'link-1', gameId: 'game-1', platformId: 'p1', edition: null, format: null, owned: true, isPrimary: true,
  countsTowardTotal: false, externalSource: 'achievist', externalId: '1', externalAccountLabel: null,
  externalPlaytimeMinutes: null, externalPlaytimeImportedMinutes: 0, externalLastPlayedAt: null, externalSyncedAt: null,
  externalActivityStartedAt: '2024-01-10T15:00:00.000Z', externalActivityEndedAt: '2024-02-20T15:00:00.000Z', externalActivityDays: 12,
  notes: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
}) as GamePlatform;

function serveLibrary(links: GamePlatform[]) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith('/platforms')) return Promise.resolve(Response.json(links));
    if (url.endsWith('/playthroughs/metrics')) return Promise.resolve(Response.json({ total: 0, started: 0, completed: 0, abandoned: 0, replaysStarted: 0, activePlaythroughId: null }));
    if (url.endsWith('/playthroughs')) return Promise.resolve(Response.json([]));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
}

describe('datas sugeridas pelo Achievist', () => {
  it('sugere início e zerado quando estão vazios e só grava com o clique', async () => {
    serveLibrary([link()]);
    const onApplyDate = vi.fn();
    render(<GameJourneyPanel gameId="game-1" platforms={platforms} localMinutes={0} gameDates={{ status: 'COMPLETED', startedAt: null, completedAt: null }} onApplyDate={onApplyDate} />);

    expect(await screen.findByText('Datas sugeridas pelo Achievist')).toBeInTheDocument();
    expect(onApplyDate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /como início/ }));
    expect(onApplyDate).toHaveBeenCalledWith('startedAt', '2024-01-10');
    fireEvent.click(screen.getByRole('button', { name: /como data de zerado/ }));
    expect(onApplyDate).toHaveBeenCalledWith('completedAt', '2024-02-20');
  });

  it('não oferece o que o jogo já tem nem o zerado de um jogo que não foi zerado', async () => {
    serveLibrary([link()]);
    render(<GameJourneyPanel gameId="game-1" platforms={platforms} localMinutes={0} gameDates={{ status: 'PLAYING', startedAt: '2024-01-01', completedAt: null }} onApplyDate={vi.fn()} />);
    await screen.findByText('Nenhuma jornada registrada. O histórico de sessões continua valendo mesmo sem jornada.');
    expect(screen.queryByText('Datas sugeridas pelo Achievist')).not.toBeInTheDocument();
  });
});

describe('AchievementsChart', () => {
  it('desenha a curva acumulada e deixa escolher o período', async () => {
    fetchMock.mockResolvedValue(Response.json({ total: 5, days: [{ date: '2024-01-10', count: 3 }, { date: '2025-02-01', count: 2 }] }));
    render(<AchievementsChart />);
    expect(await screen.findByRole('img', { name: /5 conquistas acumuladas/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Período do gráfico de conquistas'), { target: { value: '12M' } });
    await waitFor(() => expect(screen.getByRole('img', { name: /conquistas acumuladas/ })).toBeInTheDocument());
  });

  it('mostra data e valor acumulado ao passar o mouse e esconde ao sair', async () => {
    fetchMock.mockResolvedValue(Response.json({ total: 5, days: [{ date: '2024-01-10', count: 3 }, { date: '2025-02-01', count: 2 }] }));
    render(<AchievementsChart />);
    const chart = await screen.findByRole('img', { name: /conquistas acumuladas/ });
    chart.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 240, right: 800, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.mouseMove(chart, { clientX: 790 });
    expect(await screen.findByText('conquistas : 5')).toBeInTheDocument();
    fireEvent.mouseLeave(chart);
    expect(screen.queryByText(/conquistas : /)).not.toBeInTheDocument();
  });

  it('some quando não há conquistas com data', async () => {
    fetchMock.mockResolvedValue(Response.json({ total: 0, days: [] }));
    const { container } = render(<AchievementsChart />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('feed da linha do tempo', () => {
  const game = { id: 'game-1', title: 'Cyberpunk 2077', coverUrl: null, platformId: 'p1' } as unknown as Game;
  const achievement = { name: 'Todos os homens da presidente', description: 'Salve a presidente Myers.', iconUrl: 'https://img/a.png', unlockedAt: '2026-10-31T20:30:00.000Z' };
  const today = new Date();
  const dateOf = (offset: number) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const base = { gameId: 'game-1', gameTitle: 'Cyberpunk 2077', coverUrl: null };

  function serveEvents(events: TimelineEvent[]) {
    fetchMock.mockImplementation((input) => String(input).includes('/stats/timeline')
      ? Promise.resolve(Response.json({ events, nextBefore: null }))
      : Promise.resolve(Response.json({ total: 0, days: [] })));
  }

  it('mostra a conquista dentro da sessão, com a plataforma, a data relativa e o tooltip', async () => {
    serveEvents([{ type: 'SESSION', at: `${dateOf(1)}T20:00:00.000Z`, date: dateOf(1), ...base, sessionId: '00000000-0000-4000-8000-000000000040', platformId: 'p1', achievements: [achievement], durationMinutes: 70, progress: null, location: null, notes: null, keyDecisions: null, tips: null }] as TimelineEvent[]);
    render(<TimelineView games={[game]} platforms={platforms} onSelectGame={vi.fn()} />);

    expect(await screen.findByText('1h 10min')).toBeInTheDocument();
    expect(screen.getByText(/e desbloqueou/)).toBeInTheDocument();
    expect(screen.getByText('Ontem')).toBeInTheDocument();
    expect(screen.getByTitle('PlayStation 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cyberpunk 2077' })).toBeInTheDocument();
    expect(screen.getByText('Todos os homens da presidente')).toBeInTheDocument();
    expect(screen.getByText('Salve a presidente Myers.')).toBeInTheDocument();
  });

  it('mostra só a informação da conquista quando não há sessão', async () => {
    serveEvents([{ type: 'ACHIEVEMENTS_UNLOCKED', at: `${dateOf(3)}T20:00:00.000Z`, date: dateOf(3), ...base, count: 2, platformId: 'p1', achievements: [achievement, { ...achievement, name: 'Outra' }] }] as TimelineEvent[]);
    render(<TimelineView games={[game]} platforms={platforms} onSelectGame={vi.fn()} />);

    expect(await screen.findByText(/Desbloqueou/)).toBeInTheDocument();
    expect(screen.queryByText(/Jogou durante/)).not.toBeInTheDocument();
    expect(screen.getByText('há 3 dias')).toBeInTheDocument();
    expect(screen.getByText('Outra')).toBeInTheDocument();
  });
});
