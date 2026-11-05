import { describe, expect, it } from 'vitest';
import type { GameMetadataCandidate } from '@gameshelf/contracts';
import { normalizeTitle, pickMatch } from './match.js';

const candidate = (providerId: string, title: string, releaseYear?: number): GameMetadataCandidate => ({ providerId, title, releaseYear: releaseYear ?? null });

describe('normalizeTitle', () => {
  it('ignora caixa, acentos, símbolos e pontuação', () => {
    expect(normalizeTitle('Pokémon™: Red & Blue')).toBe('pokemon red and blue');
    expect(normalizeTitle('  HADES  ')).toBe('hades');
    expect(normalizeTitle('Marvel’s Spider-Man®')).toBe(normalizeTitle('marvels spider man'));
  });
});

describe('pickMatch', () => {
  it('aplica quando um único candidato tem o mesmo título', () => {
    const outcome = pickMatch({ title: 'hades', releaseYear: null }, [candidate('1', 'Hades'), candidate('2', 'Hades II')]);
    expect(outcome).toMatchObject({ kind: 'MATCH', candidate: { providerId: '1' } });
  });
  it('manda para revisão quando só há títulos parecidos', () => {
    expect(pickMatch({ title: 'Hades', releaseYear: null }, [candidate('2', 'Hades II')]).kind).toBe('REVIEW');
  });
  it('manda para revisão quando vários candidatos têm o mesmo título', () => {
    expect(pickMatch({ title: 'Resident Evil 2', releaseYear: null }, [candidate('1', 'Resident Evil 2', 1998), candidate('2', 'Resident Evil 2', 2019)]).kind).toBe('REVIEW');
  });
  it('usa o ano do jogo para desempatar e para recusar', () => {
    const list = [candidate('1', 'Resident Evil 2', 1998), candidate('2', 'Resident Evil 2', 2019)];
    expect(pickMatch({ title: 'Resident Evil 2', releaseYear: 2019 }, list)).toMatchObject({ kind: 'MATCH', candidate: { providerId: '2' } });
    expect(pickMatch({ title: 'Resident Evil 2', releaseYear: 2000 }, list).kind).toBe('REVIEW');
  });
  it('não encontra nada sem candidatos', () => {
    expect(pickMatch({ title: 'Xyzzy', releaseYear: null }, [])).toEqual({ kind: 'NONE' });
  });
});
