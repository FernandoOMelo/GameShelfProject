import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@gameshelf/contracts';
import { GameMergeDialog } from './game-merge-dialog';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const idA = '00000000-0000-4000-8000-00000000000a';
const idB = '00000000-0000-4000-8000-00000000000b';
const idC = '00000000-0000-4000-8000-00000000000c';
const library = [
  { id: idA, title: 'Hades', releaseYear: 2020 },
  { id: idB, title: 'Hades ', releaseYear: 2020 },
  { id: idC, title: 'Celeste', releaseYear: 2018 },
] as Game[];

describe('GameMergeDialog', () => {
  it('sugere o duplicado, pede confirmação e mescla no jogo aberto', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ key: 'hades', gameIds: [idA, idB] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...library[0], id: idA }), { status: 200 }));
    const onMerged = vi.fn();
    render(<GameMergeDialog game={library[0]!} games={library} onClose={() => undefined} onMerged={onMerged} />);

    expect(await screen.findByText(/2020 · mesmo título/)).toBeInTheDocument();
    expect(screen.queryByText('Celeste')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mesclar este' }));
    expect(screen.getByText(/Esta ação não pode ser desfeita/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mesclar jogos' }));

    await waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`/api/games/${idA}/merge`);
    expect(JSON.parse(String(init?.body))).toEqual({ sourceGameId: idB });
  });

  it('permite buscar um duplicado com outro título', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    render(<GameMergeDialog game={library[0]!} games={library} onClose={() => undefined} onMerged={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Buscar jogo'), { target: { value: 'celes' } });
    expect(screen.getByText('Celeste')).toBeInTheDocument();
  });
});
