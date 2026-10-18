import { describe, expect, it } from 'vitest';
import { buildMetrics, checkTransition, isReplay, isStarted, nextSequence, type PlaythroughLike } from './service.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const make = (n: number, values: Partial<PlaythroughLike> = {}): PlaythroughLike => ({
  id: id(n), sequence: n, status: 'PLANNED', startedAt: null, completedAt: null, ...values,
});

describe('regras das jornadas', () => {
  it('só considera iniciada a jornada que deixou de ser planejada', () => {
    expect(isStarted(make(1))).toBe(false);
    for (const status of ['PLAYING', 'PAUSED', 'COMPLETED', 'ABANDONED'] as const) {
      expect(isStarted(make(1, { status }))).toBe(true);
    }
  });

  it('trata como replay apenas as jornadas após a primeira', () => {
    expect(isReplay(make(1))).toBe(false);
    expect(isReplay(make(2))).toBe(true);
  });

  it('dá a próxima posição sem reaproveitar a de uma jornada existente', () => {
    expect(nextSequence([])).toBe(1);
    expect(nextSequence([make(1), make(3)])).toBe(4);
  });

  it('permite retomar uma jornada pausada e reabrir uma concluída', () => {
    expect(checkTransition('PAUSED', 'PLAYING')).toBeUndefined();
    expect(checkTransition('ABANDONED', 'PLAYING')).toBeUndefined();
    expect(checkTransition('COMPLETED', 'PLAYING')).toBeUndefined();
    expect(checkTransition('PLAYING', 'PLAYING')).toBeUndefined();
  });

  it('rejeita transições que saltam o início efetivo ou invertem uma conclusão', () => {
    expect(checkTransition('PLANNED', 'COMPLETED')).toBeTypeOf('string');
    expect(checkTransition('PLANNED', 'PAUSED')).toBeTypeOf('string');
    expect(checkTransition('COMPLETED', 'ABANDONED')).toBeTypeOf('string');
    expect(checkTransition('COMPLETED', 'PAUSED')).toBeTypeOf('string');
  });

  it('conta jornadas iniciadas, concluídas e replays sem somar as planejadas', () => {
    const metrics = buildMetrics([
      make(1, { status: 'COMPLETED', startedAt: '2024-01-01', completedAt: '2024-03-01' }),
      make(2, { status: 'ABANDONED', startedAt: '2025-01-01' }),
      make(3, { status: 'PLAYING', startedAt: '2026-01-01' }),
      make(4),
    ]);
    expect(metrics).toEqual({
      total: 4, started: 3, completed: 1, abandoned: 1, replaysStarted: 2, activePlaythroughId: id(3),
    });
  });

  it('não aponta jornada ativa quando nenhuma está em andamento', () => {
    expect(buildMetrics([make(1, { status: 'COMPLETED', completedAt: '2026-01-01' })]).activePlaythroughId).toBeNull();
    expect(buildMetrics([]).activePlaythroughId).toBeNull();
  });

  it('não conta uma jornada abandonada como concluída', () => {
    const metrics = buildMetrics([make(1, { status: 'ABANDONED', startedAt: '2026-01-01' })]);
    expect(metrics.completed).toBe(0);
    expect(metrics.abandoned).toBe(1);
  });
});
