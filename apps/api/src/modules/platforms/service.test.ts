import { describe, expect, it } from 'vitest';
import type { Platform } from '@gameshelf/contracts';
import { checkParent, checkRemovable, groupOf } from './service.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PC = id(1);
const STEAM = id(2);
const GOG = id(3);
const PS5 = id(4);

const catalog: Platform[] = [
  { id: PC, name: 'PC', parentId: null },
  { id: STEAM, name: 'Steam', parentId: PC },
  { id: GOG, name: 'GOG', parentId: PC },
  { id: PS5, name: 'PlayStation 5', parentId: null },
];
const at = (platformId: string) => catalog.find((item) => item.id === platformId)!;

describe('grupos de plataforma', () => {
  it('aceita colocar uma plataforma solta dentro de um grupo', () => {
    expect(checkParent({ id: PS5, name: 'PlayStation 5', parentId: null }, PC, catalog)).toBeUndefined();
  });

  it('aceita tirar a plataforma do grupo', () => {
    expect(checkParent(at(STEAM), null, catalog)).toBeUndefined();
  });

  it('recusa a plataforma como grupo de si mesma', () => {
    expect(checkParent(at(STEAM), STEAM, catalog)).toBeTypeOf('string');
  });

  it('recusa um terceiro nível: o grupo escolhido não pode ter grupo', () => {
    expect(checkParent(at(PS5), STEAM, catalog)).toContain('dois níveis');
  });

  it('recusa que um grupo com filhos vire subgrupo', () => {
    expect(checkParent(at(PC), PS5, catalog)).toContain('grupo de outras');
  });

  it('recusa um grupo que não existe no catálogo', () => {
    expect(checkParent(at(PS5), id(99), catalog)).toContain('não encontrado');
  });

  it('resolve o grupo de um subgrupo e de uma plataforma solta', () => {
    expect(groupOf(STEAM, catalog)?.name).toBe('PC');
    expect(groupOf(GOG, catalog)?.name).toBe('PC');
    expect(groupOf(PS5, catalog)?.name).toBe('PlayStation 5');
    expect(groupOf(PC, catalog)?.name).toBe('PC');
  });

  it('não resolve uma plataforma ausente do catálogo', () => {
    expect(groupOf(id(99), catalog)).toBeUndefined();
  });
});

describe('regras de exclusão de plataforma', () => {
  it('permite excluir uma plataforma sem filhos no catálogo', () => {
    expect(checkRemovable(at(STEAM), catalog)).toBeUndefined();
    expect(checkRemovable(at(PS5), catalog)).toBeUndefined();
  });

  it('recusa excluir um grupo que ainda é grupo de outras plataformas', () => {
    expect(checkRemovable(at(PC), catalog)).toContain('Mova');
    expect(checkRemovable(at(PC), catalog)).toContain('Steam');
  });

  it('nomeia todos os filhos na recusa de exclusão do grupo', () => {
    const problem = checkRemovable(at(PC), catalog);
    expect(problem).toContain('Steam');
    expect(problem).toContain('GOG');
  });

  it('permite excluir o grupo quando os filhos saem dele', () => {
    const withoutChildren = catalog.filter((item) => item.parentId !== PC);
    expect(checkRemovable(at(PC), withoutChildren)).toBeUndefined();
  });
});
