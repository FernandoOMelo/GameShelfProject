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
 * Só a parte ainda não lançada é somada, e dela saem também os minutos de
 * sessão que o usuário já registrou naquela plataforma. Isso é o que torna a
 * ação idempotente e o que impede a duplicação no caso comum: lançar o total da
 * fonte, jogar uma hora aqui, sincronizar e lançar de novo ofereceria
 * exatamente a hora que já está na sessão.
 *
 * Sessões sem plataforma informada não entram no desconto — não há como saber a
 * qual plataforma pertencem.
 */
export type PlaytimeImportPlan =
  | { ok: true; importedMinutes: number; totalImportedMinutes: number; retroactivePlayedHours: number }
  | { ok: false; error: string };

export function planPlaytimeImport(
  link: { externalPlaytimeMinutes: number | null; externalPlaytimeImportedMinutes: number },
  currentRetroactiveHours: number,
  localMinutesOnPlatform = 0,
): PlaytimeImportPlan {
  if (link.externalPlaytimeMinutes === null) {
    return { ok: false, error: 'A fonte não informa tempo para esta plataforma.' };
  }
  const pending = link.externalPlaytimeMinutes - link.externalPlaytimeImportedMinutes - localMinutesOnPlatform;
  if (pending <= 0) {
    return {
      ok: false,
      error: localMinutesOnPlatform > 0
        ? 'Nada novo para lançar: o tempo informado já está coberto pelo que foi lançado e pelas sessões registradas nesta plataforma.'
        : 'Nada novo para lançar: o tempo informado já foi lançado como horas retroativas.',
    };
  }
  return {
    ok: true,
    importedMinutes: pending,
    // O marcador guarda o total da fonte: o que sobrou foi coberto por sessões,
    // e não deve ser oferecido de novo na próxima sincronização.
    totalImportedMinutes: link.externalPlaytimeMinutes,
    retroactivePlayedHours: round(currentRetroactiveHours + pending / 60),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
