import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
