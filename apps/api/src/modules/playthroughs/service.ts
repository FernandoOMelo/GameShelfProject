import type { PlaythroughMetrics, PlaythroughStatus } from '@gameshelf/contracts';

export type PlaythroughLike = {
  id: string;
  sequence: number;
  status: PlaythroughStatus;
  startedAt: string | null;
  completedAt: string | null;
};

// Transições válidas (ADR-023). Retomar uma jornada pausada ou abandonada volta
// para "em andamento" na mesma jornada; reabrir uma concluída é explícito e
// também não cria outra jornada.
const TRANSITIONS: Record<PlaythroughStatus, PlaythroughStatus[]> = {
  PLANNED: ['PLAYING'],
  PLAYING: ['PAUSED', 'COMPLETED', 'ABANDONED'],
  PAUSED: ['PLAYING', 'COMPLETED', 'ABANDONED'],
  COMPLETED: ['PLAYING'],
  ABANDONED: ['PLAYING'],
};

const LABELS: Record<PlaythroughStatus, string> = {
  PLANNED: 'planejada', PLAYING: 'em andamento', PAUSED: 'pausada', COMPLETED: 'concluída', ABANDONED: 'abandonada',
};

/** Mensagem de erro quando a transição não é permitida; `undefined` quando é. */
export function checkTransition(from: PlaythroughStatus, to: PlaythroughStatus): string | undefined {
  if (from === to) return undefined;
  if (TRANSITIONS[from].includes(to)) return undefined;
  return `Uma jornada ${LABELS[from]} não pode passar para ${LABELS[to]}.`;
}

/** Uma jornada está iniciada quando deixou de ser apenas planejada. */
export function isStarted(playthrough: Pick<PlaythroughLike, 'status'>): boolean {
  return playthrough.status !== 'PLANNED';
}

/** Replay é toda jornada iniciada que não é a primeira do jogo, pela ordem de `sequence`. */
export function isReplay(playthrough: Pick<PlaythroughLike, 'sequence'>): boolean {
  return playthrough.sequence > 1;
}

export function nextSequence(existing: Array<Pick<PlaythroughLike, 'sequence'>>): number {
  return existing.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
}

export function buildMetrics(playthroughs: PlaythroughLike[]): PlaythroughMetrics {
  const started = playthroughs.filter(isStarted);
  // A jornada ativa é a que está em andamento; havendo mais de uma, a mais recente.
  const active = [...started].filter((item) => item.status === 'PLAYING').sort((a, b) => b.sequence - a.sequence)[0];
  return {
    total: playthroughs.length,
    started: started.length,
    completed: playthroughs.filter((item) => item.status === 'COMPLETED').length,
    abandoned: playthroughs.filter((item) => item.status === 'ABANDONED').length,
    replaysStarted: started.filter(isReplay).length,
    activePlaythroughId: active?.id ?? null,
  };
}
