/**
 * Specialties Configuration — BnaSalud
 *
 * Mapa de especialidades médicas → iconos Lucide + colores distintivos.
 * Cada especialidad tiene un icono recognizable y un color que la identifica
 * visualmente en la interfaz (badges, headers, tarjetas de doctor).
 */

export const SPECIALTIES = {
  'Medicina General': {
    icon: 'Stethoscope',
    color: '#3B98D4',
    bgColor: '#EFF6FF',
    ringColor: '#93C5FD',
    label: 'Medicina General',
    shortLabel: 'M. General',
  },
  'Medicina Interna': {
    icon: 'HeartPulse',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    ringColor: '#FCA5A5',
    label: 'Medicina Interna',
    shortLabel: 'M. Interna',
  },
  'Pediatría': {
    icon: 'Baby',
    color: '#EA580C',
    bgColor: '#FFF7ED',
    ringColor: '#FDBA74',
    label: 'Pediatría',
    shortLabel: 'Pediatría',
  },
  'Ginecología': {
    icon: 'Heart',
    color: '#9D174D',
    bgColor: '#FDF2F8',
    ringColor: '#F9A8D4',
    label: 'Ginecología',
    shortLabel: 'Gineco.',
  },
  'Cardiología': {
    icon: 'HeartCrack',
    color: '#E11D48',
    bgColor: '#FFF1F2',
    ringColor: '#FDA4AF',
    label: 'Cardiología',
    shortLabel: 'Cardio.',
  },
  'Cirugía General': {
    icon: 'Scissors',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    ringColor: '#C4B5FD',
    label: 'Cirugía General',
    shortLabel: 'Cirugía',
  },
  'Cirugía de Mano': {
    icon: 'Hand',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    ringColor: '#C4B5FD',
    label: 'Cirugía de Mano',
    shortLabel: 'C. Mano',
  },
  'Ecografía': {
    icon: 'Scan',
    color: '#0891B2',
    bgColor: '#ECFEFF',
    ringColor: '#67E8F9',
    label: 'Ecografía',
    shortLabel: 'Ecografía',
  },
  'Enfermería': {
    icon: 'Cross',
    color: '#059669',
    bgColor: '#ECFDF5',
    ringColor: '#6EE7B7',
    label: 'Enfermería',
    shortLabel: 'Enferm.',
  },
  'Epidemiología': {
    icon: 'Bug',
    color: '#D97706',
    bgColor: '#FFFBEB',
    ringColor: '#FCD34D',
    label: 'Epidemiología',
    shortLabel: 'Epidem.',
  },
  'Farmacia': {
    icon: 'Pill',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    ringColor: '#86EFAC',
    label: 'Farmacia',
    shortLabel: 'Farmacia',
  },
  'Fisiatría': {
    icon: 'Bone',
    color: '#9333EA',
    bgColor: '#FAF5FF',
    ringColor: '#D8B4FE',
    label: 'Fisiatría',
    shortLabel: 'Fisiatría',
  },
  'Gastroenterología': {
    icon: 'Activity',
    color: '#CA8A04',
    bgColor: '#FEFCE8',
    ringColor: '#FDE047',
    label: 'Gastroenterología',
    shortLabel: 'Gastro.',
  },
  'Gerontología': {
    icon: 'Users',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    ringColor: '#C4B5FD',
    label: 'Gerontología',
    shortLabel: 'Geront.',
  },
  'Nefrología': {
    icon: 'Droplets',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    ringColor: '#93C5FD',
    label: 'Nefrología',
    shortLabel: 'Nefro.',
  },
  'Oftalmología': {
    icon: 'Eye',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    ringColor: '#5EEAD4',
    label: 'Oftalmología',
    shortLabel: 'Oftal.',
  },
  'Oncología': {
    icon: 'Ribbon',
    color: '#0891B2',
    bgColor: '#ECFEFF',
    ringColor: '#67E8F9',
    label: 'Oncología',
    shortLabel: 'Onco.',
  },
  'Terapia de Conducta': {
    icon: 'Brain',
    color: '#9333EA',
    bgColor: '#FAF5FF',
    ringColor: '#D8B4FE',
    label: 'Terapia de Conducta',
    shortLabel: 'T. Conducta',
  },
  'Traumatología': {
    icon: 'Bone',
    color: '#B45309',
    bgColor: '#FFFBEB',
    ringColor: '#FCD34D',
    label: 'Traumatología',
    shortLabel: 'Traum.',
  },
};

/**
 * Configuración especial para Médicos de Emergencia.
 * No es una "especialidad" en la BD, sino un rol con identidad visual propia.
 */
export const EMERGENCY_CONFIG = {
  icon: 'Siren',
  color: '#DC2626',
  bgColor: '#FEF2F2',
  ringColor: '#FCA5A5',
  label: 'Médico de Emergencias',
  shortLabel: 'Emergencia',
  pulseClass: 'animate-pulse-soft',
};

/**
 * Fallback para especialidades no mapeadas.
 */
export const DEFAULT_SPECIALTY = {
  icon: 'Stethoscope',
  color: '#64748B',
  bgColor: '#F8FAFC',
  ringColor: '#CBD5E1',
  label: 'Especialidad',
  shortLabel: 'Especialista',
};

/**
 * Obtiene la configuración visual de una especialidad.
 * @param {string} specialtyName - Nombre de la especialidad desde la BD
 * @param {boolean} isEmergency - Si es médico de emergencias
 * @returns {object} Configuración con icono, color, etc.
 */
export function getSpecialtyConfig(specialtyName, isEmergency = false) {
  if (isEmergency) return EMERGENCY_CONFIG;
  if (!specialtyName) return DEFAULT_SPECIALTY;

  // Normalizar: quitar tildes para buscar
  const normalized = specialtyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Buscar match exacto primero
  if (SPECIALTIES[specialtyName]) return SPECIALTIES[specialtyName];

  // Buscar por nombre normalizado
  const found = Object.entries(SPECIALTIES).find(([key]) => {
    const keyNormalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return keyNormalized === normalized.toLowerCase();
  });

  return found ? found[1] : DEFAULT_SPECIALTY;
}
