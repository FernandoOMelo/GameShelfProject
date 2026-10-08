import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupCard } from './backup-card';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); fetchMock.mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// O jsdom não implementa Blob.text(); os navegadores sim.
const backupFile = (content: string) => Object.assign(new File([content], 'backup.json', { type: 'application/json' }), { text: async () => content });

describe('BackupCard', () => {
  it('downloads the export as a JSON file', async () => {
    fetchMock.mockResolvedValue(new Response('{"app":"gameshelf"}', { status: 200 }));
    const createObjectURL = vi.fn(() => 'blob:backup');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<BackupCard onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar dados' }));
    expect(await screen.findByText(/Backup exportado/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/backup/export');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
  });

  it('imports a chosen file, summarises the result and notifies the page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ games: 3, sessions: 5, lists: 2, goals: 1, screenshots: 0, queue: 1 }), { status: 201 }));
    const onImported = vi.fn();
    render(<BackupCard onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Importar backup'), { target: { files: [backupFile('{"app":"gameshelf","version":1}')] } });
    expect(await screen.findByText('Backup importado: 3 jogos, 5 sessões, 2 listas e 1 metas.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/backup/import');
    expect(JSON.parse(String(init?.body))).toEqual({ app: 'gameshelf', version: 1 });
    expect(onImported).toHaveBeenCalledOnce();
  });

  it('shows the reasons when the backup is inconsistent and does not notify the page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'O backup tem referências inconsistentes.', problems: ['Sessão x: jogo inexistente.'] }), { status: 400 }));
    const onImported = vi.fn();
    render(<BackupCard onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Importar backup'), { target: { files: [backupFile('{}')] } });
    expect(await screen.findByText('O backup tem referências inconsistentes.')).toBeInTheDocument();
    expect(screen.getByText('Sessão x: jogo inexistente.')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('refuses a file that is not JSON without calling the API', async () => {
    render(<BackupCard onImported={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Importar backup'), { target: { files: [backupFile('not json')] } });
    expect(await screen.findByText('O arquivo não é um JSON válido.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
