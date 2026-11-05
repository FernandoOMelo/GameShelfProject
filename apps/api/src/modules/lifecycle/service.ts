import type { Game, Playthrough, StartMode } from '@gameshelf/contracts';

type JourneyLike = Pick<Playthrough, 'id' | 'sequence' | 'status' | 'startedAt' | 'completedAt'>;

/** Dia local (AAAA-MM-DD) de um instante; o deslocamento segue `Date.getTimezoneOffset`. */
export function localDate(instant: Date | string, timezoneOffsetMinutes: number): string {
  return new Date(new Date(instant).getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export type StartPlan = { mode: StartMode; journeyId: string | null; nextSequence: number };

/**
 * Decide o que fazer com a jornada ao começar a jogar (ADR-042). A jornada em
 * andamento só recebe a sessão; sem ela, a última jornada define a oferta.
 * Retomar uma pausada ou abandonada continua na mesma jornada (ADR-023).
 */
export function planStart(journeys: JourneyLike[]): StartPlan {
  const ordered = [...journeys].sort((a, b) => a.sequence - b.sequence);
  const nextSequence = ordered.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const active = [...ordered].reverse().find((item) => item.status === 'PLAYING');
  if (active) return { mode: 'LINK_ACTIVE', journeyId: active.id, nextSequence };
  const started = ordered.filter((item) => item.status !== 'PLANNED');
  const planned = ordered.find((item) => item.status === 'PLANNED');
  if (planned) return { mode: 'OFFER_PLANNED', journeyId: planned.id, nextSequence };
  const last = started[started.length - 1];
  if (!last) return { mode: 'OFFER_FIRST', journeyId: null, nextSequence };
  if (last.status === 'COMPLETED') return { mode: 'OFFER_REPLAY', journeyId: null, nextSequence };
  return { mode: 'OFFER_RESUME', journeyId: last.id, nextSequence };
}

/** Status do jogo depois de começar a jogar: só o que ainda não estava em jogo muda. DESIRED e COMPLETED ficam como estão. */
export function statusAfterStart(status: Game['status']): Game['status'] {
  return STARTABLE.has(status) ? 'PLAYING' : status;
}
const STARTABLE = new Set<string>(['BACKLOG', 'QUEUED', 'PAUSED', 'ABANDONED']);

export type FinishPlan = { action: 'COMPLETE' | 'CREATE_COMPLETED' | 'NONE'; journeyId: string | null };

/** Ao zerar: conclui a jornada em andamento (ou a pausada mais recente); sem nenhuma jornada, registra uma já concluída. */
export function planFinish(journeys: JourneyLike[]): FinishPlan {
  const ordered = [...journeys].sort((a, b) => b.sequence - a.sequence);
  const open = ordered.find((item) => item.status === 'PLAYING') ?? ordered.find((item) => item.status === 'PAUSED');
  if (open) return { action: 'COMPLETE', journeyId: open.id };
  if (journeys.length === 0) return { action: 'CREATE_COMPLETED', journeyId: null };
  return { action: 'NONE', journeyId: null };
}
