import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameRecord, GameRepository } from './repository.js';
import { duplicateKey, findDuplicateGroups, mergeGameFields, type GameMergeRepository } from './merge.js';
import { registerGameMergeRoutes } from './merge-routes.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const idA = '00000000-0000-4000-8000-00000000000a';
const idB = '00000000-0000-4000-8000-00000000000b';
const base = (overrides: Partial<GameRecord>): GameRecord => ({
  id: idA, title: 'Hades', description: null, coverUrl: null, backgroundUrl: null, releaseYear: null, developer: null, publisher: null,
  franchiseId: null, platformId: null, platformIds: [], genreIds: [], status: 'BACKLOG', archived: false, priority: 'NORMAL', rating: null,
  difficulty: null, gameType: null, completionCondition: null, favorite: false, gameOfYear: false, excludedFromSuggestions: false, owned: false,
  startedAt: null, completedAt: null, estimatedMainHours: null, estimatedCompletionistHours: null, personalEstimatedHours: null,
  retroactivePlayedHours: 0, notes: null, createdAt: now, updatedAt: now, ...overrides,
});

describe('duplicados', () => {
  it('normaliza acento, caixa, pontuação e marcas', () => {
    expect(duplicateKey('Marvel’s Spider-Man™')).toBe(duplicateKey('marvel s spider man'));
    expect(duplicateKey('Pokémon')).toBe('pokemon');
  });

  it('agrupa só títulos com a mesma chave', () => {
    const groups = findDuplicateGroups([{ id: 'a', title: 'God of War' }, { id: 'b', title: 'God of War®' }, { id: 'c', title: 'God of War Ragnarök' }]);
    expect(groups).toEqual([{ key: 'god of war', gameIds: ['a', 'b'] }]);
  });
});

describe('mergeGameFields', () => {
  it('preenche lacunas, soma horas lançadas e junta notas diferentes', () => {
    const merged = mergeGameFields(
      base({ description: 'Roguelike', retroactivePlayedHours: 10.5, notes: 'PS5', owned: false }),
      base({ id: idB, coverUrl: 'cover.png', description: 'Outro texto', retroactivePlayedHours: 4.25, notes: 'PC', owned: true, favorite: true }),
    );
    expect(merged).toMatchObject({ description: 'Roguelike', coverUrl: 'cover.png', retroactivePlayedHours: 14.75, owned: true, favorite: true });
    expect(merged.notes).toBe('PS5\n\n---\nPC');
  });

  it('usa o progresso mais adiantado e as datas coerentes entre si', () => {
    const merged = mergeGameFields(
      base({ status: 'BACKLOG', startedAt: '2026-03-01' }),
      base({ id: idB, status: 'COMPLETED', startedAt: '2026-02-01', completedAt: '2026-02-20', rating: 9, gameOfYear: true }),
    );
    expect(merged).toMatchObject({ status: 'COMPLETED', startedAt: '2026-02-01', completedAt: '2026-02-20', rating: 9, gameOfYear: true });
  });

  it('não mantém jogo do ano sem data de conclusão', () => {
    const merged = mergeGameFields(base({ status: 'PLAYING', gameOfYear: true }), base({ id: idB, status: 'BACKLOG' }));
    expect(merged).toMatchObject({ status: 'PLAYING', completedAt: null, gameOfYear: false });
  });
});

describe('rotas de mesclagem', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  const repository = { list: async () => [base({}), base({ id: idB })], find: async (id: string) => (id === idA ? base({}) : undefined) } as unknown as GameRepository;

  it('mescla o jogo de origem no da rota e recusa casos inválidos', async () => {
    const merge = vi.fn<GameMergeRepository['merge']>().mockResolvedValue(true);
    const app = Fastify();
    apps.push(app);
    registerGameMergeRoutes(app, repository, { merge });

    expect((await app.inject({ method: 'POST', url: `/games/${idA}/merge`, payload: { sourceGameId: idA } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/games/${idA}/merge`, payload: {} })).statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: `/games/${idA}/merge`, payload: { sourceGameId: idB } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().id).toBe(idA);
    expect(merge).toHaveBeenCalledWith(idA, idB);

    merge.mockResolvedValueOnce(false);
    expect((await app.inject({ method: 'POST', url: `/games/${idA}/merge`, payload: { sourceGameId: idB } })).statusCode).toBe(404);
  });

  it('sugere duplicados pelo título', async () => {
    const app = Fastify();
    apps.push(app);
    registerGameMergeRoutes(app, repository, { merge: async () => true });
    const response = await app.inject('/games/duplicates');
    expect(response.json()).toEqual([{ key: 'hades', gameIds: [idA, idB] }]);
  });
});
