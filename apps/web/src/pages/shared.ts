export const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

// Estimativas de horas (campo do formulário) são exibidas em "Xh Ymin" para
// ficar legível com os quartos de hora que o campo aceita (ex.: 1h 45min);
// tabelas densas usam o formato compacto ("51,8 h") e sessões usam formatDuration
// ("1 hora e 30 minutos").
export function formatHours(value: number | null): string {
  if (value === null) return 'Não informada';
  return formatHoursMinutes(value);
}

export function formatHoursMinutes(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
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

// Compact time for dense tables and cards: minutes below one hour ("42min"),
// "Xh Ymin" up to 100 h and whole hours with thousands separator beyond that.
export function formatCompactHours(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (hours >= 100 || minutes === 0) return `${new Intl.NumberFormat('pt-BR').format(hours)}h`;
  return `${hours}h ${minutes}min`;
}

export const difficultyLabels = { C: 'C · Fácil', B: 'B · Médio', A: 'A · Complicado', AA: 'AA · Difícil', AAA: 'AAA · Imperdoável' } as const;

export const statusLabels = {
  DESIRED: 'Desejado', BACKLOG: 'Na biblioteca', PLAYING: 'Jogando', PAUSED: 'Pausado', COMPLETED: 'Zerado', ABANDONED: 'Abandonado',
} as const;

// Fixed-order categorical hues (dark-surface steps of the reference palette): color follows the status, never its rank.
export const statusColors = {
  PLAYING: '#3987e5', PAUSED: '#d95926', COMPLETED: '#199e70', ABANDONED: '#c98500', BACKLOG: '#d55181', DESIRED: '#9085e9',
} as const;
