import type { GameMetadataCandidate, GameUpdate, MetadataReviewResponse, MetadataSyncRunResult } from '@gameshelf/contracts';
import type { FranchiseRepository } from '../franchises/repository.js';
import type { GameImageStorage } from '../games/image-storage.js';
import type { GameMetadataProvider } from '../games/metadata-provider.js';
import type { GameRepository, GameRecord } from '../games/repository.js';
import type { GameTimeEstimateProvider } from '../games/time-estimate-provider.js';
import type { GenreRepository } from '../genres/repository.js';
import { normalizeTitle, pickMatch } from './match.js';
import type { MetadataSyncRecord, MetadataSyncRepository } from './repository.js';

export type MetadataSyncDependencies = {
  games: GameRepository;
  genres: GenreRepository;
  franchises: FranchiseRepository;
  provider: GameMetadataProvider;
  store: MetadataSyncRepository;
  timeEstimates?: GameTimeEstimateProvider;
  images?: GameImageStorage;
  now?: () => Date;
  /** Pausa entre consultas da varredura, para respeitar o limite do IGDB. */
  sleep?: (ms: number) => Promise<void>;
};

export type SyncOutcome = 'SKIPPED' | 'APPLIED_AUTO' | 'CONFIRMED' | 'NEEDS_REVIEW' | 'NOT_FOUND' | 'FAILED';

const RETRY_NOT_FOUND_MS = 30 * 86_400_000;
const SWEEP_PAUSE_MS = 300;
type TimeField = 'estimatedMainHours' | 'estimatedCompletionistHours';

/** Um jogo "sem metadados" tem algum dos campos que a captura sabe preencher vazio. */
export function needsMetadata(game: Pick<GameRecord, 'coverUrl' | 'description' | 'releaseYear' | 'developer' | 'genreIds'>): boolean {
  return !game.coverUrl || !game.description || game.releaseYear === null || !game.developer || game.genreIds.length === 0;
}

/**
 * Captura automática de metadados (ADR-043). Só aplica sozinha com correspondência
 * exata e única e nunca sobrescreve um campo já preenchido; o resto vai para
 * revisão. Falha do provedor não grava nada: o jogo é tentado de novo depois.
 */
export class MetadataSyncService {
  constructor(private readonly deps: MetadataSyncDependencies) {}

  private now(): Date { return this.deps.now?.() ?? new Date(); }

  /** O jogo deve ser consultado agora? Respeita o que já foi decidido e a regra dos 30 dias. */
  private due(game: GameRecord, record: MetadataSyncRecord | undefined): boolean {
    if (!needsMetadata(game)) return false;
    if (!record) return true;
    if (record.checkedTitle !== game.title) return record.status !== 'IGNORED';
    if (record.status === 'NOT_FOUND') return this.now().getTime() - record.checkedAt.getTime() >= RETRY_NOT_FOUND_MS;
    return false;
  }

  async syncGame(gameId: string, options: { force?: boolean } = {}): Promise<SyncOutcome> {
    const game = await this.deps.games.find(gameId);
    if (!game) return 'SKIPPED';
    const record = await this.deps.store.get(gameId);
    if (!options.force && !this.due(game, record)) return 'SKIPPED';

    let candidates: GameMetadataCandidate[];
    try {
      candidates = await this.deps.provider.search(game.title.slice(0, 100));
    } catch {
      return 'FAILED';
    }
    const outcome = pickMatch(game, candidates);
    const base = { gameId, checkedTitle: game.title, checkedAt: this.now(), candidates: candidates.slice(0, 10) };
    if (outcome.kind === 'NONE') {
      await this.deps.store.upsert({ ...base, status: 'NOT_FOUND', providerId: null, appliedFields: [] });
      return 'NOT_FOUND';
    }
    if (outcome.kind === 'REVIEW') {
      await this.deps.store.upsert({ ...base, status: 'NEEDS_REVIEW', providerId: null, appliedFields: [] });
      return 'NEEDS_REVIEW';
    }
    const appliedFields = await this.applyCandidate(game, outcome.candidate);
    // Nada a preencher: o jogo já estava completo, então não há o que revisar.
    const status = appliedFields.length > 0 ? 'APPLIED_AUTO' : 'CONFIRMED';
    await this.deps.store.upsert({ ...base, status, providerId: outcome.candidate.providerId, appliedFields });
    return status;
  }

  /** Preenche só os campos vazios; devolve os que preencheu. */
  private async applyCandidate(game: GameRecord, candidate: GameMetadataCandidate): Promise<string[]> {
    const patch: GameUpdate = {};
    const fields: string[] = [];
    const fill = <K extends 'description' | 'releaseYear' | 'developer' | 'publisher'>(key: K, value: GameRecord[K] | null | undefined) => {
      if ((game[key] === null || game[key] === '') && value !== null && value !== undefined && value !== '') {
        (patch as Record<string, unknown>)[key] = value; fields.push(key);
      }
    };
    fill('description', candidate.description);
    fill('releaseYear', candidate.releaseYear);
    fill('developer', candidate.developer);
    fill('publisher', candidate.publisher);

    for (const key of ['coverUrl', 'backgroundUrl'] as const) {
      const remote = candidate[key];
      if (game[key] || !remote) continue;
      try {
        patch[key] = this.deps.images ? await this.deps.images.importImage(remote) : remote;
        fields.push(key);
      } catch { /* imagem indisponível: o resto da captura segue */ }
    }
    if (game.genreIds.length === 0 && candidate.genres?.length) {
      patch.genreIds = await this.resolveGenres(candidate.genres);
      fields.push('genreIds');
    }
    if (game.franchiseId === null && candidate.franchise) {
      const franchiseId = await this.resolveFranchise(candidate.franchise, candidate.franchiseIgdbId ?? null);
      if (franchiseId) { patch.franchiseId = franchiseId; fields.push('franchiseId'); }
    }
    const timeFields = await this.timeEstimatePatch(game);
    Object.assign(patch, timeFields);
    fields.push(...Object.keys(timeFields));

    if (fields.length > 0) await this.deps.games.update(game.id, patch);
    return fields;
  }

  /** Melhor esforço (ADR-019): só com título exato e único, só nos campos vazios. */
  private async timeEstimatePatch(game: GameRecord): Promise<Partial<Record<TimeField, number>>> {
    const provider = this.deps.timeEstimates;
    if (!provider || (game.estimatedMainHours !== null && game.estimatedCompletionistHours !== null)) return {};
    try {
      const wanted = normalizeTitle(game.title);
      const exact = (await provider.search(game.title.slice(0, 100))).filter((item) => normalizeTitle(item.title) === wanted
        && (game.releaseYear === null || item.releaseYear == null || item.releaseYear === game.releaseYear));
      const [only] = exact;
      if (exact.length !== 1 || !only) return {};
      return {
        ...(game.estimatedMainHours === null && only.mainHours ? { estimatedMainHours: only.mainHours } : {}),
        ...(game.estimatedCompletionistHours === null && only.completionistHours ? { estimatedCompletionistHours: only.completionistHours } : {}),
      };
    } catch {
      return {};
    }
  }

  private async resolveGenres(names: string[]): Promise<string[]> {
    const existing = new Map((await this.deps.genres.list()).map((genre) => [genre.name.toLocaleLowerCase('pt-BR'), genre.id]));
    const ids: string[] = [];
    for (const name of names) {
      const key = name.toLocaleLowerCase('pt-BR');
      let id = existing.get(key);
      if (!id) { id = (await this.deps.genres.create(name)).id; existing.set(key, id); }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  private async resolveFranchise(name: string, igdbId: number | null): Promise<string | undefined> {
    const franchises = await this.deps.franchises.list();
    const found = franchises.find((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (found) return found.id;
    return (await this.deps.franchises.create(name, igdbId)).id;
  }

  /** Consulta os jogos pendentes, no máximo `limit` por rodada; para na primeira falha do provedor. */
  async sweep(limit = 25): Promise<MetadataSyncRunResult> {
    const result: MetadataSyncRunResult = { checked: 0, applied: 0, review: 0, notFound: 0, failed: false };
    const records = new Map((await this.deps.store.listAll()).map((record) => [record.gameId, record]));
    const pending = (await this.deps.games.list()).filter((game) => !game.archived && this.due(game, records.get(game.id))).slice(0, limit);
    for (const game of pending) {
      const outcome = await this.syncGame(game.id);
      if (outcome === 'FAILED') { result.failed = true; break; }
      result.checked += 1;
      if (outcome === 'APPLIED_AUTO' || outcome === 'CONFIRMED') result.applied += 1;
      if (outcome === 'NEEDS_REVIEW') result.review += 1;
      if (outcome === 'NOT_FOUND') result.notFound += 1;
      await (this.deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(SWEEP_PAUSE_MS);
    }
    return result;
  }

  /** Jogos que pedem atenção do usuário. */
  async review(): Promise<MetadataReviewResponse> {
    const records = (await this.deps.store.listAll()).filter((record) => record.status === 'APPLIED_AUTO' || record.status === 'NEEDS_REVIEW' || record.status === 'NOT_FOUND');
    const games = new Map((await this.deps.games.list()).map((game) => [game.id, game]));
    const items = records.flatMap((record) => {
      const game = games.get(record.gameId);
      return game ? [{
        gameId: record.gameId, title: game.title, coverUrl: game.coverUrl, status: record.status,
        appliedFields: record.appliedFields, candidates: record.candidates, checkedAt: record.checkedAt.toISOString(),
      }] : [];
    }).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    return { count: items.length, items };
  }

  /** Escolha manual de um candidato: continua só preenchendo campos vazios. */
  async useCandidate(gameId: string, providerId: string): Promise<'OK' | 'GAME_NOT_FOUND' | 'CANDIDATE_NOT_FOUND'> {
    const game = await this.deps.games.find(gameId);
    if (!game) return 'GAME_NOT_FOUND';
    const record = await this.deps.store.get(gameId);
    const candidate = record?.candidates.find((item) => item.providerId === providerId);
    if (!record || !candidate) return 'CANDIDATE_NOT_FOUND';
    const appliedFields = await this.applyCandidate(game, candidate);
    await this.deps.store.upsert({ ...record, status: 'CONFIRMED', providerId, appliedFields, checkedAt: this.now() });
    return 'OK';
  }

  /** Busca outro título para o jogo e deixa os candidatos na revisão. */
  async searchAgain(gameId: string, query: string): Promise<'OK' | 'GAME_NOT_FOUND' | 'FAILED'> {
    const game = await this.deps.games.find(gameId);
    if (!game) return 'GAME_NOT_FOUND';
    try {
      const candidates = (await this.deps.provider.search(query.slice(0, 100))).slice(0, 10);
      await this.deps.store.upsert({
        gameId, status: candidates.length > 0 ? 'NEEDS_REVIEW' : 'NOT_FOUND', providerId: null, checkedTitle: game.title,
        checkedAt: this.now(), appliedFields: [], candidates,
      });
      return 'OK';
    } catch {
      return 'FAILED';
    }
  }

  private async mark(gameId: string, from: MetadataSyncRecord['status'][], status: MetadataSyncRecord['status']): Promise<boolean> {
    const record = await this.deps.store.get(gameId);
    if (!record || !from.includes(record.status)) return false;
    await this.deps.store.upsert({ ...record, status });
    return true;
  }

  ignore(gameId: string) { return this.mark(gameId, ['APPLIED_AUTO', 'NEEDS_REVIEW', 'NOT_FOUND', 'CONFIRMED'], 'IGNORED'); }
  confirm(gameId: string) { return this.mark(gameId, ['APPLIED_AUTO'], 'CONFIRMED'); }

  /** Desfaz o que a captura preencheu e devolve o jogo para a revisão com os candidatos. */
  async undo(gameId: string): Promise<boolean> {
    const record = await this.deps.store.get(gameId);
    const game = await this.deps.games.find(gameId);
    if (!record || !game || record.appliedFields.length === 0) return false;
    const reset: Record<string, unknown> = {};
    for (const field of record.appliedFields) reset[field] = field === 'genreIds' ? [] : null;
    for (const field of ['coverUrl', 'backgroundUrl'] as const) {
      const url = game[field];
      if (record.appliedFields.includes(field) && url?.startsWith('/media/')) await this.deps.images?.removeImage(url).catch(() => undefined);
    }
    await this.deps.games.update(gameId, reset as GameUpdate);
    await this.deps.store.upsert({ ...record, status: 'NEEDS_REVIEW', providerId: null, appliedFields: [] });
    return true;
  }
}
