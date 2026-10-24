import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game, Platform } from '@gameshelf/contracts';
import { SettingsView } from './settings-view';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const platforms: Platform[] = [{ id: 'platform-1', name: 'PC', parentId: null }];
const games = [{ id: 'game-1', title: 'Hades' }] as unknown as Game[];

/** Estado do Achievist desligado: a integração não deve bloquear a tela. */
function serveDisabledAchievist() {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/integrations/achievist/sync')) {
      return Promise.resolve(Response.json({
        source: 'achievist', status: 'disabled', startedAt: null, finishedAt: null, summary: null,
        error: 'A integração está desligada: configure ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD.',
      }, { status: init?.method === 'POST' ? 503 : 200 }));
    }
    return Promise.resolve(Response.json([], { status: 200 }));
  });
}

describe('SettingsView', () => {
  it('groups the configuration sections in one page', async () => {
    serveDisabledAchievist();
    render(<SettingsView platforms={platforms} games={games} weeklyHours={6} onPlatformsChanged={vi.fn()} onRefresh={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plataformas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plataformas externas (Achievist)' })).toBeInTheDocument();
    expect(await screen.findByText(/A integração está desligada/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meta semanal' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Minutos disponíveis por semana' })).toHaveValue(360);
  });

  it('saves the weekly goal and refreshes the planning views', async () => {
    serveDisabledAchievist();
    const onRefresh = vi.fn(async () => {});
    render(<SettingsView platforms={platforms} games={games} weeklyHours={0} onPlatformsChanged={vi.fn()} onRefresh={onRefresh} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutos disponíveis por semana' }), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));

    expect(await screen.findByText('Meta semanal salva.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/planning/settings', expect.objectContaining({ method: 'PUT' })));
    const [, init] = fetchMock.mock.calls.find(([url, request]) => String(url) === '/api/planning/settings' && request?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({ weeklyMinutes: 300 });
    expect(onRefresh).toHaveBeenCalled();
  });

  it('tells when the weekly goal could not be saved', async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/planning/settings')) return Promise.resolve(Response.json({ error: 'erro' }, { status: 500 }));
      return Promise.resolve(Response.json([], { status: 200 }));
    });
    render(<SettingsView platforms={platforms} games={games} weeklyHours={0} onPlatformsChanged={vi.fn()} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));

    expect(await screen.findByText('Não foi possível salvar a meta semanal.')).toBeInTheDocument();
  });

  it('notifies platform changes back to the app', async () => {
    serveDisabledAchievist();
    const onPlatformsChanged = vi.fn();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/integrations/achievist/sync')) return Promise.resolve(Response.json({ status: 'disabled', summary: null, error: 'desligada' }, { status: 200 }));
      if (url.endsWith('/platforms') && init?.method === 'POST') return Promise.resolve(Response.json({ id: 'platform-2', name: 'GOG' }, { status: 201 }));
      return Promise.resolve(Response.json([], { status: 200 }));
    });
    render(<SettingsView platforms={platforms} games={games} weeklyHours={0} onPlatformsChanged={onPlatformsChanged} onRefresh={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nome da nova plataforma'), { target: { value: 'GOG' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(onPlatformsChanged).toHaveBeenCalled());
  });
});
