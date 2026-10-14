/**
 * Health Centers Theme Configuration
 * BnaSalud - Red de Salud del Municipio Simón Bolívar
 *
 * Cada centro tiene su propia identidad visual con colores, tipografía y logo.
 * El ThemeProvider aplica estas variables CSS dinámicamente según el centro activo.
 */

export const HEALTH_CENTERS_THEME = {
  // ─── General (vista global para admin/director) ───
  general: {
    id: 'general',
    code: 'general',
    name: 'Red de Salud',
    fullName: 'Red de Salud del Municipio Simón Bolívar',
    tagline: 'Integrando centros de salud de calidad',
    logo: '/identidad/InstitutoSalud.jpeg',
    colors: {
      primary: '#1A4B7C',
      secondary: '#3B98D4',
      accent: '#38B000',
      danger: '#D90429',
      bg: '#FFFFFF',
      surface: '#F8FAFC',
      border: '#E2E8F0',
      text: '#0F172A',
      textMuted: '#64748B',
    },
    gradient: {
      from: '#1A4B7C',
      via: '#2563EB',
      to: '#3B98D4',
    },
    fonts: {
      heading: 'Sora',
      body: 'Manrope',
    },
  },

  // ─── CITAB ───
  citab: {
    id: 'citab',
    code: 'CITAB',
    name: 'CITAB',
    fullName: 'Clínica Integral de Trabajadores de la Alcaldía de Barcelona',
    tagline: 'Atención médica integral con tecnología de vanguardia',
    logo: '/identidad/Citab.jpeg',
    colors: {
      primary: '#006680',
      secondary: '#0093A8',
      accent: '#10B981',
      danger: '#DC2626',
      bg: '#FFFFFF',
      surface: '#F0F9FA',
      border: '#BCE3EB',
      text: '#003B4A',
      textMuted: '#5A7D8A',
    },
    gradient: {
      from: '#003B4A',
      via: '#006680',
      to: '#0093A8',
    },
    fonts: {
      heading: 'Sora',
      body: 'Manrope',
    },
  },

  // ─── Clínica de la Mujer ───
  clinica_mujer: {
    id: 'clinica_mujer',
    code: 'CMUJER',
    name: 'Clínica de la Mujer',
    fullName: 'Clínica Integral para la Mujer - Ciudad de Barcelona',
    tagline: 'Cuidando la salud de la mujer con calidez y excelencia',
    logo: '/identidad/CliMujer.jpeg',
    colors: {
      primary: '#9D174D',
      secondary: '#EC4899',
      accent: '#F472B6',
      danger: '#BE123C',
      bg: '#FFFBFC',
      surface: '#FDF2F8',
      border: '#FBCFE8',
      text: '#831843',
      textMuted: '#9D6B84',
    },
    gradient: {
      from: '#831843',
      via: '#9D174D',
      to: '#EC4899',
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Manrope',
    },
  },

  // ─── Clínica del Niño ───
  clinica_ninos: {
    id: 'clinica_ninos',
    code: 'CNINOS',
    name: 'Clínica del Niño',
    fullName: 'Clínica Integral de los Niños - Ciudad de Barcelona',
    tagline: 'Protegiendo la salud de los más pequeños',
    logo: '/identidad/CliNiño.jpeg',
    colors: {
      primary: '#EA580C',
      secondary: '#F59E0B',
      accent: '#22C55E',
      danger: '#DC2626',
      bg: '#FFFEFB',
      surface: '#FFF7ED',
      border: '#FED7AA',
      text: '#7C2D12',
      textMuted: '#9A6B4D',
    },
    gradient: {
      from: '#7C2D12',
      via: '#EA580C',
      to: '#F59E0B',
    },
    fonts: {
      heading: 'Nunito',
      body: 'Manrope',
    },
  },

  // ─── CAPJPF ───
  capjpf: {
    id: 'capjpf',
    code: 'CAPJPF',
    name: 'CAPJPF',
    fullName: 'Clínica Municipal CAP José Pérez Fernández',
    tagline: 'Servicio público de salud con vocación comunitaria',
    logo: '/identidad/ClinicaMunicipalJosePerezFernandez.jpeg',
    colors: {
      primary: '#1D4ED8',
      secondary: '#3B82F6',
      accent: '#10B981',
      danger: '#DC2626',
      bg: '#FFFFFF',
      surface: '#EFF6FF',
      border: '#BFDBFE',
      text: '#1E3A5F',
      textMuted: '#4B6A94',
    },
    gradient: {
      from: '#1E3A5F',
      via: '#1D4ED8',
      to: '#3B82F6',
    },
    fonts: {
      heading: 'DM Sans',
      body: 'Manrope',
    },
  },

  // ─── Casa del Adulto Mayor ───
  adulto_mayor: {
    id: 'adulto_mayor',
    code: 'CAMAYOR',
    name: 'Adulto Mayor',
    fullName: 'Casa del Adulto Mayor - Fundación Casa del Abuelo',
    tagline: 'Dignidad y cuidado integral para nuestra tercera edad',
    logo: '/identidad/CasaAbuelo.jpeg',
    colors: {
      primary: '#7C3AED',
      secondary: '#A78BFA',
      accent: '#F59E0B',
      danger: '#DC2626',
      bg: '#FEFBFF',
      surface: '#F5F3FF',
      border: '#DDD6FE',
      text: '#3B0764',
      textMuted: '#6B5B8A',
    },
    gradient: {
      from: '#3B0764',
      via: '#7C3AED',
      to: '#A78BFA',
    },
    fonts: {
      heading: 'Lora',
      body: 'Manrope',
    },
  },

  // ─── Oncológico Maruja Clavier ───
  oncologico: {
    id: 'oncologico',
    code: 'OMARUJA',
    name: 'Oncológico',
    fullName: 'Oncológico Maruja Clavier',
    tagline: 'Esperanza y tratamiento oncológico de excelencia',
    logo: '/identidad/Oncologico.jpeg',
    colors: {
      primary: '#0891B2',
      secondary: '#06B6D4',
      accent: '#F472B6',
      danger: '#DC2626',
      bg: '#FEFFFF',
      surface: '#ECFEFF',
      border: '#A5F3FC',
      text: '#164E63',
      textMuted: '#4B7A8D',
    },
    gradient: {
      from: '#164E63',
      via: '#0891B2',
      to: '#06B6D4',
    },
    fonts: {
      heading: 'Outfit',
      body: 'Manrope',
    },
  },
};

/**
 * Mapa de centro_code (de la BD) → theme key
 * La BD usa 'CITAB', 'CMUJER', etc. Este mapa las conecta con los themes.
 */
export const CENTER_CODE_TO_THEME = {
  CITAB: 'citab',
  CMUJER: 'clinica_mujer',
  CNINOS: 'clinica_ninos',
  CAPJPF: 'capjpf',
  CAMAYOR: 'adulto_mayor',
  OMARUJA: 'oncologico',
  general: 'general',
};

/**
 * Mapa de centro_id (numérico de la BD) → theme key
 */
export const CENTER_ID_TO_THEME = {
  13: 'citab',
  14: 'clinica_mujer',
  15: 'clinica_ninos',
  16: 'capjpf',
  17: 'adulto_mayor',
  18: 'oncologico',
};

/**
 * Obtiene el tema de un centro por su código o ID.
 * @param {string|number|null} identifier - Código (CITAB) o ID numérico (13)
 * @returns {object} Theme configuration
 */
export function getThemeForCenter(identifier) {
  if (!identifier) return HEALTH_CENTERS_THEME.general;

  // Si es número, usar CENTER_ID_TO_THEME
  if (typeof identifier === 'number' || /^\d+$/.test(String(identifier))) {
    const key = CENTER_ID_TO_THEME[Number(identifier)];
    return key ? HEALTH_CENTERS_THEME[key] : HEALTH_CENTERS_THEME.general;
  }

  // Si es string, intentar CENTER_CODE_TO_THEME primero
  const upper = String(identifier).toUpperCase();
  const key = CENTER_CODE_TO_THEME[upper];
  if (key) return HEALTH_CENTERS_THEME[key];

  // Buscar por nombre exacto
  const found = Object.values(HEALTH_CENTERS_THEME).find(
    (t) => t.code?.toUpperCase() === upper || t.id === identifier
  );
  return found || HEALTH_CENTERS_THEME.general;
}

/**
 * Aplica las variables CSS del tema al DOM.
 * @param {object} theme - Theme configuration object
 */
export function applyThemeToDOM(theme) {
  if (!theme?.colors) return;
  const root = document.documentElement;
  const { colors, gradient, fonts } = theme;

  // Colores principales
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-danger', colors.danger);
  root.style.setProperty('--color-bg', colors.bg);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-muted', colors.textMuted);

  // Gradiente del header
  if (gradient) {
    root.style.setProperty('--gradient-from', gradient.from);
    root.style.setProperty('--gradient-via', gradient.via);
    root.style.setProperty('--gradient-to', gradient.to);
  }

  // Tipografía
  if (fonts) {
    root.style.setProperty('--font-heading', fonts.heading);
    root.style.setProperty('--font-body', fonts.body);
  }

  // Compatibilidad con sistema anterior
  root.style.setProperty('--brand-primary', colors.primary);
  root.style.setProperty('--brand-secondary', colors.secondary);
  root.style.setProperty('--brand-accent', colors.accent);
  root.style.setProperty('--brand-surface', colors.surface);
}

/**
 * Limpia las variables CSS del tema (reset al default).
 */
export function resetThemeDOM() {
  applyThemeToDOM(HEALTH_CENTERS_THEME.general);
}
