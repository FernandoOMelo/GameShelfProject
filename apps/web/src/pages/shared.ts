export const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

export function formatHours(value: number | null): string {
  if (value === null) return 'Não informada';
  return formatDuration(Math.round(value * 60));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Em andamento';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'}`;
  const hourLabel = `${hours} hora${hours === 1 ? '' : 's'}`;
  return remainingMinutes === 0 ? hourLabel : `${hourLabel} e ${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'}`;
}

export function formatElapsed(startedAt: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

// Compact hours for dense tables ("1.569 h"); long form stays in formatHours.
export function formatCompactHours(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} h`;
}

export const difficultyLabels = { C: 'C · Fácil', B: 'B · Médio', A: 'A · Complicado', AA: 'AA · Difícil', AAA: 'AAA · Imperdoável' } as const;

// Fixed-order categorical hues (dark-surface steps of the reference palette): color follows the status, never its rank.
export const statusColors = {
  PLAYING: '#3987e5', PAUSED: '#d95926', COMPLETED: '#199e70', ABANDONED: '#c98500', BACKLOG: '#d55181', DESIRED: '#9085e9',
} as const;
