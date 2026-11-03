import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@gameshelf/contracts';
import { DlcPanel } from './dlc-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('DlcPanel', () => {
  it('lista as DLCs do jogo e permite adicionar uma nova', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'dlc-1', name: 'INTERmission' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'dlc-1', gameId: 'game-1', name: 'INTERmission', description: null, coverUrl: null, releaseDate: null, owned: false, status: 'NOT_STARTED', estimatedHours: null, playedHours: 0, rawgId: null, rawgSlug: null, rawgName: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }]), { status: 200 }));

    render(<DlcPanel gameId="game-1" />);
    expect(await screen.findByText('Nenhuma DLC cadastrada para este jogo.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar DLC' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'INTERmission' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar DLC' }));

    expect(await screen.findByText('INTERmission')).toBeInTheDocument();
    const [, createCall] = fetchMock.mock.calls;
    expect(createCall?.[0]).toBe('/api/games/game-1/dlcs');
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({ name: 'INTERmission' });
  });

  it('busca e vincula uma referência RAWG a uma DLC existente', async () => {
    const dlc = { id: 'dlc-1', gameId: 'game-1', name: 'INTERmission', description: null, coverUrl: null, releaseDate: null, owned: false, status: 'NOT_STARTED', estimatedHours: null, playedHours: 0, rawgId: null, rawgSlug: null, rawgName: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    const candidate = { id: 99, slug: 'intermission', name: 'FF7R INTERmission', released: '2021-06-10', backgroundImage: null };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([dlc]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([candidate]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...dlc, rawgId: 99, rawgSlug: 'intermission', rawgName: 'FF7R INTERmission' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...dlc, rawgId: 99, rawgSlug: 'intermission', rawgName: 'FF7R INTERmission' }]), { status: 200 }));

    render(<DlcPanel gameId="game-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vincular catálogo RAWG' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Usar esta referência' }));

    expect(await screen.findByRole('button', { name: 'Ver conquistas' })).toBeInTheDocument();
    const linkCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/rawg-link'));
    expect(linkCall?.[1]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(linkCall?.[1]?.body))).toEqual(candidate);
  });

  it('vincula a DLC a um jogo cadastrado e passa a mostrar o estado dele', async () => {
    const dlc = { id: 'dlc-1', gameId: 'game-1', name: 'INTERmission', description: null, coverUrl: null, releaseDate: null, owned: false, status: 'NOT_STARTED', estimatedHours: null, playedHours: 0, rawgId: null, rawgSlug: null, rawgName: null, linkedGameId: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    const library = [
      { id: 'game-1', title: 'Final Fantasy VII Rebirth', releaseYear: 2024 },
      { id: 'game-2', title: 'FF7R Intermission', releaseYear: 2021, status: 'COMPLETED', owned: true },
    ] as Game[];
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([dlc]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...dlc, linkedGameId: 'game-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...dlc, linkedGameId: 'game-2' }]), { status: 200 }));

    render(<DlcPanel gameId="game-1" games={library} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vincular a jogo cadastrado' }));
    fireEvent.change(screen.getByLabelText('Jogo cadastrado'), { target: { value: 'FF7R Intermission (2021)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }));

    expect(await screen.findByText(/o progresso e as horas vêm dele/)).toBeInTheDocument();
    expect(screen.getByText(/Concluída/)).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall?.[0]).toBe('/api/games/game-1/dlcs/dlc-1');
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ linkedGameId: 'game-2' });
  });
});
