import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchisePanel } from './franchise-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('FranchisePanel', () => {
  it('avisa quando o jogo não tem franquia associada', () => {
    render(<FranchisePanel franchiseId={null} onAddGame={vi.fn()} />);
    expect(screen.getByText('Este jogo não tem uma franquia associada.')).toBeInTheDocument();
  });

  it('lista jogos da franquia e aciona o cadastro de um jogo que ainda não está na biblioteca', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      franchiseName: 'Final Fantasy',
      games: [
        { igdbId: 1, title: 'Final Fantasy VII Remake', releaseYear: 2020, coverUrl: null, inLibrary: true, libraryGameId: 'g1', libraryGameStatus: 'COMPLETED' },
        { igdbId: 2, title: 'Final Fantasy XVI', releaseYear: 2023, coverUrl: null, inLibrary: false, libraryGameId: null, libraryGameStatus: null },
      ],
    }), { status: 200 }));

    const onAddGame = vi.fn();
    render(<FranchisePanel franchiseId="franchise-1" onAddGame={onAddGame} />);

    expect(await screen.findByText('Final Fantasy VII Remake')).toBeInTheDocument();
    expect(screen.getByText('Zerado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }));
    expect(onAddGame).toHaveBeenCalledWith('Final Fantasy XVI');
  });

  it('avisa quando o catálogo de franquias está indisponível', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    render(<FranchisePanel franchiseId="franchise-1" onAddGame={vi.fn()} />);
    expect(await screen.findByText(/Cat.logo de franquias indispon.vel/)).toBeInTheDocument();
  });
});
