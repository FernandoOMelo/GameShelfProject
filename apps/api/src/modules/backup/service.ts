import type { Backup, BackupData } from '@gameshelf/contracts';
import type { GameRecord } from '../games/repository.js';
import type { SessionRecord } from '../sessions/repository.js';
import type { ScreenshotRecord } from '../sessions/screenshot-repository.js';
import type { QueueRecord } from '../backlog/repository.js';
import type { GameListRecord } from '../game-lists/repository.js';
import type { GoalRecord } from '../goals/repository.js';
import { toGame } from '../shared/serialize.js';

export type BackupSources = {
  franchises: Array<{ id: string; name: string }>;
  platforms: Array<{ id: string; name: string }>;
  genres: Array<{ id: string; name: string }>;
  games: GameRecord[];
  sessions: SessionRecord[];
  screenshots: ScreenshotRecord[];
  queue: QueueRecord[];
  lists: GameListRecord[];
  challenge: { title: string; listId: string } | undefined;
  goals: GoalRecord[];
  weeklyMinutes: number;
};

export function buildBackup(sources: BackupSources, exportedAt: Date = new Date()): Backup {
  return {
    app: 'gameshelf', version: 1, exportedAt: exportedAt.toISOString(),
    data: {
      franchises: sources.franchises, platforms: sources.platforms, genres: sources.genres,
      games: sources.games.map(toGame),
      sessions: sources.sessions.map((session) => ({
        id: session.id, gameId: session.gameId, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
        progress: session.progress, location: session.location, notes: session.notes,
        createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(),
      })),
      screenshots: sources.screenshots.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      queue: [...sources.queue].sort((a, b) => a.position - b.position)
        .map((item) => ({ gameId: item.game.id, position: item.position, addedAt: item.addedAt.toISOString() })),
      lists: sources.lists.map((list) => ({
        id: list.id, name: list.name, gameIds: list.gameIds, createdAt: list.createdAt.toISOString(), updatedAt: list.updatedAt.toISOString(),
      })),
      challenge: sources.challenge ?? null,
      goals: sources.goals,
      weeklyMinutes: sources.weeklyMinutes,
    },
  };
}

const MAX_ISSUES = 20;

// Verifica o que o schema Zod não alcança: ids repetidos e referências entre coleções.
// Sem isso, um backup editado à mão só falharia no meio da transação, com erro genérico do banco.
export function findBackupIssues(data: BackupData): string[] {
  const issues: string[] = [];
  const add = (message: string) => { if (issues.length < MAX_ISSUES) issues.push(message); };

  const idSet = (label: string, items: Array<{ id: string }>) => {
    const ids = new Set<string>();
    for (const item of items) {
      if (ids.has(item.id)) add(`${label}: id repetido ${item.id}.`);
      ids.add(item.id);
    }
    return ids;
  };
  const uniqueNames = (label: string, items: Array<{ name: string }>) => {
    const names = new Set<string>();
    for (const item of items) {
      if (names.has(item.name)) add(`${label}: nome repetido "${item.name}".`);
      names.add(item.name);
    }
  };

  const franchiseIds = idSet('Franquias', data.franchises);
  const platformIds = idSet('Plataformas', data.platforms);
  const genreIds = idSet('Gêneros', data.genres);
  const gameIds = idSet('Jogos', data.games);
  const sessionIds = idSet('Sessões', data.sessions);
  const listIds = idSet('Listas', data.lists);
  idSet('Imagens', data.screenshots);
  idSet('Metas', data.goals);
  uniqueNames('Franquias', data.franchises);
  uniqueNames('Plataformas', data.platforms);
  uniqueNames('Gêneros', data.genres);
  uniqueNames('Listas', data.lists);

  for (const game of data.games) {
    if (game.franchiseId && !franchiseIds.has(game.franchiseId)) add(`Jogo "${game.title}": franquia inexistente.`);
    if (game.platformId && !platformIds.has(game.platformId)) add(`Jogo "${game.title}": plataforma inexistente.`);
    for (const genreId of game.genreIds) if (!genreIds.has(genreId)) add(`Jogo "${game.title}": gênero inexistente.`);
    if (new Set(game.genreIds).size !== game.genreIds.length) add(`Jogo "${game.title}": gêneros repetidos.`);
  }
  for (const session of data.sessions) if (!gameIds.has(session.gameId)) add(`Sessão ${session.id}: jogo inexistente.`);
  for (const screenshot of data.screenshots) if (!sessionIds.has(screenshot.sessionId)) add(`Imagem ${screenshot.id}: sessão inexistente.`);

  const queued = new Set<string>();
  const positions = new Set<number>();
  for (const entry of data.queue) {
    if (!gameIds.has(entry.gameId)) add(`Fila: jogo inexistente ${entry.gameId}.`);
    if (queued.has(entry.gameId)) add(`Fila: jogo repetido ${entry.gameId}.`);
    if (positions.has(entry.position)) add(`Fila: posição repetida ${entry.position}.`);
    queued.add(entry.gameId);
    positions.add(entry.position);
  }

  for (const list of data.lists) {
    if (new Set(list.gameIds).size !== list.gameIds.length) add(`Lista "${list.name}": jogos repetidos.`);
    for (const gameId of list.gameIds) if (!gameIds.has(gameId)) add(`Lista "${list.name}": jogo inexistente ${gameId}.`);
  }
  if (data.challenge && !listIds.has(data.challenge.listId)) add('Missão principal: lista inexistente.');

  const goalKeys = new Set<string>();
  for (const goal of data.goals) {
    const key = `${goal.kind}|${goal.period}|${goal.year}|${goal.month}`;
    if (goalKeys.has(key)) add(`Metas: meta repetida (${goal.kind}, ${goal.period}, ${goal.year}).`);
    goalKeys.add(key);
    const validMonth = goal.period === 'YEAR' ? goal.month === 0 : goal.month >= 1 && goal.month <= 12;
    if (!validMonth) add(`Meta ${goal.id}: mês incompatível com o período.`);
  }
  return issues;
}
