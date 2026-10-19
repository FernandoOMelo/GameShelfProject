import { describe, expect, it } from 'vitest';
import { toExternalAchievements } from './achievements.js';
import type { ExternalAchievementRecord } from './achievement-repository.js';

const synced = new Date('2026-05-01T12:00:00.000Z');
const record = (values: Partial<ExternalAchievementRecord> = {}): ExternalAchievementRecord => ({
  id: '00000000-0000-4000-8000-000000000001',
  gamePlatformId: '00000000-0000-4000-8000-0000000000f0',
  externalId: 'ACH_1', name: 'Primeira vitória', description: null, iconUrl: null,
  points: null, rarityPercent: null, unlocked: false, unlockedAt: null, syncedAt: synced,
  ...values,
});

describe('resumo das conquistas', () => {
  it('conta desbloqueadas e soma pontos só das desbloqueadas', () => {
    const result = toExternalAchievements([
      record({ id: '00000000-0000-4000-8000-000000000001', unlocked: true, points: 30 }),
      record({ id: '00000000-0000-4000-8000-000000000002', unlocked: true, points: 20 }),
      record({ id: '00000000-0000-4000-8000-000000000003', unlocked: false, points: 90 }),
    ], synced);

    expect(result).toMatchObject({ unlockedCount: 2, total: 3, points: 50 });
  });

  it('trata conquista sem pontuação como zero sem quebrar a soma', () => {
    const result = toExternalAchievements([
      record({ id: '00000000-0000-4000-8000-000000000001', unlocked: true, points: null }),
      record({ id: '00000000-0000-4000-8000-000000000002', unlocked: true, points: 15 }),
    ], synced);

    expect(result.points).toBe(15);
  });

  it('converte a raridade de numeric do banco para número', () => {
    const [achievement] = toExternalAchievements([record({ rarityPercent: '12.500' })], synced).achievements;
    expect(achievement!.rarityPercent).toBe(12.5);
  });

  it('marca a resposta como vinda do espelho quando não houve atualização', () => {
    expect(toExternalAchievements([record()], null).refreshedAt).toBeNull();
    expect(toExternalAchievements([record()], synced).refreshedAt).toBe(synced.toISOString());
  });

  it('responde vazio sem inventar resumo quando a fonte não tem conquistas', () => {
    expect(toExternalAchievements([], synced)).toMatchObject({ total: 0, unlockedCount: 0, points: 0, achievements: [] });
  });
});
