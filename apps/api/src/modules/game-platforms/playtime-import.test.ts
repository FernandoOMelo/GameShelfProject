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

  // O caso real: lança as 10 h da Steam, joga 1 h aqui, sincroniza (Steam passa
  // a 11 h) e tenta lançar de novo. A hora oferecida seria a que já está na
  // sessão.
  it('não oferece lançar a hora que já está registrada como sessão', () => {
    const result = planPlaytimeImport(link(660, 600), 10, 60);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('sessões registradas') });
  });

  it('lança só o que as sessões não cobrem', () => {
    // Fonte diz 5 h, 1 h de sessão registrada na plataforma, nada lançado antes.
    expect(planPlaytimeImport(link(300), 0, 60)).toEqual({
      ok: true, importedMinutes: 240, totalImportedMinutes: 300, retroactivePlayedHours: 4,
    });
  });

  it('marca o total da fonte mesmo quando parte foi coberta por sessões', () => {
    // O que sobrou foi coberto por sessão e não pode voltar a ser oferecido.
    expect(planPlaytimeImport(link(300), 0, 60)).toMatchObject({ totalImportedMinutes: 300 });
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
