/**
 * Navegação por URL (ADR-021). O app não usa roteador: este módulo é a única
 * fonte de verdade do mapeamento entre `location.pathname` e a tela atual.
 */

/** Views de topo do app. Cada uma tem um caminho estável e compartilhável. */
export type AppView = 'library' | 'queue' | 'lists' | 'platforms' | 'dashboard' | 'stats' | 'timeline' | 'settings';

export type AppRoute = {
  view: AppView;
  /** Jogo aberto no detalhe (`/jogos/:id`), quando houver. */
  gameId: string | null;
};

const viewPaths: Record<AppView, string> = {
  dashboard: '/painel',
  library: '/biblioteca',
  queue: '/fila',
  lists: '/listas',
  platforms: '/plataformas',
  stats: '/estatisticas',
  timeline: '/atividade',
  settings: '/configuracoes',
};

const pathViews = new Map(Object.entries(viewPaths).map(([view, path]) => [path, view as AppView]));

/**
 * Lê a rota de um caminho. Caminhos desconhecidos — inclusive `/`, a entrada do
 * PWA instalado — caem no painel em vez de mostrar erro.
 */
export function readRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '');
  const game = /^\/jogos\/(.+)$/.exec(path);
  if (game) return { view: 'library', gameId: decodeURIComponent(game[1]) };
  return { view: pathViews.get(path) ?? 'dashboard', gameId: null };
}

/** Caminho canônico de uma rota. */
export function routePath(route: AppRoute): string {
  return route.gameId ? `/jogos/${encodeURIComponent(route.gameId)}` : viewPaths[route.view];
}
