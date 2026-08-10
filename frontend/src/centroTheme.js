// ============================================================
// Identidad visual por centro de salud.
// Cada sede tiene su propia paleta; la interfaz clínica (médicos,
// farmacia) se teñe con estas variables CSS según el centro activo.
// ============================================================

export const CENTRO_THEMES = {
  'CLN-NINO': {
    nombre: 'Clínica del Niño',
    tipo: 'Especializada · Pediatría',
    parroquia: 'El Carmen',
    lema: 'Cuidar la infancia es sembrar salud',
    logo: '/identidad visual/CliNiño.jpeg',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #06b6d4 50%, #0e7490 100%)',
    shadow: 'rgba(6, 182, 212, 0.5)',
    accent: '#0891b2',
    accentDark: '#0e7490',
    accentLight: '#38bdf8',
    soft: '#cffafe',
    softLow: '#ecfeff',
    primary: '#164e63',
    primaryDark: '#0c3a4a',
    primaryLight: '#1a6a80',
    surface: '#f5fcfe',
    container: '#dff3fa',
    containerLow: '#eaf8fc',
    containerHigh: '#d0ecf6',
    onSurfaceVariant: '#3f4a4f',
    outline: '#6f7a80',
    outlineVariant: '#bfc9cf',
  },
  'CLN-CITAB': {
    nombre: 'Clínica de los Trabajadores',
    tipo: 'Aliado · Medicina laboral',
    parroquia: 'El Carmen',
    lema: 'Salud para quienes construyen la ciudad',
    logo: '/identidad visual/Citab.jpeg',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
    shadow: 'rgba(29, 78, 216, 0.5)',
    accent: '#1d4ed8',
    accentDark: '#1e3a8a',
    accentLight: '#60a5fa',
    soft: '#dbeafe',
    softLow: '#eff6ff',
    primary: '#1e3a8a',
    primaryDark: '#172e6e',
    primaryLight: '#2b52c0',
    surface: '#f6f9ff',
    container: '#e0eaff',
    containerLow: '#eef4ff',
    containerHigh: '#d5e2fd',
    onSurfaceVariant: '#41464f',
    outline: '#727887',
    outlineVariant: '#c3c8d6',
  },
  'CLN-MUJER': {
    nombre: 'Clínica de la Mujer',
    tipo: 'Especializada · Ginecología',
    parroquia: 'San Cristóbal',
    lema: 'Atención integral de la mujer',
    logo: '/identidad visual/CliMujer.jpeg',
    gradient: 'linear-gradient(135deg, #f0abfc 0%, #c026d3 50%, #86198f 100%)',
    shadow: 'rgba(192, 38, 211, 0.5)',
    accent: '#c026d3',
    accentDark: '#86198f',
    accentLight: '#f0abfc',
    soft: '#fae8ff',
    softLow: '#fdf4ff',
    primary: '#701a75',
    primaryDark: '#4a0e4f',
    primaryLight: '#a21caf',
    surface: '#fdf8fe',
    container: '#f3d9f8',
    containerLow: '#f9ecfb',
    containerHigh: '#ebcaf2',
    onSurfaceVariant: '#4b4450',
    outline: '#7c7280',
    outlineVariant: '#ccc2d0',
  },
  'CLN-ONCO': {
    nombre: 'Centro Oncológico Municipal',
    tipo: 'Especializado · Oncología',
    parroquia: 'El Carmen',
    lema: 'Cuidar la vida con ciencia y calidez',
    logo: '/identidad visual/Oncologico.jpeg',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #3b0764 100%)',
    shadow: 'rgba(109, 40, 217, 0.5)',
    accent: '#6d28d9',
    accentDark: '#4c1d95',
    accentLight: '#8b5cf6',
    soft: '#ede9fe',
    softLow: '#f6f3ff',
    primary: '#4c1d95',
    primaryDark: '#30106a',
    primaryLight: '#5b21b6',
    surface: '#faf8ff',
    container: '#e9e3fb',
    containerLow: '#f2eefd',
    containerHigh: '#ddcff8',
    onSurfaceVariant: '#46424f',
    outline: '#756f80',
    outlineVariant: '#c5bfd1',
  },
  'CLN-JORNADAS': {
    nombre: 'Jornadas de Salud Móviles',
    tipo: 'Comunitario · Itinerante',
    parroquia: 'General',
    lema: 'La salud llega a tu comunidad',
    logo: '/identidad visual/JornadasSaludBna.jpeg',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 50%, #134e4a 100%)',
    shadow: 'rgba(13, 148, 136, 0.5)',
    accent: '#0d9488',
    accentDark: '#0f766e',
    accentLight: '#2dd4bf',
    soft: '#ccfbf1',
    softLow: '#f0fdfa',
    primary: '#134e4a',
    primaryDark: '#0c3734',
    primaryLight: '#17635d',
    surface: '#f4fcfb',
    container: '#d3f3ee',
    containerLow: '#e9f9f6',
    containerHigh: '#c2ece5',
    onSurfaceVariant: '#3f4b49',
    outline: '#6f7c79',
    outlineVariant: '#bfcdca',
  },
};

const FALLBACK = {
  nombre: 'Centro de Salud',
  tipo: 'Red municipal',
  parroquia: 'S. Bolívar',
  lema: 'Salud para la comunidad',
  logo: '/identidad visual/SBna.jpeg',
  gradient: 'linear-gradient(135deg, #00677d 0%, #008ba3 50%, #0f2537 100%)',
  shadow: 'rgba(0, 103, 125, 0.5)',
  accent: '#00677d',
  accentDark: '#004e5f',
  accentLight: '#008ba3',
  soft: '#c8ecf5',
  softLow: '#eef8fb',
  primary: '#0f2537',
  primaryDark: '#061525',
  primaryLight: '#1a3a52',
  surface: '#f8f9ff',
  container: '#e5eeff',
  containerLow: '#eff4ff',
  containerHigh: '#dce9ff',
  onSurfaceVariant: '#43474c',
  outline: '#74777d',
  outlineVariant: '#c3c7cd',
};

function sombrear(hex, factor) {
  const val = String(hex || '').replace('#', '');
  if (val.length !== 3 && val.length !== 6) return hex;
  const completo = val.length === 3 ? val.split('').map((x) => x + x).join('') : val;
  const num = parseInt(completo, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.min(255, Math.round(((num >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((num >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((num & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function getCentroTheme(c = {}) {
  if (c.codigo && CENTRO_THEMES[c.codigo]) {
    return CENTRO_THEMES[c.codigo];
  }
  const name = (c.nombre || '').toLowerCase();
  if (name.includes('niño') || name.includes('nino')) return CENTRO_THEMES['CLN-NINO'];
  if (name.includes('trabajador') || name.includes('citab')) return CENTRO_THEMES['CLN-CITAB'];
  if (name.includes('mujer')) return CENTRO_THEMES['CLN-MUJER'];
  if (name.includes('oncológico') || name.includes('oncologico')) return CENTRO_THEMES['CLN-ONCO'];
  if (name.includes('jornada')) return CENTRO_THEMES['CLN-JORNADAS'];

  const base = c.fondoColor || FALLBACK.accent;
  return {
    ...FALLBACK,
    accent: base,
    accentDark: sombrear(base, 0.72),
    accentLight: sombrear(base, 1.22),
    gradient: `linear-gradient(135deg, ${sombrear(base, 1.15)} 0%, ${base} 50%, ${sombrear(base, 0.55)} 100%)`,
    shadow: 'rgba(0, 0, 0, 0.4)',
  };
}
