import type { ExternalPendingMatch, ExternalSyncSummary, GameInput } from '@gameshelf/contracts';
import type { GamePlatformRecord, GamePlatformRepository } from '../game-platforms/repository.js';
import type { GameRepository } from '../games/repository.js';
import type { PlatformRepository } from '../platforms/repository.js';
import type { ExternalLibraryEntry, ExternalLibraryProvider } from './external-library.js';
import type { ExternalMatchQueueRepository, ExternalMatchRecord } from './match-queue-repository.js';

export type ImportDependencies = {
  provider: ExternalLibraryProvider;
  games: GameRepository;
  platforms: PlatformRepository;
  gamePlatforms: GamePlatformRepository;
  queue: ExternalMatchQueueRepository;
};

/**
 * Importa a biblioteca da fonte externa (ADR-024).
 *
 * O que esta função faz: para cada entrada externa já vinculada, atualiza o
 * tempo acumulado, a última atividade e a data da sincronização da associação
 * de plataforma. O que ela não faz, por decisão e não por simplificação:
 *
 * - não cria sessão nenhuma — a fonte não tem evento de sessão nem horário de
 *   início e fim, então não há o que importar;
 * - não cria nem altera jornadas, e encontrar o mesmo jogo em outra plataforma
 *   não é replay;
 * - não toca em título, status, backlog, avaliação, notas, datas do jogo nem na
 *   duração de sessão alguma;
 * - não soma o tempo externo às horas registradas localmente;
 * - não vincula por título: sem vínculo confirmado, a entrada vai para a fila.
 *
 * A idempotência vem do par (fonte, identificador externo): rodar duas vezes
 * reescreve o mesmo retrato nas mesmas linhas.
 */
export async function importExternalLibrary(deps: ImportDependencies, now = new Date()): Promise<ExternalSyncSummary> {
  const { provider, gamePlatforms, queue } = deps;
  const entries = await provider.fetchLibrary();

  const linked = new Map<string, GamePlatformRecord>();
  for (const record of await gamePlatforms.listByExternalSource(provider.source)) {
    if (record.externalId) linked.set(record.externalId, record);
  }
  const queued = new Map<string, ExternalMatchRecord>();
  for (const record of await queue.listForSource(provider.source)) queued.set(record.externalId, record);

  let updated = 0;
  let pending = 0;
  let ignored = 0;

  for (const entry of entries) {
    const association = linked.get(entry.externalId);
    if (association) {
      await gamePlatforms.updateExternalSnapshot(association.id, {
        source: provider.source,
        externalId: entry.externalId,
        accountLabel: entry.accountLabel,
        playtimeMinutes: entry.playtimeMinutes,
        lastPlayedAt: entry.lastPlayedAt,
        syncedAt: now,
      });
      updated += 1;
      // A entrada já tem dono: nada a confirmar. Uma pendência antiga da mesma
      // entrada (vinculada à mão depois) deixa de fazer sentido.
      if (queued.has(entry.externalId)) await queue.deleteByExternalId(provider.source, entry.externalId);
      continue;
    }

    const record = await queue.upsert({ source: provider.source, ...toSnapshot(entry) }, now);
    if (record.status === 'IGNORED') ignored += 1;
    else pending += 1;
  }

  return {
    source: provider.source,
    fetched: entries.length,
    updated,
    pending,
    ignored,
    sessionsCreated: 0,
    playthroughsCreated: 0,
  };
}

function toSnapshot(entry: ExternalLibraryEntry) {
  return {
    externalId: entry.externalId,
    title: entry.title,
    platformName: entry.platformName,
    accountLabel: entry.accountLabel,
    playtimeMinutes: entry.playtimeMinutes,
    lastPlayedAt: entry.lastPlayedAt,
  };
}

/**
 * Normalização só para sugerir: minúsculas, sem acentos, sem pontuação. Dois
 * títulos iguais depois disso são um candidato, nunca uma prova.
 */
export function normalizeTitle(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type MatchSuggestion = { gameId: string; title: string };

/**
 * Candidatos de um título externo entre os jogos canônicos. Mais de um
 * candidato é ambiguidade e fica para o usuário resolver: a API do Achievist
 * não expõe `igdb_id`, então não existe identificador comum para decidir.
 */
export function suggestMatches(title: string, games: Array<{ id: string; title: string }>): MatchSuggestion[] {
  const normalized = normalizeTitle(title);
  if (!normalized) return [];
  return games.filter((game) => normalizeTitle(game.title) === normalized)
    .map((game) => ({ gameId: game.id, title: game.title }));
}

export function toPendingMatch(record: ExternalMatchRecord, games: Array<{ id: string; title: string }>): ExternalPendingMatch {
  const suggestions = suggestMatches(record.title, games);
  return {
    id: record.id,
    source: record.source,
    externalId: record.externalId,
    title: record.title,
    platformName: record.platformName,
    accountLabel: record.accountLabel,
    externalPlaytimeMinutes: record.playtimeMinutes,
    externalLastPlayedAt: record.lastPlayedAt?.toISOString() ?? null,
    firstSeenAt: record.firstSeenAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
    suggestions,
    ambiguous: suggestions.length > 1,
  };
}

/** Encontra a plataforma do catálogo pelo nome, criando-a quando não existir. */
export async function resolvePlatform(platforms: PlatformRepository, name: string): Promise<string> {
  const normalized = name.trim();
  const existing = (await platforms.list()).find((platform) => platform.name.toLowerCase() === normalized.toLowerCase());
  return existing ? existing.id : (await platforms.create(normalized)).id;
}

export type CreateGameOutcome =
  | { ok: true; gameId: string; record: GamePlatformRecord }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Cadastra o jogo canônico a partir de uma entrada da fila e já o vincula.
 *
 * O jogo nasce com o que o usuário preencheu — o título sugerido pela fonte é
 * só um ponto de partida editável. A fonte externa não decide status, posse,
 * avaliação nem datas: ela não tem essa informação, e inventá-la contaminaria
 * a ficha pessoal do jogo.
 */
export async function createGameFromMatch(
  deps: Pick<ImportDependencies, 'games' | 'platforms' | 'gamePlatforms' | 'queue'>,
  pending: ExternalMatchRecord,
  input: { game: GameInput; platformId?: string },
  now = new Date(),
): Promise<CreateGameOutcome> {
  const game = await deps.games.create(input.game);
  const outcome = await confirmExternalMatch(deps, pending, { gameId: game.id, platformId: input.platformId }, now);
  if (!outcome.ok) return outcome;
  return { ok: true, gameId: game.id, record: outcome.record };
}

export type ConfirmOutcome =
  | { ok: true; record: GamePlatformRecord }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Confirma o vínculo entre uma entrada externa e um jogo canônico. É sempre uma
 * ação explícita do usuário: nem a sugestão por título nem a ambiguidade são
 * resolvidas sozinhas. Confirmar não cria jornada nem sessão.
 */
export async function confirmExternalMatch(
  deps: Pick<ImportDependencies, 'games' | 'platforms' | 'gamePlatforms' | 'queue'>,
  pending: ExternalMatchRecord,
  input: { gameId: string; platformId?: string },
  now = new Date(),
): Promise<ConfirmOutcome> {
  if (!await deps.games.find(input.gameId)) return { ok: false, status: 404, error: 'Jogo não encontrado.' };

  let platformId = input.platformId;
  if (platformId) {
    if (!(await deps.platforms.list()).some((platform) => platform.id === platformId)) {
      return { ok: false, status: 404, error: 'Plataforma não encontrada.' };
    }
  } else {
    platformId = await resolvePlatform(deps.platforms, pending.platformName);
  }

  // Uma associação já vinculada a outra entrada externa não é sobrescrita: o
  // par (fonte, identificador) é único, e trocar o vínculo em silêncio apagaria
  // a proveniência de outra plataforma.
  const associations = await deps.gamePlatforms.listForGame(input.gameId);
  const target = associations.find((item) => item.platformId === platformId && item.edition === null);
  if (target?.externalSource && target.externalId !== pending.externalId) {
    return { ok: false, status: 409, error: 'Esta plataforma do jogo já está vinculada a outra entrada externa.' };
  }

  const record = await deps.gamePlatforms.attachExternal(input.gameId, platformId, {
    source: pending.source,
    externalId: pending.externalId,
    accountLabel: pending.accountLabel,
    playtimeMinutes: pending.playtimeMinutes,
    lastPlayedAt: pending.lastPlayedAt,
    syncedAt: now,
  });
  // Confirmada, a pendência deixa de existir: o vínculo agora vive na associação.
  await deps.queue.delete(pending.id);
  return { ok: true, record };
}
