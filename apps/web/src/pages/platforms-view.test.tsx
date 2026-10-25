import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Game, Platform, PlatformSummary } from '@gameshelf/contracts';
import { PlatformsView } from './platforms-view';

afterEach(cleanup);

const PC = '00000000-0000-4000-8000-000000000020';
const PS5 = '00000000-0000-4000-8000-000000000021';
const STEAM = '00000000-0000-4000-8000-000000000022';

const pc: Platform = { id: PC, name: 'PC', iconKey: 'pc', parentId: null };
const ps5: Platform = { id: PS5, name: 'PlayStation 5', iconKey: 'playstation', parentId: null };
const steam: Platform = { id: STEAM, name: 'Steam', iconKey: 'steam', parentId: null };

function summary(platform: Platform, overrides: Partial<Omit<PlatformSummary, 'platform'>> = {}): PlatformSummary {
  return {
    platform,
    gameCount: 0,
    completedCount: 0,
    dominatedCount: 0,
    localPlayedMinutes: 0,
    externalPlayedMinutes: 0,
    achievementsUnlocked: 0,
    achievementsTotal: 0,
    recentGameCovers: [],
    ...overrides,
  };
}

/** O card da plataforma pelo nome. */
function cardOf(name: string) {
  return screen.getAllByRole('listitem').find((item) => item.textContent?.includes(name))!;
}

describe('PlatformsView', () => {
  it('mostra contagem, tempo e conquistas quando o dado existe', () => {
    render(
      <PlatformsView
        platforms={[pc, ps5]}
        summaries={[
          summary(pc, { gameCount: 12, completedCount: 5, localPlayedMinutes: 600, achievementsUnlocked: 30, achievementsTotal: 120 }),
          summary(ps5, { gameCount: 3, completedCount: 1, externalPlayedMinutes: 90 }),
        ]}
        games={[]}
        onGoToSettings={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Plataformas' })).toBeInTheDocument();
    expect(cardOf('PC')).toHaveTextContent('12 jogos · 5 zerados');
    expect(cardOf('PC')).toHaveTextContent('10 h');
    expect(cardOf('PC')).toHaveTextContent('30 de 120');
    expect(cardOf('PlayStation 5')).toHaveTextContent('3 jogos · 1 zerado');
    expect(cardOf('PlayStation 5')).toHaveTextContent('1,5 h');
    expect(cardOf('PlayStation 5')).toHaveTextContent('Zerados 33%');
  });

  it('omite linha de tempo e conquistas quando não há dado, em vez de mostrar zero', () => {
    render(
      <PlatformsView
        platforms={[steam]}
        summaries={[summary(steam, { gameCount: 2 })]}
        games={[]}
        onGoToSettings={vi.fn()}
      />,
    );

    const card = cardOf('Steam');
    expect(card).toHaveTextContent('2 jogos');
    expect(card).not.toHaveTextContent('Tempo registrado');
    expect(card).not.toHaveTextContent('Conquistas');
    expect(card).not.toHaveTextContent('zerado');
  });

  it('conta jogos pela biblioteca quando o resumo da API não respondeu', () => {
    render(
      <PlatformsView
        platforms={[pc, ps5]}
        summaries={[]}
        games={[
          { id: 'g1', platformIds: [PC] },
          { id: 'g2', platformIds: [PC] },
          { id: 'g3', platformIds: [PS5] },
        ] as unknown as Game[]}
        onGoToSettings={vi.fn()}
      />,
    );

    expect(cardOf('PC')).toHaveTextContent('2 jogos');
    expect(cardOf('PlayStation 5')).toHaveTextContent('1 jogo');
  });

  it('mostra estado inicial quando ainda não há plataformas', () => {
    const onGoToSettings = vi.fn();
    render(<PlatformsView platforms={[]} summaries={[]} games={[]} onGoToSettings={onGoToSettings} />);

    expect(screen.getByText('Nenhuma plataforma ainda')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Gerenciar plataformas' })[0]!);
    expect(onGoToSettings).toHaveBeenCalled();
  });
});
