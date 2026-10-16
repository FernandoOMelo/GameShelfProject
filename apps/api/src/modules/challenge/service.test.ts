import { describe, expect, it } from 'vitest';
import { detectChallengeCompletion } from './service.js';

const challenge = { title: 'Zerar todos os FF7', listId: 'list-1' };

type GameState = { status: string; completedAt: string | null };

function gamesMap(entries: Array<[string, GameState]>) {
  return new Map<string, GameState>(entries);
}

const completed = (completedAt: string): GameState => ({ status: 'COMPLETED', completedAt });

describe('detectChallengeCompletion', () => {
  it('reports the completion dated by the last game finished', () => {
    const games = gamesMap([
      ['a', completed('2026-02-01')],
      ['b', completed('2026-10-07')],
      ['c', completed('2026-05-20')],
    ]);
    expect(detectChallengeCompletion(challenge, ['a', 'b', 'c'], games)).toEqual({
      title: 'Zerar todos os FF7', listId: 'list-1', gamesCount: 3, completedAt: new Date('2026-10-07T00:00:00.000Z'),
    });
  });

  it('returns null while any game is unfinished', () => {
    const games = gamesMap([['a', completed('2026-02-01')], ['b', { status: 'PLAYING', completedAt: null }]]);
    expect(detectChallengeCompletion(challenge, ['a', 'b'], games)).toBeNull();
  });

  it('returns null when a finished game has no completion date', () => {
    expect(detectChallengeCompletion(challenge, ['a'], gamesMap([['a', { status: 'COMPLETED', completedAt: null }]]))).toBeNull();
  });

  it('returns null when a game in the list is missing', () => {
    expect(detectChallengeCompletion(challenge, ['a'], gamesMap([]))).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(detectChallengeCompletion(challenge, [], gamesMap([]))).toBeNull();
  });
});
