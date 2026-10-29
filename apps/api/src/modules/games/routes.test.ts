import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameInput, GameUpdate } from '@gameshelf/contracts';
import { registerGameRoutes } from './routes.js';
import type { GameRecord, GameRepository } from './repository.js';
import type { RawgAchievementProvider, RawgAchievementRepository } from '../game-platforms/rawg-achievements.js';

const gameId = '00000000-0000-4000-8000-000000000001';

function baseRecord(input: GameInput): GameRecord {
  return {
    id: gameId, title: input.title, description: input.description ?? null, coverUrl: input.coverUrl ?? null, backgroundUrl: input.backgroundUrl ?? null,
    releaseYear: input.releaseYear ?? null, developer: input.developer ?? null, publisher: input.publisher ?? null, franchiseId: input.franchiseId ?? null,
    platformId: input.platformId ?? null, platformIds: input.platformId ? [input.platformId] : [], genreIds: input.genreIds ?? [], status: input.status ?? 'BACKLOG',
    archived: false, priority: input.priority ?? 'NORMAL', rating: input.rating ?? null, difficulty: input.difficulty ?? null, gameType: input.gameType ?? null,
    completionCondition: input.completionCondition ?? null, favorite: input.favorite ?? false, gameOfYear: input.gameOfYear ?? false, excludedFromSuggestions: false,
    owned: input.owned ?? false, startedAt: input.startedAt ?? null, completedAt: input.completedAt ?? null, estimatedMainHours: input.estimatedMainHours ?? null,
    estimatedCompletionistHours: input.estimatedCompletionistHours ?? null, personalEstimatedHours: input.personalEstimatedHours ?? null, retroactivePlayedHours: 0,
    notes: input.notes ?? null, createdAt: new Date(), updatedAt: new Date(),
  };
}

function fakeGameRepository(): GameRepository {
  const games = new Map<string, GameRecord>();
  return {
    list: async () => [...games.values()],
    find: async (id: string) => games.get(id),
    create: async (input: GameInput) => { const record = baseRecord(input); games.set(record.id, record); return record; },
    update: async (id: string, input: GameUpdate) => { const existing = games.get(id); if (!existing) return undefined; const next = { ...existing, ...input }; games.set(id, next); return next; },
    delete: async (id: string) => games.delete(id),
  };
}

describe('vínculo automático de conquistas RAWG ao salvar um jogo', () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('busca e vincula o catálogo RAWG por melhor correspondência de título/ano', async () => {
    const candidates = [
      { id: 1, slug: 'outro-jogo', name: 'Outro jogo qualquer', released: '2020-01-01', backgroundImage: null },
      { id: 2, slug: 'final-fantasy-vii-rebirth', name: 'Final Fantasy VII Rebirth', released: '2024-02-29', backgroundImage: null },
    ];
    const achievements = [{ id: '00000000-0000-4000-8000-000000000002', rawgId: 9, name: 'Capítulo 1', description: null, imageUrl: null, percent: 80 }];
    const replace = vi.fn<RawgAchievementRepository['replace']>().mockResolvedValue({ linkedGame: candidates[1]!, achievements, refreshedAt: new Date().toISOString() });
    const provider: RawgAchievementProvider = { search: async () => candidates, achievements: async () => achievements };
    const store: RawgAchievementRepository = { get: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }), replace };

    const app = Fastify();
    apps.push(app);
    await registerGameRoutes(app, fakeGameRepository(), undefined, undefined, undefined, undefined, undefined, { store, provider });

    const response = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Final Fantasy VII Rebirth' } });
    expect(response.statusCode).toBe(201);

    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith(gameId, candidates[1], achievements);
  });

  it('não falha o cadastro quando a busca na RAWG dá erro', async () => {
    const provider: RawgAchievementProvider = { search: async () => { throw new Error('indisponível'); }, achievements: async () => [] };
    const store: RawgAchievementRepository = { get: async () => ({ linkedGame: null, achievements: [], refreshedAt: null }), replace: vi.fn() };

    const app = Fastify();
    apps.push(app);
    await registerGameRoutes(app, fakeGameRepository(), undefined, undefined, undefined, undefined, undefined, { store, provider });

    const response = await app.inject({ method: 'POST', url: '/games', payload: { title: 'Qualquer jogo' } });
    expect(response.statusCode).toBe(201);
  });
});
