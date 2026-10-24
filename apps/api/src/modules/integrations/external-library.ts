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

/**
 * Conquista de um jogo na fonte. Diferente do tempo acumulado, `unlockedAt` é
 * um evento datado de verdade — mas ainda não é sessão: é um instante, não um
 * intervalo, e não diz por quanto tempo se jogou.
 */
export type ExternalAchievementEntry = {
  externalId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  points: number | null;
  rarityPercent: number | null;
  unlocked: boolean;
  unlockedAt: Date | null;
};

export interface ExternalLibraryProvider {
  /** Slug gravado em `game_platforms.external_source`. */
  readonly source: string;
  /**
   * Biblioteca completa da fonte. Não existe leitura de sessões porque a fonte
   * não registra sessão nenhuma: só tempo acumulado e última atividade.
   */
  fetchLibrary(): Promise<ExternalLibraryEntry[]>;
  /**
   * Conquistas de um jogo da fonte. Sob demanda, uma requisição por jogo: a
   * sincronização da biblioteca não as busca, senão seriam dezenas de
   * requisições por rodada para dados que quase nunca são olhados.
   */
  fetchAchievements(externalGameId: string): Promise<ExternalAchievementEntry[]>;
  /**
   * Verifica se a fonte responde e as credenciais autenticam, sem tocar na
   * biblioteca. Opcional: nem toda fonte sabe testar a própria conexão.
   */
  ping?(): Promise<{ accounts: number }>;
}
