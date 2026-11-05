import { describe, expect, it } from 'vitest';
import { localDate, planFinish, planStart, statusAfterStart } from './service.js';

const journey = (n: number, status: 'PLANNED' | 'PLAYING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED') => ({ id: `j${n}`, sequence: n, status, startedAt: null, completedAt: null });

describe('planStart', () => {
  it('oferece a primeira jornada quando não há nenhuma iniciada', () => {
    expect(planStart([])).toEqual({ mode: 'OFFER_FIRST', journeyId: null, nextSequence: 1 });
  });
  it('só vincula a sessão quando há jornada em andamento', () => {
    expect(planStart([journey(1, 'COMPLETED'), journey(2, 'PLAYING')])).toEqual({ mode: 'LINK_ACTIVE', journeyId: 'j2', nextSequence: 3 });
  });
  it('oferece replay depois de uma jornada concluída', () => {
    expect(planStart([journey(1, 'COMPLETED')])).toEqual({ mode: 'OFFER_REPLAY', journeyId: null, nextSequence: 2 });
  });
  it('oferece retomar a última jornada pausada ou abandonada', () => {
    expect(planStart([journey(1, 'COMPLETED'), journey(2, 'ABANDONED')])).toMatchObject({ mode: 'OFFER_RESUME', journeyId: 'j2' });
    expect(planStart([journey(1, 'PAUSED')])).toMatchObject({ mode: 'OFFER_RESUME', journeyId: 'j1' });
  });
  it('usa a jornada planejada antes de criar outra', () => {
    expect(planStart([journey(1, 'COMPLETED'), journey(2, 'PLANNED')])).toMatchObject({ mode: 'OFFER_PLANNED', journeyId: 'j2' });
  });
});

describe('planFinish', () => {
  it('conclui a jornada em andamento ou a pausada mais recente', () => {
    expect(planFinish([journey(1, 'PAUSED'), journey(2, 'PLAYING')])).toEqual({ action: 'COMPLETE', journeyId: 'j2' });
    expect(planFinish([journey(1, 'PAUSED')])).toEqual({ action: 'COMPLETE', journeyId: 'j1' });
  });
  it('cria uma jornada concluída só quando o jogo não tem nenhuma', () => {
    expect(planFinish([])).toEqual({ action: 'CREATE_COMPLETED', journeyId: null });
    expect(planFinish([journey(1, 'COMPLETED')])).toEqual({ action: 'NONE', journeyId: null });
  });
});

describe('statusAfterStart e localDate', () => {
  it('muda para Jogando só o que ainda não estava em jogo', () => {
    for (const status of ['BACKLOG', 'PAUSED', 'ABANDONED'] as const) expect(statusAfterStart(status)).toBe('PLAYING');
    for (const status of ['DESIRED', 'PLAYING', 'COMPLETED'] as const) expect(statusAfterStart(status)).toBe(status);
  });
  it('calcula o dia local pelo deslocamento do fuso', () => {
    expect(localDate('2026-03-02T01:30:00.000Z', 180)).toBe('2026-03-01');
    expect(localDate('2026-03-02T01:30:00.000Z', 0)).toBe('2026-03-02');
  });
});
