export const CENTRO_THEMES = {
  'CLN-NINO': {
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #06b6d4 50%, #0891b2 100%)',
    shadow: 'rgba(6, 182, 212, 0.5)',
  },
  'CLN-CITAB': {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
    shadow: 'rgba(29, 78, 216, 0.5)',
  },
  'CLN-MUJER': {
    gradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 50%, #4c1d95 100%)',
    shadow: 'rgba(107, 33, 168, 0.5)',
  },
  'CLN-ONCO': {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #581c87 100%)',
    shadow: 'rgba(124, 58, 237, 0.5)',
  },
  'CLN-JORNADAS': {
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 50%, #115e59 100%)',
    shadow: 'rgba(13, 148, 136, 0.5)',
  },
};

export function getCentroTheme(c) {
  if (c.codigo && CENTRO_THEMES[c.codigo]) {
    return CENTRO_THEMES[c.codigo];
  }
  const name = (c.nombre || '').toLowerCase();
  if (name.includes('niño') || name.includes('nino')) return CENTRO_THEMES['CLN-NINO'];
  if (name.includes('trabajador') || name.includes('citab')) return CENTRO_THEMES['CLN-CITAB'];
  if (name.includes('mujer')) return CENTRO_THEMES['CLN-MUJER'];
  if (name.includes('oncológico') || name.includes('oncologico')) return CENTRO_THEMES['CLN-ONCO'];
  if (name.includes('jornada')) return CENTRO_THEMES['CLN-JORNADAS'];

  const base = c.fondoColor || '#00677d';
  return {
    gradient: `linear-gradient(135deg, ${base} 0%, ${base}e6 50%, #0f172a 100%)`,
    shadow: 'rgba(0, 0, 0, 0.4)',
  };
}
