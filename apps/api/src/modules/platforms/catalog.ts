/**
 * Mapeamento de nomes de plataforma para chaves estáveis do catálogo.
 * As chaves viram classes/labels na UI sem depender de SVGs ou marcas de
 * terceiros. Plataformas fora desta tabela recebem null e usam fallback textual.
 */
const entries: Record<string, { catalogKey: string; iconKey: string }> = {
  'playstation':      { catalogKey: 'playstation',       iconKey: 'playstation' },
  'playstation 5':    { catalogKey: 'ps5',               iconKey: 'playstation' },
  'playstation 4':    { catalogKey: 'ps4',               iconKey: 'playstation' },
  'playstation 3':    { catalogKey: 'ps3',               iconKey: 'playstation' },
  'playstation 2':    { catalogKey: 'ps2',               iconKey: 'playstation' },
  'ps vita':          { catalogKey: 'ps-vita',           iconKey: 'playstation' },
  'xbox':             { catalogKey: 'xbox',              iconKey: 'xbox' },
  'xbox series':      { catalogKey: 'xbox-series',       iconKey: 'xbox' },
  'xbox one':         { catalogKey: 'xbox-one',          iconKey: 'xbox' },
  'nintendo switch':  { catalogKey: 'switch',            iconKey: 'nintendo' },
  'nintendo':         { catalogKey: 'nintendo',          iconKey: 'nintendo' },
  'pc':               { catalogKey: 'pc',                iconKey: 'pc' },
  'steam':            { catalogKey: 'steam',             iconKey: 'steam' },
  'epic games':       { catalogKey: 'epic',              iconKey: 'epic' },
  'gog':              { catalogKey: 'gog',               iconKey: 'gog' },
  'microsoft store':  { catalogKey: 'microsoft-store',  iconKey: 'pc' },
  'retroachievements':{ catalogKey: 'retroachievements', iconKey: 'retro' },
  'mobile':           { catalogKey: 'mobile',            iconKey: 'mobile' },
};

export function platformPresentation(name: string): { catalogKey: string | null; iconKey: string | null } {
  return entries[name.trim().toLocaleLowerCase('pt-BR')] ?? { catalogKey: null, iconKey: null };
}
