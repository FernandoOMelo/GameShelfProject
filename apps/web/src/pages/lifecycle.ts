import type { FinishResult, FinishUndo, LifecycleHint } from '@gameshelf/contracts';
import { apiUrl } from './shared';

const PROMPT_KEY = 'gameshelf-journey-prompt';

/** Preferência local: perguntar sobre a jornada ao iniciar uma sessão (padrão) ou nunca (ADR-042). */
export function journeyPromptEnabled(): boolean {
  try { return window.localStorage.getItem(PROMPT_KEY) !== 'never'; } catch { return true; }
}

export function setJourneyPromptEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(PROMPT_KEY, enabled ? 'ask' : 'never'); } catch { /* Storage pode estar indisponível. */ }
}

const timezone = () => new Date().getTimezoneOffset();
const json = { 'content-type': 'application/json' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, init);
  if (!response.ok) throw new Error(String(response.status));
  return await response.json() as T;
}

export const fetchLifecycleHint = (gameId: string) =>
  request<LifecycleHint>(`/games/${gameId}/lifecycle?timezoneOffsetMinutes=${timezone()}`);

/** Cria ou retoma a jornada e vincula a sessão (já criada no servidor) a ela. */
export const startPlaying = (gameId: string, body: { sessionId?: string; startedAt?: string }) =>
  request<unknown>(`/games/${gameId}/start-playing`, { method: 'POST', headers: json, body: JSON.stringify({ ...body, timezoneOffsetMinutes: timezone() }) });

/** Grava a conclusão na hora; `completedAt` no formato AAAA-MM-DD, sem ele vale hoje. */
export const finishGameRequest = (gameId: string, completedAt?: string) =>
  request<FinishResult>(`/games/${gameId}/finish`, { method: 'POST', headers: json, body: JSON.stringify({ ...(completedAt ? { completedAt } : {}), timezoneOffsetMinutes: timezone() }) });

export const undoFinishRequest = (gameId: string, undo: FinishUndo) =>
  request<unknown>(`/games/${gameId}/finish/undo`, { method: 'POST', headers: json, body: JSON.stringify(undo) });

export const canFinishGame = (status: string) => status !== 'DESIRED' && status !== 'COMPLETED';
