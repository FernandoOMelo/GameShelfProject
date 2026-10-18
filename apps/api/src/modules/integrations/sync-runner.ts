import type { ExternalSyncState } from '@gameshelf/contracts';
import { importExternalLibrary, type ImportDependencies } from './import-service.js';

/**
 * Serializa a sincronização manual: uma rodada por vez (ADR-024). O estado vive
 * no processo da API, não no banco — é o estado da rodada atual e o resultado
 * da última, não histórico. Reiniciar a API volta para `idle` sem perder nada
 * importado, porque o resultado da importação está nas associações.
 */
export class ExternalSyncRunner {
  private startedAt: Date | null = null;
  private finishedAt: Date | null = null;
  private summary: ExternalSyncState['summary'] = null;
  private error: string | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly deps: ImportDependencies,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  get source(): string {
    return this.deps.provider.source;
  }

  isRunning(): boolean {
    return this.inFlight !== null;
  }

  snapshot(): ExternalSyncState {
    return {
      source: this.source,
      status: this.inFlight ? 'running' : this.error ? 'failed' : this.summary ? 'succeeded' : 'idle',
      startedAt: this.startedAt?.toISOString() ?? null,
      finishedAt: this.finishedAt?.toISOString() ?? null,
      summary: this.summary,
      error: this.error,
    };
  }

  /** Dispara a rodada. `false` quando já existe uma em andamento. */
  start(): boolean {
    if (this.inFlight) return false;
    this.startedAt = this.clock();
    this.finishedAt = null;
    this.summary = null;
    this.error = null;
    this.inFlight = this.run();
    return true;
  }

  /** Resolve quando não há rodada em andamento. */
  async settled(): Promise<void> {
    await this.inFlight;
  }

  private async run(): Promise<void> {
    try {
      this.summary = await importExternalLibrary(this.deps, this.startedAt ?? this.clock());
    } catch (error) {
      // A fonte indisponível é um resultado possível desta rodada, não uma
      // falha da aplicação: a biblioteca e as sessões seguem funcionando.
      this.error = error instanceof Error ? error.message : 'Não foi possível falar com a fonte externa.';
    } finally {
      this.finishedAt = this.clock();
      this.inFlight = null;
    }
  }
}
