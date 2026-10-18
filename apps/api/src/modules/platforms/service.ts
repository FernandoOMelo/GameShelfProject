import type { Platform } from '@gameshelf/contracts';

/**
 * Regras do catálogo em dois níveis (ADR-025).
 *
 * Um grupo é uma plataforma sem pai (PC, PlayStation); um subgrupo é uma loja ou
 * variante dentro dele (Steam, GOG). Só dois níveis: isso mantém a agregação das
 * estatísticas previsível, sem precisar percorrer uma árvore de profundidade
 * desconhecida, e corresponde ao que o domínio realmente tem.
 */
export function checkParent(
  platform: Platform,
  parentId: string | null,
  catalog: Platform[],
): string | undefined {
  if (parentId === null) return undefined;
  if (parentId === platform.id) return 'Uma plataforma não pode ser o próprio grupo.';

  const parent = catalog.find((item) => item.id === parentId);
  if (!parent) return 'Grupo não encontrado.';
  if (parent.parentId !== null) return 'O grupo escolhido já pertence a outro grupo: o catálogo tem apenas dois níveis.';

  // Quem já é grupo de alguém não pode virar subgrupo, senão apareceria um terceiro nível.
  if (catalog.some((item) => item.parentId === platform.id)) {
    return 'Esta plataforma já é o grupo de outras e não pode entrar em um grupo.';
  }
  return undefined;
}

/** O grupo ao qual a plataforma pertence: ela mesma, quando não tem pai. */
export function groupOf(platformId: string, catalog: Platform[]): Platform | undefined {
  const platform = catalog.find((item) => item.id === platformId);
  if (!platform) return undefined;
  return platform.parentId ? catalog.find((item) => item.id === platform.parentId) ?? platform : platform;
}
