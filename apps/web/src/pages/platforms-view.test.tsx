import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Platform, PlatformSummary } from '@gameshelf/contracts';
import { PlatformsView } from './platforms-view';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith('/platforms/catalog')) return Promise.resolve(Response.json([
      { name: 'Rockstar', catalogKey: 'rockstar', iconKey: 'rockstar', color: '#F08A00' },
      { name: 'Steam', catalogKey: 'steam', iconKey: 'steam', color: '#2A6FA8' },
    ]));
    if (url.endsWith('/integrations/achievist/sync')) return Promise.resolve(Response.json({ status: 'succeeded', startedAt: null, finishedAt: new Date(Date.now() - 19 * 60_000).toISOString(), summary: null, error: null }));
    return Promise.resolve(Response.json({}));
  });
});
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.unstubAllGlobals(); });

const PC = '00000000-0000-4000-8000-000000000020';
const PS5 = '00000000-0000-4000-8000-000000000021';
const STEAM = '00000000-0000-4000-8000-000000000022';

const pc: Platform = { id: PC, name: 'PC', iconKey: 'pc', color: '#5B6573', parentId: null };
const ps5: Platform = { id: PS5, name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1', parentId: null };
const steam: Platform = { id: STEAM, name: 'Steam', iconKey: 'steam', color: '#2A6FA8', parentId: PC };

function summary(platform: Platform, overrides: Partial<Omit<PlatformSummary, 'platform'>> = {}): PlatformSummary {
  return {
    platform, gameCount: 0, completedCount: 0, dominatedCount: 0, localPlayedMinutes: 0, externalPlayedMinutes: 0,
    achievementsUnlocked: 0, achievementsTotal: 0, recentGameCovers: [], ...overrides,
  };
}

const cardOf = (name: string) => screen.getAllByRole('listitem').find((item) => item.textContent?.includes(name))!;

describe('PlatformsView', () => {
  it('mostra contagem, tempo e conquistas quando o dado existe', () => {
    render(<PlatformsView
      platforms={[pc, ps5]}
      summaries={[
        summary(pc, { gameCount: 12, completedCount: 5, localPlayedMinutes: 600, achievementsUnlocked: 30, achievementsTotal: 120 }),
        summary(ps5, { gameCount: 3, completedCount: 1, externalPlayedMinutes: 90 }),
      ]}
      games={[]} onChanged={vi.fn()}
    />);

    expect(screen.getByRole('heading', { name: 'Plataformas' })).toBeInTheDocument();
    expect(within(cardOf('PC')).getByTitle('Jogos')).toHaveTextContent('12');
    expect(within(cardOf('PC')).getByTitle('Jogos zerados')).toHaveTextContent('5');
    expect(cardOf('PC')).toHaveTextContent('10h');
    expect(cardOf('PC')).toHaveTextContent('30 de 120');
    expect(cardOf('PlayStation 5')).toHaveTextContent('1h 30min');
    expect(cardOf('PlayStation 5')).toHaveTextContent('Zerados 33%');
  });

  it('omite tempo e conquistas quando não há dado, em vez de mostrar zero', () => {
    render(<PlatformsView platforms={[pc]} summaries={[summary(pc, { gameCount: 2 })]} games={[]} onChanged={vi.fn()} />);
    const card = cardOf('PC');
    expect(within(card).queryByTitle('Tempo de jogo')).not.toBeInTheDocument();
    expect(within(card).queryByTitle('Conquistas desbloqueadas')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Manual');
  });

  it('aplica a cor da marca ao cartão e mostra o estado do sync nas plataformas com dado externo', async () => {
    render(<PlatformsView platforms={[ps5]} summaries={[summary(ps5, { gameCount: 3, externalPlayedMinutes: 90 })]} games={[]} onChanged={vi.fn()} />);
    expect(cardOf('PlayStation 5').getAttribute('style')).toContain('--platform-color: #0070D1');
    expect(await screen.findByText(/Sync há 19 minutos/)).toBeInTheDocument();
    expect(within(cardOf('PlayStation 5')).getByText('Pronto')).toBeInTheDocument();
  });

  it('sincroniza o Achievist pelo botão do cartão', async () => {
    const onChanged = vi.fn();
    render(<PlatformsView platforms={[ps5]} summaries={[summary(ps5, { gameCount: 3, externalPlayedMinutes: 90 })]} games={[]} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar PlayStation 5' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/integrations/achievist/sync', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('mostra o estado vazio e abre o cadastro', async () => {
    render(<PlatformsView platforms={[]} summaries={[]} games={[]} onChanged={vi.fn()} />);
    expect(screen.getByText('Nenhuma plataforma ainda')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar plataforma' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Adicionar plataforma' })).toBeInTheDocument();
  });

  it('cadastra a partir do catálogo com ícone e cor oficiais, e dentro de um grupo', async () => {
    const onChanged = vi.fn();
    render(<PlatformsView platforms={[pc]} summaries={[]} games={[]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar plataforma' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rockstar' }));
    fireEvent.change(screen.getByLabelText('Grupo da plataforma'), { target: { value: PC } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/platforms', expect.objectContaining({ method: 'POST' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === '/api/platforms' && request?.method === 'POST')!;
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Rockstar', parentId: PC, iconKey: 'rockstar', color: '#F08A00' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('cadastra uma plataforma personalizada só pelo nome, deixando o servidor reconhecer', async () => {
    render(<PlatformsView platforms={[pc]} summaries={[]} games={[]} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar plataforma' }));
    fireEvent.change(await screen.findByLabelText('Nome da plataforma'), { target: { value: 'Meu console' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/platforms', expect.objectContaining({ method: 'POST' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === '/api/platforms' && request?.method === 'POST')!;
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Meu console', parentId: null });
  });

  it('edita nome e grupo enviando só o que mudou', async () => {
    const onChanged = vi.fn();
    render(<PlatformsView platforms={[pc, steam]} summaries={[]} games={[]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações de Steam' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nome da plataforma'), { target: { value: 'Steam Deck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/platforms/${STEAM}`, expect.objectContaining({ method: 'PATCH' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === `/api/platforms/${STEAM}` && request?.method === 'PATCH')!;
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Steam Deck' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('exclui a plataforma depois de confirmar e mostra a recusa da API', async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return Promise.resolve(Response.json({ error: 'Um jogo usa esta plataforma: remova o vínculo antes de excluí-la.' }, { status: 409 }));
      if (url.endsWith('/platforms/catalog')) return Promise.resolve(Response.json([]));
      return Promise.resolve(Response.json({ status: 'disabled', summary: null, error: 'desligada' }));
    });
    render(<PlatformsView platforms={[pc]} summaries={[]} games={[]} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações de PC' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Excluir plataforma' })).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText(/Um jogo usa esta plataforma/)).toBeInTheDocument();
  });
});
