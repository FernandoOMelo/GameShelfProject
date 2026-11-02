/**
 * Catálogo de plataformas com a identidade visual oficial: cada entrada traz a
 * chave estável (catalogKey), a chave do ícone (iconKey, resolvida no frontend)
 * e a cor da marca. Ao cadastrar uma plataforma pelo nome, o sistema reconhece a
 * entrada e já grava essas informações. Plataformas fora do catálogo recebem null
 * e usam o ícone genérico, ou o ícone e a cor escolhidos pelo usuário.
 */
export type PlatformCatalogEntry = { name: string; catalogKey: string; iconKey: string; color: string };

const catalog: PlatformCatalogEntry[] = [
  { name: 'PlayStation', catalogKey: 'playstation', iconKey: 'playstation', color: '#0070D1' },
  { name: 'PlayStation 5', catalogKey: 'ps5', iconKey: 'playstation', color: '#0070D1' },
  { name: 'PlayStation 4', catalogKey: 'ps4', iconKey: 'playstation', color: '#0070D1' },
  { name: 'PlayStation 3', catalogKey: 'ps3', iconKey: 'playstation', color: '#0070D1' },
  { name: 'PlayStation 2', catalogKey: 'ps2', iconKey: 'playstation', color: '#0070D1' },
  { name: 'PS Vita', catalogKey: 'ps-vita', iconKey: 'playstation', color: '#0070D1' },
  { name: 'Xbox', catalogKey: 'xbox', iconKey: 'xbox', color: '#107C10' },
  { name: 'Xbox Series', catalogKey: 'xbox-series', iconKey: 'xbox', color: '#107C10' },
  { name: 'Xbox One', catalogKey: 'xbox-one', iconKey: 'xbox', color: '#107C10' },
  { name: 'Nintendo', catalogKey: 'nintendo', iconKey: 'nintendo', color: '#E60012' },
  { name: 'Nintendo Switch', catalogKey: 'switch', iconKey: 'nintendo', color: '#E60012' },
  { name: 'PC', catalogKey: 'pc', iconKey: 'pc', color: '#5B6573' },
  { name: 'Steam', catalogKey: 'steam', iconKey: 'steam', color: '#2A6FA8' },
  { name: 'Epic Games', catalogKey: 'epic', iconKey: 'epic', color: '#313131' },
  { name: 'GOG', catalogKey: 'gog', iconKey: 'gog', color: '#86328A' },
  { name: 'Rockstar', catalogKey: 'rockstar', iconKey: 'rockstar', color: '#F08A00' },
  { name: 'Google Play Games', catalogKey: 'google-play', iconKey: 'google-play', color: '#01875F' },
  { name: 'EA App', catalogKey: 'ea', iconKey: 'ea', color: '#FF4747' },
  { name: 'Ubisoft Connect', catalogKey: 'ubisoft', iconKey: 'ubisoft', color: '#0070FF' },
  { name: 'Battle.net', catalogKey: 'battlenet', iconKey: 'battlenet', color: '#00AEFF' },
  { name: 'Microsoft Store', catalogKey: 'microsoft-store', iconKey: 'pc', color: '#5B6573' },
  { name: 'RetroAchievements', catalogKey: 'retroachievements', iconKey: 'retro', color: '#C69A00' },
  { name: 'Mobile', catalogKey: 'mobile', iconKey: 'mobile', color: '#3DDC84' },
];

// Nomes alternativos que as fontes externas costumam usar.
const aliases: Record<string, string> = {
  'ps5': 'playstation 5', 'ps4': 'playstation 4', 'ps3': 'playstation 3', 'ps2': 'playstation 2',
  'rockstar games': 'rockstar', 'rockstar games launcher': 'rockstar', 'google play': 'google play games',
  'xbox series x|s': 'xbox series', 'xbox series x': 'xbox series', 'ea': 'ea app', 'origin': 'ea app',
  'uplay': 'ubisoft connect', 'ubisoft': 'ubisoft connect', 'battle net': 'battle.net', 'epic': 'epic games',
};

const normalize = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function platformCatalog(): PlatformCatalogEntry[] {
  return catalog.map((entry) => ({ ...entry }));
}

export function platformPresentation(name: string): { catalogKey: string | null; iconKey: string | null; color: string | null } {
  const key = normalize(name);
  const target = aliases[key] ?? key;
  const entry = catalog.find((item) => normalize(item.name) === target);
  return entry ? { catalogKey: entry.catalogKey, iconKey: entry.iconKey, color: entry.color } : { catalogKey: null, iconKey: null, color: null };
}

/** Cor padrão de um ícone do catálogo, usada quando o usuário escolhe só o ícone. */
export function defaultColorForIcon(iconKey: string): string | null {
  return catalog.find((item) => item.iconKey === iconKey)?.color ?? null;
}
