import { describe, expect, it } from 'vitest';
import { planPlaytimeImport } from './playtime-import.js';

const link = (externalPlaytimeMinutes: number | null, externalPlaytimeImportedMinutes = 0) => ({
  externalPlaytimeMinutes, externalPlaytimeImportedMinutes,
});

describe('lançar tempo externo como horas retroativas', () => {
  it('lança todo o tempo informado quando nada foi lançado antes', () => {
    expect(planPlaytimeImport(link(120), 0)).toEqual({
      ok: true, importedMinutes: 120, totalImportedMinutes: 120, retroactivePlayedHours: 2,
    });
  });

  it('soma ao que o jogo já tinha de horas retroativas', () => {
    expect(planPlaytimeImport(link(90), 10)).toMatchObject({ ok: true, retroactivePlayedHours: 11.5 });
  });

  it('não lança nada na segunda vez: a ação é idempotente', () => {
    const result = planPlaytimeImport(link(120, 120), 2);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('já foi lançado') });
  });

  it('lança só a diferença quando a plataforma reporta mais tempo depois', () => {
    expect(planPlaytimeImport(link(180, 120), 2)).toEqual({
      ok: true, importedMinutes: 60, totalImportedMinutes: 180, retroactivePlayedHours: 3,
    });
  });

  it('recusa quando a fonte não informa tempo, em vez de tratar como zero', () => {
    expect(planPlaytimeImport(link(null), 0)).toEqual({ ok: false, error: expect.stringContaining('não informa') });
  });

  it('recusa quando o tempo informado encolheu em relação ao que já foi lançado', () => {
    expect(planPlaytimeImport(link(60, 120), 2)).toMatchObject({ ok: false });
  });

  it('arredonda as horas em duas casas, sem acumular dízima', () => {
    expect(planPlaytimeImport(link(50), 0)).toMatchObject({ retroactivePlayedHours: 0.83 });
  });
});
