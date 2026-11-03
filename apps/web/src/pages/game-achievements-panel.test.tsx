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
    { id: 'a1', name: 'Fuga do abismo', description: 'Conclua o primeiro escape.', iconUrl: null, rarityPercent: 80, rarityTier: 'COMMON', unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', secret: false, isCompletionTrophy: false, specialKind: null },
    { id: 'a2', name: null, description: null, iconUrl: null, rarityPercent: 2.3, rarityTier: 'ULTRA_RARE', unlocked: false, unlockedAt: null, secret: true, isCompletionTrophy: true, specialKind: 'COMPLETION' },
  ],
  groups: [{
    id: 'gp-1', platformId: '00000000-0000-4000-8000-0000000000a1', name: 'PlayStation 5', total: 2, unlockedCount: 1, percent: 50, completionTrophyId: 'a2', platinumTrophyId: null, refreshable: false,
    achievements: [
      { id: 'a1', name: 'Fuga do abismo', description: 'Conclua o primeiro escape.', iconUrl: null, rarityPercent: 80, rarityTier: 'COMMON', unlocked: true, unlockedAt: '2026-10-09T12:21:00.000Z', secret: false, isCompletionTrophy: false, specialKind: null },
      { id: 'a2', name: null, description: null, iconUrl: null, rarityPercent: 2.3, rarityTier: 'ULTRA_RARE', unlocked: false, unlockedAt: null, secret: true, isCompletionTrophy: true, specialKind: 'COMPLETION' },
    ],
  }],
  completionTrophyId: 'a2',
  platinumTrophyId: null,
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

  it('separa as conquistas por plataforma em abas quando o jogo tem mais de uma', async () => {
    const pc = { id: 'gp-2', platformId: '00000000-0000-4000-8000-0000000000a2', name: 'PC', total: 1, unlockedCount: 0, percent: 0, completionTrophyId: null, platinumTrophyId: null, refreshable: true, achievements: [
      { id: 'p1', name: 'Conquista do Steam', description: 'Só no PC.', iconUrl: null, rarityPercent: 40, rarityTier: 'UNCOMMON' as const, unlocked: false, unlockedAt: null, secret: false, isCompletionTrophy: false, specialKind: null },
    ] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...response, total: 3, groups: [...response.groups, pc] }), { status: 200 }));
    render(<GameAchievementsPanel gameId="00000000-0000-4000-8000-000000000001" />);

    expect(await screen.findByText('Fuga do abismo')).toBeInTheDocument();
    expect(screen.queryByText('Conquista do Steam')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /PC/ }));
    expect(await screen.findByText('Conquista do Steam')).toBeInTheDocument();
    expect(screen.queryByText('Fuga do abismo')).not.toBeInTheDocument();
    expect(screen.getByText('0/1 · 0%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar conquistas de PC' })).toBeInTheDocument();
  });
});
