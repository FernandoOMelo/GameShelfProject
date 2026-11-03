import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsCard } from './goals-card';
import { IntegrationHealthPanel } from './integration-health-panel';
import { MissionsCard } from './missions-card';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const list = { id: '00000000-0000-4000-8000-000000000070', name: 'Clássicos', gameCount: 3 };

describe('GoalsCard', () => {
  it('cria uma meta de texto livre com data limite e a conclui manualmente', async () => {
    const goal = { id: '00000000-0000-4000-8000-000000000071', kind: 'CUSTOM', period: 'YEAR', year: 2026, month: null, title: 'Platinar um jogo', description: null, listId: null, listName: null, dueDate: '2026-12-31', done: false, target: 1, current: 0, percent: 0, elapsedPercent: 10, achieved: false, onTrack: false };
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/goals') && init?.method === 'POST') return json(goal, 201);
      if (url.startsWith('/api/goals') && init?.method === 'PATCH') return json({ ...goal, done: true, current: 1, percent: 100, achieved: true });
      if (url.startsWith('/api/goals')) return json(fetchMock.mock.calls.some(([, call]) => call?.method === 'POST') ? [goal] : []);
      if (url === '/api/lists') return json([list]);
      return json([]);
    });
    render(<GoalsCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova meta' }));
    fireEvent.change(screen.getByLabelText('Tipo da meta'), { target: { value: 'CUSTOM' } });
    fireEvent.change(screen.getByLabelText('Texto da meta'), { target: { value: 'Platinar um jogo' } });
    fireEvent.change(screen.getByLabelText('Data limite da meta'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar meta' }));

    expect((await screen.findAllByText('Platinar um jogo')).length).toBeGreaterThan(0);
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ kind: 'CUSTOM', title: 'Platinar um jogo', dueDate: '2026-12-31' });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH' && String(init.body) === JSON.stringify({ done: true }))).toBe(true));
  });

  it('meta de zerar lista pede a lista e envia o listId', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/goals') && init?.method === 'POST') return json({}, 201);
      if (url === '/api/lists') return json([list]);
      return json([]);
    });
    render(<GoalsCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova meta' }));
    fireEvent.change(screen.getByLabelText('Tipo da meta'), { target: { value: 'COMPLETE_LIST' } });
    expect(screen.getByRole('button', { name: 'Criar meta' })).toBeDisabled();
    fireEvent.change(await screen.findByLabelText('Lista da meta'), { target: { value: list.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar meta' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST' && JSON.parse(String(init.body)).listId === list.id)).toBe(true));
  });
});

describe('MissionsCard', () => {
  it('mostra a missão principal e permite trocar qual é a principal', async () => {
    const primary = { id: '00000000-0000-4000-8000-000000000081', title: 'Zerar clássicos', description: null, kind: 'LIST', listId: list.id, listName: 'Clássicos', target: 4, current: 1, percent: 25, startsOn: '2026-01-01', dueDate: null, done: false, achieved: false, isPrimary: true };
    const second = { ...primary, id: '00000000-0000-4000-8000-000000000082', title: 'Jogar 50 horas', kind: 'HOURS', listId: null, listName: null, target: 50, current: 10, percent: 20, isPrimary: false };
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/missions/') && init?.method === 'PATCH') return json({ ...second, isPrimary: true });
      if (url === '/api/missions') return json([primary, second]);
      if (url === '/api/lists') return json([list]);
      return json([]);
    });
    render(<MissionsCard />);
    expect(await screen.findByText('MISSÃO PRINCIPAL')).toBeInTheDocument();
    expect(screen.getAllByText('Zerar clássicos').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Gerenciar missões'));
    fireEvent.click(screen.getByRole('button', { name: 'Tornar principal' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith(second.id) && init?.method === 'PATCH' && String(init.body) === JSON.stringify({ isPrimary: true }))).toBe(true));
  });
});

describe('IntegrationHealthPanel', () => {
  it('mostra o estado de cada integração e executa o teste sob demanda', async () => {
    const base = { envVars: ['RAWG_API_KEY'], lastCheckedAt: null, lastOk: null, lastSuccessAt: null, lastMessage: null };
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') return json({ ...base, key: 'rawg', name: 'RAWG (catálogo de conquistas)', configured: true, lastOk: true, lastCheckedAt: '2026-11-02T12:00:00.000Z', lastSuccessAt: '2026-11-02T12:00:00.000Z', lastMessage: 'Busca respondeu com 5 resultado(s).' });
      return json([
        { ...base, key: 'igdb', name: 'IGDB (metadados)', envVars: ['IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'], configured: false },
        { ...base, key: 'rawg', name: 'RAWG (catálogo de conquistas)', configured: true },
      ]);
    });
    render(<IntegrationHealthPanel />);
    expect(await screen.findByText('Não configurada')).toBeInTheDocument();
    expect(screen.getByText(/Defina IGDB_CLIENT_ID, IGDB_CLIENT_SECRET/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Testar RAWG' }));
    expect(await screen.findByText('Funcionando')).toBeInTheDocument();
    expect(screen.getByText(/Busca respondeu com 5 resultado/)).toBeInTheDocument();
  });
});
