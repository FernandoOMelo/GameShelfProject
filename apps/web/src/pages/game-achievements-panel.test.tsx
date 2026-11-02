import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameAchievementsResponse } from '@gameshelf/contracts';
import { GameAchievementsPanel } from './game-achievements-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const response: GameAchievementsResponse = {
  catalogAvailable: true,
  linkedGame: { id: 1, slug: 'hades', name: 'Hades', released: '2020-09-17', backgroundImage: null },
  total: 2,
  unlockedCount: 1,
  percent: 50,
  achievements: [
    { id: 'a1', name: 'Fuga do abismo', description: 'Conclua o primeiro escape.', iconUrl: null, rarityPercent: 80, rarityTier: 'COMMON', unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', secret: false, isCompletionTrophy: false },
    { id: 'a2', name: null, description: null, iconUrl: null, rarityPercent: 2.3, rarityTier: 'ULTRA_RARE', unlocked: false, unlockedAt: null, secret: true, isCompletionTrophy: true },
  ],
  completionTrophyId: 'a2',
  rarityBreakdown: { common: 1, uncommon: 0, rare: 0, ultraRare: 1 },
};

describe('GameAchievementsPanel', () => {
  it('mostra a conquista desbloqueada e mantém a secreta oculta até o usuário ativar o filtro', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    render(<GameAchievementsPanel gameId="00000000-0000-4000-8000-000000000001" />);

    expect(await screen.findByText('Fuga do abismo')).toBeInTheDocument();
    expect(screen.getByText('1/2 · 50%')).toBeInTheDocument();
    expect(screen.queryByText('Conquista secreta')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Mostrar conquistas secretas/ }));
    expect(await screen.findByText('Conquista secreta')).toBeInTheDocument();
    expect(screen.getByText('Os detalhes desta conquista serão revelados quando desbloqueada')).toBeInTheDocument();
  });

  it('avisa o pai com o resumo para alimentar os cartões da lateral', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    const onDataChange = vi.fn();
    render(<GameAchievementsPanel gameId="00000000-0000-4000-8000-000000000001" onDataChange={onDataChange} />);

    await screen.findByText('Fuga do abismo');
    expect(onDataChange).toHaveBeenCalledWith(response);
  });

  it('mostra aviso quando ainda não há catálogo vinculado', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...response, catalogAvailable: false, linkedGame: null }), { status: 200 }));
    render(<GameAchievementsPanel gameId="00000000-0000-4000-8000-000000000001" />);
    expect(await screen.findByText(/Ainda sem catálogo vinculado/)).toBeInTheDocument();
  });
});
