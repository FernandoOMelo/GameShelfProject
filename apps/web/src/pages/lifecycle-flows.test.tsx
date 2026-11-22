import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FinishResult, Game, LifecycleHint } from '@gameshelf/contracts';
import { JourneyStartDialog } from './journey-start-dialog';
import { FinishGameDialog } from './finish-game-dialog';
import { ReviewEditDialog } from './review-fields';
import { QuickAddDialog } from './quick-add-dialog';
import { MetadataReviewView } from './metadata-review-view';
import { JourneyPromptSetting } from './settings-view';
import { journeyPromptEnabled, setJourneyPromptEnabled } from './lifecycle';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const start = (mode: LifecycleHint['start']['mode'], lastSession: LifecycleHint['start']['lastSession'] = null): LifecycleHint['start'] =>
  ({ mode, journeyId: null, nextSequence: 2, suggestedPlatformId: null, gameStatusAfter: 'PLAYING', lastSession });

describe('JourneyStartDialog', () => {
  it('oferece a jornada em um clique e mostra onde o jogador parou', () => {
    const onAccept = vi.fn();
    render(<JourneyStartDialog gameTitle="Hades" hint={start('OFFER_FIRST', { endedAt: '2026-04-01T21:00:00.000Z', progress: 30, location: 'Tártaro', keyDecisions: null })} onAccept={onAccept} onDismiss={() => undefined} />);
    expect(screen.getByText('Parou em: Tártaro · 30%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar jornada #2' }));
    expect(onAccept).toHaveBeenCalled();
  });

  it('dispensa com "Agora não" e não aparece para jornada ativa', () => {
    const onDismiss = vi.fn();
    const { rerender, container } = render(<JourneyStartDialog gameTitle="Hades" hint={start('OFFER_REPLAY')} onAccept={() => undefined} onDismiss={onDismiss} />);
    expect(screen.getByText('Começar um replay?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(onDismiss).toHaveBeenCalled();
    rerender(<JourneyStartDialog gameTitle="Hades" hint={start('LINK_ACTIVE')} onAccept={() => undefined} onDismiss={onDismiss} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('preferência de jornada', () => {
  it('pergunta por padrão e respeita "nunca"', () => {
    expect(journeyPromptEnabled()).toBe(true);
    setJourneyPromptEnabled(false);
    expect(journeyPromptEnabled()).toBe(false);
  });

  it('o controle das Configurações grava a escolha', () => {
    render(<JourneyPromptSetting />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Perguntar sobre a jornada/ }));
    expect(journeyPromptEnabled()).toBe(false);
  });
});

const game = (values: Partial<Game> = {}) => ({ id: '00000000-0000-4000-8000-000000000001', title: 'Hades', status: 'COMPLETED', completedAt: '2026-05-01', favorite: false, ...values }) as Game;
const result = (): FinishResult => ({ game: game(), playthrough: null, closedSessionIds: [], undo: {} as FinishResult['undo'] });

describe('FinishGameDialog', () => {
  it('percorre as etapas e grava só o que foi preenchido', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<FinishGameDialog result={result()} onChangeDate={async () => result()} onSave={onSave} onClose={onClose} />);
    expect(screen.getByText('Hades zerado!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: /^AA ·/ }));
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ rating: 10, difficulty: 'AA' });
  });

  it('grava a análise com critérios e texto quando preenchida', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<FinishGameDialog result={result()} onChangeDate={async () => result()} onSave={onSave} onClose={onClose} />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Trilha sonora' })).getByRole('button', { name: '10' }));
    fireEvent.change(screen.getByLabelText('Comentário de gameplay'), { target: { value: 'Combate fluido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.change(screen.getByLabelText(/Sua análise do jogo/), { target: { value: 'Obra-prima.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ review: {
      summary: 'Obra-prima.', gameplay: { score: null, comment: 'Combate fluido' }, setting: { score: null, comment: null },
      soundtrack: { score: 10, comment: null }, story: { score: null, comment: null },
    } });
  });

  it('pular tudo fecha sem gravar nada', () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<FinishGameDialog result={result()} onChangeDate={async () => result()} onSave={onSave} onClose={onClose} />);
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('mudar a data refaz a conclusão', async () => {
    const onChangeDate = vi.fn(async () => ({ ...result(), game: game({ completedAt: '2026-04-20' }) }));
    render(<FinishGameDialog result={result()} onChangeDate={onChangeDate} onSave={async () => undefined} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Data de conclusão'), { target: { value: '2026-04-20' } });
    await waitFor(() => expect(onChangeDate).toHaveBeenCalledWith('2026-04-20'));
    expect(await screen.findByText(/20\/04\/2026/)).toBeInTheDocument();
  });
});

describe('ReviewEditDialog', () => {
  const review = { summary: 'Boa.', gameplay: { score: 8, comment: null }, setting: { score: null, comment: null }, soundtrack: { score: null, comment: null }, story: { score: null, comment: null } };

  it('carrega a análise atual e salva a alteração', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<ReviewEditDialog game={game({ review })} onSave={onSave} onClose={onClose} />);
    expect(screen.getByLabelText(/Sua análise do jogo/)).toHaveValue('Boa.');
    fireEvent.click(within(screen.getByRole('group', { name: 'História' })).getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ ...review, story: { score: 7, comment: null } });
  });

  it('esvaziar tudo remove a análise', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<ReviewEditDialog game={game({ review })} onSave={onSave} onClose={() => undefined} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Gameplay' })).getByRole('button', { name: '8' }));
    fireEvent.change(screen.getByLabelText(/Sua análise do jogo/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('mantém o diálogo aberto quando salvar falha', async () => {
    const onClose = vi.fn();
    render(<ReviewEditDialog game={game({ review })} onSave={async () => { throw new Error('x'); }} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('QuickAddDialog', () => {
  it('cria o jogo só com o título e a plataforma', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? { id: 'g', title: 'Hades' } : []), { status: init?.method === 'POST' ? 201 : 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onCreated = vi.fn();
    render(<QuickAddDialog platforms={[{ id: 'p1', name: 'PC' } as never]} debounceMs={5} onCreated={onCreated} onMoreDetails={() => undefined} onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Hades' } });
    fireEvent.change(screen.getByLabelText(/Plataforma/), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ title: 'Hades', status: 'BACKLOG', platformId: 'p1' });
  });

  it('exige título, sugere o oficial e abre o editor completo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ providerId: 'i', title: 'Hades', releaseYear: 2020 }]), { status: 200 })));
    const onMore = vi.fn();
    render(<QuickAddDialog platforms={[]} debounceMs={5} onCreated={() => undefined} onMoreDetails={onMore} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o título do jogo.');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'hades' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Hades (2020)' }));
    expect(screen.getByLabelText('Título')).toHaveValue('Hades');
    fireEvent.click(screen.getByRole('button', { name: 'Mais detalhes' }));
    expect(onMore).toHaveBeenCalledWith('Hades');
  });
});

describe('MetadataReviewView', () => {
  const review = {
    count: 3,
    items: [
      { gameId: 'g1', title: 'Hades', coverUrl: null, status: 'APPLIED_AUTO', appliedFields: ['description', 'coverUrl'], candidates: [], checkedAt: '2026-05-01T12:00:00.000Z' },
      { gameId: 'g2', title: 'Hollow', coverUrl: null, status: 'NEEDS_REVIEW', appliedFields: [], candidates: [{ providerId: 'igdb-2', title: 'Hollow Knight', releaseYear: 2017 }], checkedAt: '2026-05-01T12:00:00.000Z' },
      { gameId: 'g3', title: 'Xyzzy', coverUrl: null, status: 'NOT_FOUND', appliedFields: [], candidates: [], checkedAt: '2026-05-01T12:00:00.000Z' },
    ],
  };

  it('mostra cada estado com as ações certas e age pela API', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? { ok: true } : review), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MetadataReviewView />);
    expect(await screen.findByText('Preenchido sozinho: descrição, capa')).toBeInTheDocument();
    expect(screen.getByText('Mais de um resultado possível')).toBeInTheDocument();
    expect(screen.getByText('Nada encontrado com este título')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar este' }));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([input]) => String(input));
      expect(urls.some((url) => url.endsWith('/metadata-sync/g1/confirm'))).toBe(true);
      expect(urls.some((url) => url.endsWith('/metadata-sync/g2/use'))).toBe(true);
    });
  });

  it('mostra o estado vazio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ count: 0, items: [] }), { status: 200 })));
    render(<MetadataReviewView />);
    expect(await screen.findByText('Nada para revisar')).toBeInTheDocument();
  });
});
