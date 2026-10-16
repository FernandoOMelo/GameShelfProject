import type { Game, QueueItem, Session, Suggestion } from '@gameshelf/contracts';
import { estimateRemainingHours } from '../dashboard/service.js';

type Input = { games: Game[]; sessions: Session[]; queue: QueueItem[]; today?: string; limit?: number };

// Pesos da pontuação (docs/product/backlog.md). Prioridade e fila dominam; o restante desempata.
const PRIORITY_POINTS = { HIGH: 30, NORMAL: 15, LOW: 0 } as const;
const QUEUE_BASE_POINTS = 40;
const QUEUE_POINTS_PER_POSITION = 3;
const QUEUE_MAX_PENALTY_POSITIONS = 8;
const SHORT_GAME_HOURS = 5;
const MEDIUM_GAME_HOURS = 15;
const PAUSED_POINTS = 8;
const IDLE_POINTS_PER_30_DAYS = 2;
const IDLE_MAX_POINTS = 10;

// Sugere o próximo jogo entre os possuídos, não arquivados e que ainda não estão em andamento.
export function buildSuggestions({ games, sessions, queue, today = new Date().toISOString().slice(0, 10), limit = 3 }: Input): Suggestion[] {
  const queuePosition = new Map(queue.map((item) => [item.game.id, item.position]));
  const minutesByGame = new Map<string, number>();
  const lastSessionByGame = new Map<string, string>();
  for (const session of sessions) {
    if (session.durationMinutes !== null) minutesByGame.set(session.gameId, (minutesByGame.get(session.gameId) ?? 0) + session.durationMinutes);
    const last = lastSessionByGame.get(session.gameId);
    if (!last || session.startedAt > last) lastSessionByGame.set(session.gameId, session.startedAt);
  }
  const dayNumber = (date: string) => Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000);

  return games
    .filter((game) => game.owned && !game.archived && !game.excludedFromSuggestions && (game.status === 'BACKLOG' || game.status === 'PAUSED'))
    .map((game) => {
      const reasons: string[] = [];
      let score = PRIORITY_POINTS[game.priority];
      if (game.priority === 'HIGH') reasons.push('Prioridade alta');

      const position = queuePosition.get(game.id);
      if (position !== undefined) {
        score += QUEUE_BASE_POINTS - Math.min(position, QUEUE_MAX_PENALTY_POSITIONS) * QUEUE_POINTS_PER_POSITION;
        reasons.push(position === 0 ? 'Primeiro da fila' : `${position + 1}º da fila`);
      }

      const playedHours = (minutesByGame.get(game.id) ?? 0) / 60 + game.retroactivePlayedHours;
      const remaining = estimateRemainingHours(game, playedHours);
      if (remaining !== null && remaining <= SHORT_GAME_HOURS) { score += 10; reasons.push(`Curto: faltam ${formatHours(remaining)}`); }
      else if (remaining !== null && remaining <= MEDIUM_GAME_HOURS) { score += 5; reasons.push(`Cabe em pouco tempo: faltam ${formatHours(remaining)}`); }

      if (game.status === 'PAUSED') { score += PAUSED_POINTS; reasons.push('Pausado: dá para retomar de onde parou'); }

      const lastActivity = lastSessionByGame.get(game.id) ?? game.startedAt ?? game.createdAt;
      const idleDays = Math.max(0, dayNumber(today) - dayNumber(lastActivity));
      const idlePoints = Math.min(Math.floor(idleDays / 30) * IDLE_POINTS_PER_30_DAYS, IDLE_MAX_POINTS);
      if (idlePoints > 0) { score += idlePoints; reasons.push(`Esperando há ${idleDays} dias`); }

      return { game, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.game.title.localeCompare(b.game.title, 'pt-BR'))
    .slice(0, limit);
}

function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`.replace('.', ',');
}
