/**
 * Fronteira entre o GameShelf e uma fonte externa de dados de plataforma
 * (ADR-024). O vocabulário aqui é o do GameShelf: entradas de biblioteca com
 * plataforma, tempo acumulado e última atividade. Nenhum endpoint, cookie ou
 * formato da fonte aparece nesta interface.
 */
export type ExternalLibraryEntry = {
  /** Identificador estável na fonte. É a chave de idempotência da importação. */
  externalId: string;
  title: string;
  /** Nome de plataforma no vocabulário do GameShelf, já mapeado pela fonte. */
  platformName: string;
  accountLabel: string | null;
  /** `null` significa "a fonte não informa", nunca zero. */
  playtimeMinutes: number | null;
  lastPlayedAt: Date | null;
};

export interface ExternalLibraryProvider {
  /** Slug gravado em `game_platforms.external_source`. */
  readonly source: string;
  /**
   * Biblioteca completa da fonte. Não existe leitura de sessões porque a fonte
   * não registra sessão nenhuma: só tempo acumulado e última atividade.
   */
  fetchLibrary(): Promise<ExternalLibraryEntry[]>;
}
