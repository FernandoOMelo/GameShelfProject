import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Platform } from '@gameshelf/contracts';
import { PlatformsPanel } from './platforms-panel';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const PC = '00000000-0000-4000-8000-000000000020';
const STEAM = '00000000-0000-4000-8000-000000000022';
const platforms: Platform[] = [
  { id: PC, name: 'PC', parentId: null },
  { id: STEAM, name: 'Steam', parentId: PC },
];

/** A linha da plataforma na lista do painel. */
function rowOf(name: string) {
  return screen.getAllByRole('listitem').find((item) => item.textContent?.includes(name))!;
}

describe('PlatformsPanel', () => {
  it('creates a platform with an optional group', async () => {
    const onChanged = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ id: 'x', name: 'GOG' }, { status: 201 }));
    render(<PlatformsPanel platforms={platforms} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText('Nome da nova plataforma'), { target: { value: 'GOG' } });
    fireEvent.change(screen.getByLabelText('Grupo da nova plataforma'), { target: { value: PC } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/platforms', expect.objectContaining({ method: 'POST' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === '/api/platforms' && request?.method === 'POST')!;
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'GOG', parentId: PC });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('renames a platform inline', async () => {
    const onChanged = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ id: STEAM, name: 'Steam (PC)' }, { status: 200 }));
    render(<PlatformsPanel platforms={platforms} onChanged={onChanged} />);

    fireEvent.click(within(rowOf('Steam')).getByRole('button', { name: 'Renomear' }));
    fireEvent.change(screen.getByLabelText('Novo nome de Steam'), { target: { value: 'Steam (PC)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/platforms/${STEAM}`, expect.objectContaining({ method: 'PATCH' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === `/api/platforms/${STEAM}` && request?.method === 'PATCH')!;
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Steam (PC)' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows the API refusal when renaming hits a duplicated name', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'Já existe uma plataforma com esse nome.' }, { status: 409 }));
    render(<PlatformsPanel platforms={platforms} onChanged={vi.fn()} />);

    fireEvent.click(within(rowOf('Steam')).getByRole('button', { name: 'Renomear' }));
    fireEvent.change(screen.getByLabelText('Novo nome de Steam'), { target: { value: 'PC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma plataforma com esse nome.');
    expect(screen.getByLabelText('Novo nome de Steam')).toBeInTheDocument();
  });

  it('puts one platform inside another as a group', async () => {
    const onChanged = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ id: STEAM, name: 'Steam', parentId: null }, { status: 200 }));
    render(<PlatformsPanel platforms={[{ id: PC, name: 'PC', parentId: null }, { id: STEAM, name: 'Steam', parentId: null }]} onChanged={onChanged} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Grupo de Steam' }), { target: { value: PC } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/platforms/${STEAM}`, expect.objectContaining({ method: 'PATCH' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === `/api/platforms/${STEAM}` && request?.method === 'PATCH')!;
    expect(JSON.parse(String(init?.body))).toEqual({ parentId: PC });
  });

  it('asks for confirmation and deletes after it', async () => {
    const onChanged = vi.fn();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<PlatformsPanel platforms={platforms} onChanged={onChanged} />);

    // Exclui a subgrupo (Steam); a API aceita porque o mock não tem filhos nem vínculos.
    fireEvent.click(within(rowOf('Steam')).getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir plataforma' });
    expect(within(dialog).getByText(/A exclusão é recusada se houver jogos vinculados/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/platforms/'))).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/platforms/${STEAM}`, { method: 'DELETE' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('explains when the API refuses to delete a platform with linked games', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: '2 jogos usam esta plataforma: remova os vínculos antes de excluí-la.' }, { status: 409 }));
    render(<PlatformsPanel platforms={platforms} onChanged={vi.fn()} />);

    fireEvent.click(within(rowOf('Steam')).getByRole('button', { name: 'Excluir' }));

    // O painel só surfaca a recusa da API (grupo com filhos ou jogos vinculados).
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Excluir plataforma' })).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('2 jogos usam esta plataforma: remova os vínculos antes de excluí-la.');
  });

  it('filters the catalog by name', async () => {
    render(<PlatformsPanel platforms={platforms} onChanged={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Buscar plataforma'), { target: { value: 'steam' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(rowOf('Steam')).toHaveTextContent('Steam');
  });
});
