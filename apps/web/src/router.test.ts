import { describe, expect, it } from 'vitest';
import { readRoute, routePath } from './router';

describe('readRoute', () => {
  it('traduz os caminhos das views', () => {
    expect(readRoute('/painel')).toEqual({ view: 'dashboard', gameId: null });
    expect(readRoute('/biblioteca')).toEqual({ view: 'library', gameId: null });
    expect(readRoute('/fila')).toEqual({ view: 'queue', gameId: null });
    expect(readRoute('/listas')).toEqual({ view: 'lists', gameId: null });
    expect(readRoute('/plataformas')).toEqual({ view: 'platforms', gameId: null });
    expect(readRoute('/estatisticas')).toEqual({ view: 'stats', gameId: null });
    expect(readRoute('/atividade')).toEqual({ view: 'timeline', gameId: null });
    expect(readRoute('/configuracoes')).toEqual({ view: 'settings', gameId: null });
  });

  it('lê o jogo do detalhe e decodifica o id', () => {
    expect(readRoute('/jogos/abc-123')).toEqual({ view: 'library', gameId: 'abc-123' });
    expect(readRoute('/jogos/a%20b')).toEqual({ view: 'library', gameId: 'a b' });
  });

  it('cai no painel para caminhos desconhecidos', () => {
    expect(readRoute('/')).toEqual({ view: 'dashboard', gameId: null });
    expect(readRoute('')).toEqual({ view: 'dashboard', gameId: null });
    expect(readRoute('/qualquer-coisa')).toEqual({ view: 'dashboard', gameId: null });
    expect(readRoute('/biblioteca/')).toEqual({ view: 'library', gameId: null });
  });
});

describe('routePath', () => {
  it('é o inverso de readRoute', () => {
    for (const path of ['/painel', '/biblioteca', '/fila', '/listas', '/plataformas', '/estatisticas', '/atividade', '/configuracoes']) {
      expect(routePath(readRoute(path))).toBe(path);
    }
  });

  it('escreve o caminho do detalhe com o id escapado', () => {
    expect(routePath({ view: 'library', gameId: 'a b' })).toBe('/jogos/a%20b');
    expect(readRoute(routePath({ view: 'library', gameId: 'a/b' }))).toEqual({ view: 'library', gameId: 'a/b' });
  });
});
