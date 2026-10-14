import {
  FlaskConical,
  ScanLine,
  Activity,
  Bone,
  Brain,
  Droplets,
  Heart,
  HeartPulse,
  Scan,
  TestTubes,
  Database,
  Microscope,
  Waves,
  Wind,
  Syringe,
  Ban,
} from 'lucide-react';

export const CATEGORIAS_ORDEN = [
  { id: 'laboratorio', etiqueta: 'Laboratorio', icono: FlaskConical, color: '#0d5c47', soft: '#d9e9e0' },
  { id: 'imagen', etiqueta: 'Imagen', icono: ScanLine, color: '#00677d', soft: '#d8ecf1' },
  { id: 'funcional', etiqueta: 'Funcional', icono: Activity, color: '#a8631b', soft: '#f4e3c3' },
];

export const GRUPOS_ORDEN = {
  'Radiología (Rayos X)': {
    sigla: 'RX',
    icono: Bone,
    color: '#a8631b',
    soft: '#f4e3c3',
    rayas: true,
  },
  'Tomografía computarizada (TAC)': {
    sigla: 'TAC',
    icono: Scan,
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  'Resonancia magnética (RM)': {
    sigla: 'RM',
    icono: Brain,
    color: '#0e7490',
    soft: '#cffafe',
  },
  Ecografía: {
    sigla: 'ECO',
    icono: Waves,
    color: '#0d5c47',
    soft: '#d9e9e0',
  },
  Cardiovascular: {
    sigla: 'CV',
    icono: HeartPulse,
    color: '#a52b1f',
    soft: '#f6dcd5',
  },
  Respiratorio: {
    sigla: 'RESP',
    icono: Wind,
    color: '#0e7490',
    soft: '#cffafe',
  },
  Neurológico: {
    sigla: 'NEU',
    icono: Brain,
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  Hematología: {
    sigla: 'HEM',
    icono: Droplets,
    color: '#a52b1f',
    soft: '#f6dcd5',
  },
  'Química sanguínea': {
    sigla: 'QUIM',
    icono: TestTubes,
    color: '#0d5c47',
    soft: '#d9e9e0',
  },
  'Serología e inmunología': {
    sigla: 'SER',
    icono: Ban,
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  Microbiología: {
    sigla: 'MICRO',
    icono: Microscope,
    color: '#a8631b',
    soft: '#f4e3c3',
  },
  Orina: {
    sigla: 'URO',
    icono: Database,
    color: '#1d4ed8',
    soft: '#dbeafe',
  },
  Heces: {
    sigla: 'COPRO',
    icono: Syringe,
    color: '#7c4a03',
    soft: '#f7ecd0',
  },
};

export const CATALOGO_EXAMENES = {
  laboratorio: [
    {
      grupo: 'Hematología',
      icono: Droplets,
      estudios: [
        'Hemograma completo',
        'Plaquetas',
        'Coagulación (TP/INR)',
        'Grupo y factor sanguíneo',
        'VSG (velocidad de sedimentación)',
        'Reticulocitos',
      ],
    },
    {
      grupo: 'Química sanguínea',
      icono: TestTubes,
      estudios: [
        'Glucosa en ayunas',
        'Hemoglobina glicosilada (HbA1c)',
        'Creatinina',
        'Urea / BUN',
        'Ácido úrico',
        'Electrolitos (Na, K, Cl, Ca)',
        'Perfil hepático (TGO, TGP, GGT, bilirrubinas)',
        'Perfil lipídico (colesterol, triglicéridos, HDL, LDL)',
        'Función tiroidea (TSH, T4 libre)',
        'Proteína C reactiva (PCR)',
      ],
    },
    {
      grupo: 'Serología e inmunología',
      icono: Ban,
      estudios: [
        'VIH',
        'Hepatitis B (HBsAg)',
        'Hepatitis C (Anti-HCV)',
        'VDRL / sífilis',
        'Dengue (NS1 / IgM)',
        'Malaria / gota gruesa',
        'Toxoplasmosis',
      ],
    },
    {
      grupo: 'Microbiología',
      icono: Microscope,
      estudios: [
        'Urocultivo',
        'Hemocultivo',
        'Cultivo de secreción / herida',
        'Antibiograma',
        'Examen directo en fresco',
      ],
    },
    {
      grupo: 'Orina',
      icono: Database,
      estudios: ['Parcial de orina (uroanálisis)', 'Microalbuminuria', 'Aclaramiento de creatinina'],
    },
    {
      grupo: 'Heces',
      icono: Syringe,
      estudios: ['Coprológico (parasitológico)', 'Sangre oculta en heces', 'Coprocutivo'],
    },
  ],
  imagen: [
    {
      grupo: 'Radiología (Rayos X)',
      icono: Bone,
      estudios: [
        'Radiografía de tórax',
        'Radiografía de columna',
        'Radiografía de extremidades',
        'Radiografía de abdomen',
        'Radiografía de cráneo',
        'Radiografía de pelvis',
      ],
    },
    {
      grupo: 'Tomografía computarizada (TAC)',
      icono: Scan,
      estudios: ['TAC de cráneo', 'TAC de tórax', 'TAC de abdomen y pelvis', 'TAC de columna'],
    },
    {
      grupo: 'Resonancia magnética (RM)',
      icono: Brain,
      estudios: ['RM de encéfalo', 'RM de columna', 'RM de rodilla / articulación'],
    },
    {
      grupo: 'Ecografía',
      icono: Waves,
      estudios: [
        'Ecografía abdominal',
        'Ecografía renal',
        'Ecografía de tejidos blandos',
        'Ecografía pélvica',
        'Ecografía doppler',
      ],
    },
  ],
  funcional: [
    {
      grupo: 'Cardiovascular',
      icono: HeartPulse,
      estudios: ['Electrocardiograma (ECG) de reposo', 'Ecocardiograma', 'Prueba de esfuerzo', 'Holter 24 horas'],
    },
    {
      grupo: 'Respiratorio',
      icono: Wind,
      estudios: ['Espirometría', 'Oximetría / gasometría arterial'],
    },
    {
      grupo: 'Neurológico',
      icono: Brain,
      estudios: ['Electroencefalograma (EEG)', 'Electromiografía (EMG)'],
    },
  ],
};

export function categoriaEstilo(id) {
  return CATEGORIAS_ORDEN.find((c) => c.id === id) || CATEGORIAS_ORDEN[0];
}

export function grupoEstilo(nombre) {
  return GRUPOS_ORDEN[nombre] || {};
}
