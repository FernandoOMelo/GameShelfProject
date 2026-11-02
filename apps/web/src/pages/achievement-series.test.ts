import { describe, expect, it } from 'vitest';
import { buildCumulativeSeries, niceMax } from './achievement-series';

const days = [{ date: '2025-01-10', count: 3 }, { date: '2026-02-01', count: 2 }, { date: '2026-02-05', count: 1 }];
const now = new Date(2026, 2, 1);

describe('buildCumulativeSeries', () => {
  it('acumula todo o período e termina no total', () => {
    const { points } = buildCumulativeSeries(days, 'ALL', now);
    expect(points[0]).toMatchObject({ value: 0 });
    expect(points.at(-1)).toMatchObject({ value: 6 });
  });

  it('começa o recorte do ano no acumulado anterior em vez de zero', () => {
    const { points, max } = buildCumulativeSeries(days, 'YEAR', now);
    expect(points[0]).toMatchObject({ value: 3 });
    expect(points.at(-1)).toMatchObject({ value: 6 });
    expect(max).toBe(6);
  });

  it('mantém uma linha reta quando não há conquistas', () => {
    const { points } = buildCumulativeSeries([], 'ALL', now);
    expect(points.every((point) => point.value === 0)).toBe(true);
  });
});

describe('niceMax', () => {
  it('arredonda para uma escala legível', () => {
    expect(niceMax(1400)).toBe(2000);
    expect(niceMax(6)).toBe(8);
    expect(niceMax(0)).toBe(4);
  });
});
