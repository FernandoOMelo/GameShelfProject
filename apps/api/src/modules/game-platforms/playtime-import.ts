/**
 * Lançar o tempo informado pela plataforma como horas retroativas do jogo
 * (ADR-026).
 *
 * Isto não é importar sessões, e a diferença importa: a fonte não sabe quando
 * nem por quanto tempo se jogou, só o total acumulado. As horas retroativas são
 * exatamente o campo que o GameShelf já tem para "joguei, mas não registrei
 * sessão", então o número entra onde há semântica para ele, por uma ação
 * explícita do usuário — nunca pela sincronização.
 *
 * Só a parte ainda não lançada é somada. Isso é o que torna a ação idempotente:
 * repeti-la não faz nada, e quando a plataforma reporta mais tempo depois,
 * lança-se apenas a diferença.
 */
export type PlaytimeImportPlan =
  | { ok: true; importedMinutes: number; totalImportedMinutes: number; retroactivePlayedHours: number }
  | { ok: false; error: string };

export function planPlaytimeImport(
  link: { externalPlaytimeMinutes: number | null; externalPlaytimeImportedMinutes: number },
  currentRetroactiveHours: number,
): PlaytimeImportPlan {
  if (link.externalPlaytimeMinutes === null) {
    return { ok: false, error: 'A fonte não informa tempo para esta plataforma.' };
  }
  const pending = link.externalPlaytimeMinutes - link.externalPlaytimeImportedMinutes;
  if (pending <= 0) {
    return { ok: false, error: 'Nada novo para lançar: o tempo informado já foi lançado como horas retroativas.' };
  }
  return {
    ok: true,
    importedMinutes: pending,
    totalImportedMinutes: link.externalPlaytimeMinutes,
    retroactivePlayedHours: round(currentRetroactiveHours + pending / 60),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
