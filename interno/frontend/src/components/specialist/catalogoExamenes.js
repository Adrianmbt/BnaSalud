/**
 * Catálogo unificado de exámenes médicos — BnaSalud / CITAB
 *
 * Estructura dual:
 *  - CATALOGO_EXAMENES: árbol por categoría → grupo → estudios (para selector de órdenes)
 *  - RESULT_DEFINITIONS: mapa examenKey → { valores: [...] } (para entrada de resultados estructurados)
 *
 * Cada examen puede tener `alias: [...]` para fuzzy-match entre orden y resultados.
 */

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
  Dna,
  Ribbon,
  Baby,
  FileCheck,
} from 'lucide-react';

/* ─── Categorías de orden (tabs visuales) ─── */
export const CATEGORIAS_ORDEN = [
  { id: 'laboratorio', etiqueta: 'Laboratorio', icono: FlaskConical, color: '#0d5c47', soft: '#d9e9e0' },
  { id: 'imagen', etiqueta: 'Imagen', icono: ScanLine, color: '#00677d', soft: '#d8ecf1' },
  { id: 'funcional', etiqueta: 'Funcional', icono: Activity, color: '#a8631b', soft: '#f4e3c3' },
  { id: 'anatomia_patologica', etiqueta: 'Anatomía Patológica', icono: FileCheck, color: '#831843', soft: '#fce7f3' },
];

/* ─── Grupos por nombre (estilos) ─── */
export const GRUPOS_ORDEN = {
  'Radiología (Rayos X)': { sigla: 'RX', icono: Bone, color: '#a8631b', soft: '#f4e3c3' },
  'Tomografía computarizada (TAC)': { sigla: 'TAC', icono: Scan, color: '#6d28d9', soft: '#ede9fe' },
  'Resonancia magnética (RM)': { sigla: 'RM', icono: Brain, color: '#0e7490', soft: '#cffafe' },
  Ecografía: { sigla: 'ECO', icono: Waves, color: '#0d5c47', soft: '#d9e9e0' },
  Cardiovascular: { sigla: 'CV', icono: HeartPulse, color: '#a52b1f', soft: '#f6dcd5' },
  Respiratorio: { sigla: 'RESP', icono: Wind, color: '#0e7490', soft: '#cffafe' },
  Neurológico: { sigla: 'NEU', icono: Brain, color: '#6d28d9', soft: '#ede9fe' },
  Hematología: { sigla: 'HEM', icono: Droplets, color: '#a52b1f', soft: '#f6dcd5' },
  'Química sanguínea': { sigla: 'QUIM', icono: TestTubes, color: '#0d5c47', soft: '#d9e9e0' },
  'Hormonas y Marcadores': { sigla: 'HOR', icono: Ribbon, color: '#be185d', soft: '#fce7f3' },
  'Serología e inmunología': { sigla: 'SER', icono: Ban, color: '#6d28d9', soft: '#ede9fe' },
  Microbiología: { sigla: 'MICRO', icono: Microscope, color: '#a8631b', soft: '#f4e3c3' },
  Orina: { sigla: 'URO', icono: Database, color: '#1d4ed8', soft: '#dbeafe' },
  Heces: { sigla: 'COPRO', icono: Syringe, color: '#7c4a03', soft: '#f7ecd0' },
  'Citología y Biopsias': { sigla: 'BIO', icono: FileCheck, color: '#831843', soft: '#fce7f3' },
  'Perfil lipídico': { sigla: 'LIP', icono: TestTubes, color: '#0d5c47', soft: '#d9e9e0' },
  'Perfil hepático': { sigla: 'HEP', icono: FlaskConical, color: '#0d5c47', soft: '#d9e9e0' },
  'Perfil renal': { sigla: 'REN', icono: FlaskConical, color: '#0d5c47', soft: '#d9e9e0' },
  'Electrolitos': { sigla: 'ELEC', icono: FlaskConical, color: '#0d5c47', soft: '#d9e9e0' },
  'Vitaminas y minerales': { sigla: 'VIT', icono: Ribbon, color: '#be185d', soft: '#fce7f3' },
};

/* ─── Catálogo de órdenes (árbol completo) ─── */
export const CATALOGO_EXAMENES = {
  laboratorio: [
    {
      grupo: 'Hematología',
      icono: Droplets,
      estudios: [
        { nombre: 'Hemograma completo', alias: ['hematología completa', 'hemograma', 'hematologia completa'] },
        { nombre: 'Plaquetas', alias: ['conteo plaquetario'] },
        { nombre: 'Coagulación (TP/INR/TTPa)', alias: ['coagulacion', 'tp', 'inr', 'ttpa'] },
        { nombre: 'Fibrinógeno', alias: ['fibrinogeno'] },
        { nombre: 'Grupo y factor sanguíneo', alias: ['grupo sanguineo', 'grupo sangre'] },
        { nombre: 'VSG (velocidad de sedimentación)', alias: ['vsg', 'sedimentación'] },
        { nombre: 'Reticulocitos', alias: ['reticulocito'] },
        { nombre: 'Electroforesis de hemoglobina', alias: ['electroforesis hemoglobina', 'electroforesis'] },
      ],
    },
    {
      grupo: 'Química sanguínea',
      icono: TestTubes,
      estudios: [
        { nombre: 'Glucosa en ayunas', alias: ['glucosa'] },
        { nombre: 'Glucosa postprandial', alias: ['glucosa postprandial', 'glucosa 2h'] },
        { nombre: 'Hemoglobina glicosilada (HbA1c)', alias: ['hba1c', 'hemoglobina glicosilada'] },
        { nombre: 'Creatinina', alias: ['creatinina sérica'] },
        { nombre: 'Urea / BUN', alias: ['bun', 'nitrógeno ureico', 'urea'] },
        { nombre: 'Ácido úrico', alias: ['acido urico'] },
        { nombre: 'Electrolitos (Na, K, Cl, Ca, Mg, P)', alias: ['electrolitos', 'electrolitos séricos', 'sodio', 'potasio'] },
        { nombre: 'Perfil hepático (TGO, TGP, GGT, Bilirrubina total y fraccionada, Fosfatasa alcalina)', alias: ['perfil hepático', 'perfil hepatico', 'tgo', 'tgp', 'ggt'] },
        { nombre: 'Proteínas totales y fraccionadas (Albúmina/Globulina)', alias: ['proteínas totales', 'proteinas totales', 'albumina'] },
        { nombre: 'Perfil lipídico (Colesterol total, Triglicéridos, HDL, LDL, VLDL)', alias: ['perfil lipídico', 'perfil lipidico', 'colesterol'] },
        { nombre: 'Perfil pancreático (Amilasa, Lipasa)', alias: ['perfil pancreático', 'amilasa', 'lipasa'] },
        { nombre: 'Perfil cardíaco (Troponina, CPK, CPK-MB)', alias: ['perfil cardíaco', 'troponina', 'cpk'] },
        { nombre: 'Proteína C reactiva (PCR cuantitativa)', alias: ['pcr', 'proteína c reactiva', 'proteina c reactiva'] },
      ],
    },
    {
      grupo: 'Hormonas y Marcadores',
      icono: Ribbon,
      estudios: [
        { nombre: 'Perfil tiroideo (TSH, T3 libre, T4 libre, Anti-TPO)', alias: ['perfil tiroideo', 'tsh', 't4 libre', 't3 libre'] },
        { nombre: 'Perfil ginecológico / reproductivo (FSH, LH, Prolactina, Estradiol, Progesterona)', alias: ['perfil ginecológico', 'fsh', 'lh', 'prolactina'] },
        { nombre: 'Testosterona total y libre', alias: ['testosterona'] },
        { nombre: 'Insulina en ayunas / HOMA-IR', alias: ['insulina', 'homa-ir'] },
        { nombre: 'Cortisol sérico', alias: ['cortisol'] },
        { nombre: 'Subunidad Beta HCG (Prueba de embarazo cualitativa/cuantitativa)', alias: ['beta hcg', 'hcg', 'embarazo'] },
        { nombre: 'PSA Total y Libre (Antígeno Prostático Específico)', alias: ['psa', 'antígeno prostático'] },
        { nombre: 'CEA (Antígeno Carcinoembrionario)', alias: ['cea'] },
        { nombre: 'AFP (Alfa-fetoproteína)', alias: ['afp', 'alfa-fetoproteína'] },
        { nombre: 'CA 125 / CA 19-9 / CA 15-3', alias: ['ca 125', 'ca 19-9', 'ca 15-3'] },
      ],
    },
    {
      grupo: 'Serología e inmunología',
      icono: Ban,
      estudios: [
        { nombre: 'VIH (1 y 2 / Antígeno p24)', alias: ['vih'] },
        { nombre: 'Hepatitis B (HBsAg, Anti-HBs, Anti-HBc)', alias: ['hepatitis b', 'hbsag'] },
        { nombre: 'Hepatitis C (Anti-HCV)', alias: ['hepatitis c', 'hcv'] },
        { nombre: 'VDRL / RPR (Sífilis)', alias: ['vdrl', 'rpr', 'sífilis'] },
        { nombre: 'Dengue (NS1, IgG, IgM)', alias: ['dengue'] },
        { nombre: 'Prueba rápida de Malaria / Gota gruesa', alias: ['malaria', 'gota gruesa'] },
        { nombre: 'Toxoplasmosis (IgG, IgM)', alias: ['toxoplasmosis'] },
        { nombre: 'Chagas (IgG)', alias: ['chagas'] },
        { nombre: 'Factor reumatoide (FR) / ASTO', alias: ['factor reumatoide', 'fr', 'asto'] },
      ],
    },
    {
      grupo: 'Microbiología',
      icono: Microscope,
      estudios: [
        { nombre: 'Urocultivo con antibiograma', alias: ['urocultivo'] },
        { nombre: 'Hemocultivo', alias: ['hemocultivo', 'cultivo de sangre'] },
        { nombre: 'Coprocultivo', alias: ['coprocultivo'] },
        { nombre: 'Cultivo de secreción / herida / faríngeo', alias: ['cultivo'] },
        { nombre: 'Examen directo en fresco / Coloración Gram', alias: ['gram', 'examen directo'] },
        { nombre: 'Baciloscopia (BK en expectoración)', alias: ['baciloscopia', 'bk'] },
      ],
    },
    {
      grupo: 'Orina',
      icono: Database,
      estudios: [
        { nombre: 'Parcial de orina (uroanálisis completo)', alias: ['parcial de orina', 'uroanálisis', 'orina completa', 'urianalisis'] },
        { nombre: 'Depuración / Aclaramiento de creatinina (24h)', alias: ['aclaramiento creatinina'] },
        { nombre: 'Proteinuria en 24 horas', alias: ['proteinuria'] },
        { nombre: 'Microalbuminuria', alias: ['microalbuminuria'] },
      ],
    },
    {
      grupo: 'Heces',
      icono: Syringe,
      estudios: [
        { nombre: 'Coprológico (parasitológico directo y concentrado)', alias: ['coprológico', 'coprologico', 'parasitológico'] },
        { nombre: 'Sangre oculta en heces (método inmunocromatográfico)', alias: ['sangre oculta'] },
        { nombre: 'pH y azúcares reductores en heces', alias: ['ph heces'] },
      ],
    },
    {
      grupo: 'Vitaminas y minerales',
      icono: Ribbon,
      estudios: [
        { nombre: 'Vitamina D (25-OH)', alias: ['vitamina d', '25-oh vitamina d'] },
        { nombre: 'Ferritina', alias: ['ferritina'] },
        { nombre: 'Hierro sérico / TIBC / Transferrina', alias: ['hierro', 'tibc', 'transferrina'] },
        { nombre: 'Vitamina B12 / Ácido fólico', alias: ['b12', 'ácido fólico'] },
      ],
    },
    {
      grupo: 'Perfil lipídico',
      icono: TestTubes,
      estudios: [
        { nombre: 'Perfil lipídico completo (Colesterol total, LDL, HDL, Triglicéridos, VLDL)', alias: ['perfil lipidico completo'] },
      ],
    },
    {
      grupo: 'Perfil hepático',
      icono: FlaskConical,
      estudios: [
        { nombre: 'Perfil hepático completo (TGO, TGP, GGT, Bilirrubina total/directa/indirecta, Fosfatasa alcalina, Albúmina)', alias: ['perfil hepatico completo'] },
      ],
    },
    {
      grupo: 'Perfil renal',
      icono: FlaskConical,
      estudios: [
        { nombre: 'Perfil renal (Creatinina, BUN, Ácido úrico, FGe, Cistatina C)', alias: ['perfil renal'] },
      ],
    },
    {
      grupo: 'Electrolitos',
      icono: FlaskConical,
      estudios: [
        { nombre: 'Electrolitos séricos (Na⁺, K⁺, Cl⁻, Ca²⁺, Mg²⁺, Fósforo)', alias: ['electrolitos sericos'] },
      ],
    },
  ],

  imagen: [
    {
      grupo: 'Radiología (Rayos X)',
      icono: Bone,
      estudios: [
        { nombre: 'Radiografía de tórax (PA / Lateral)', alias: ['rx tórax', 'rx torax', 'radiografía tórax'] },
        { nombre: 'Radiografía de columna (Cervical / Dorsal / Lumbar)', alias: ['rx columna', 'rx cervical', 'rx lumbar'] },
        { nombre: 'Radiografía de extremidades (Huesos largos / Articulaciones)', alias: ['rx extremidades', 'rx huesos'] },
        { nombre: 'Radiografía de abdomen simple', alias: ['rx abdomen'] },
        { nombre: 'Radiografía de cráneo y senos paranasales', alias: ['rx cráneo', 'rx senos'] },
        { nombre: 'Radiografía de pelvis / Cadera', alias: ['rx pelvis', 'rx cadera'] },
      ],
    },
    {
      grupo: 'Tomografía computarizada (TAC)',
      icono: Scan,
      estudios: [
        { nombre: 'TAC de cráneo (simple / contrastado)', alias: ['tac cráneo', 'tac craneo'] },
        { nombre: 'TAC de tórax (alta resolución / contrastado)', alias: ['tac tórax', 'tac torax'] },
        { nombre: 'TAC de abdomen y pelvis (contrastado)', alias: ['tac abdomen'] },
        { nombre: 'TAC de columna (Cervical / Lumbar)', alias: ['tac columna'] },
        { nombre: 'AngioTAC', alias: ['angiotac'] },
      ],
    },
    {
      grupo: 'Resonancia magnética (RM)',
      icono: Brain,
      estudios: [
        { nombre: 'RM de encéfalo', alias: ['rm encéfalo', 'rm cerebro'] },
        { nombre: 'RM de columna (Cervical / Dorsal / Lumbar)', alias: ['rm columna'] },
        { nombre: 'RM articulaciones (Hombro / Rodilla / Cadera)', alias: ['rm articulaciones'] },
        { nombre: 'RM abdominal / Pelviana', alias: ['rm abdomen', 'rm pélvica'] },
      ],
    },
    {
      grupo: 'Ecografía',
      icono: Waves,
      estudios: [
        { nombre: 'Ecografía abdominal superior / completa', alias: ['ecografía abdominal', 'eco abdominal'] },
        { nombre: 'Ecografía renal y vías urinarias', alias: ['eco renal'] },
        { nombre: 'Ecografía pélvica / transvaginal', alias: ['eco pélvica', 'eco transvaginal'] },
        { nombre: 'Ecografía obstétrica / Perfil biofísico', alias: ['eco obstétrica', 'eco obstetrica', 'eco embarazo'] },
        { nombre: 'Ecografía mamaria', alias: ['eco mamaria', 'eco mamas'] },
        { nombre: 'Ecografía tiroidea', alias: ['eco tiroidea', 'eco tiroides'] },
        { nombre: 'Ecografía testicular / prostática', alias: ['eco testicular', 'eco prostática'] },
        { nombre: 'Ecografía doppler arterial / venoso (Miembros inferiores)', alias: ['doppler', 'eco doppler'] },
        { nombre: 'Ecografía de tejidos blandos y pared abdominal', alias: ['eco tejidos blandos'] },
      ],
    },
  ],

  funcional: [
    {
      grupo: 'Cardiovascular',
      icono: HeartPulse,
      estudios: [
        { nombre: 'Electrocardiograma (ECG) de 12 derivaciones', alias: ['ecg', 'electrocardiograma'] },
        { nombre: 'Ecocardiograma Doppler transtorácico', alias: ['ecocardiograma', 'eco cardíaca'] },
        { nombre: 'Prueba de esfuerzo (Ergometría)', alias: ['ergometría', 'prueba esfuerzo'] },
        { nombre: 'Monitoreo Holter de ritmo (24 horas)', alias: ['holter'] },
        { nombre: 'MAPA (Monitoreo Ambulatorio de Presión Arterial 24h)', alias: ['mapa', 'taam'] },
      ],
    },
    {
      grupo: 'Respiratorio',
      icono: Wind,
      estudios: [
        { nombre: 'Espirometría simple y con broncodilatador', alias: ['espirometría', 'espirometria'] },
        { nombre: 'Gasometría arterial', alias: ['gasometría', 'gasometria'] },
        { nombre: 'Oximetría de pulso continuo', alias: ['oximetría', 'pulsioximetría'] },
      ],
    },
    {
      grupo: 'Neurológico',
      icono: Brain,
      estudios: [
        { nombre: 'Electroencefalograma (EEG)', alias: ['eeg', 'electroencefalograma'] },
        { nombre: 'Electromiografía (EMG) y velocidad de conducción nerviosa', alias: ['emg', 'electromiografía'] },
      ],
    },
  ],

  anatomia_patologica: [
    {
      grupo: 'Citología y Biopsias',
      icono: FileCheck,
      estudios: [
        { nombre: 'Citología cérvico-vaginal (Papanicolaou)', alias: ['papanicolaou', 'pap'] },
        { nombre: 'Citología de líquidos corporales (pleural, ascítico)', alias: ['citología líquidos'] },
        { nombre: 'Biopsia de piel / tejidos blandos', alias: ['biopsia piel'] },
        { nombre: 'Biopsia por aspiración con aguja fina (PAAF)', alias: ['paaf', 'biopsia aguja'] },
        { nombre: 'Estudio histopatológico de pieza quirúrgica', alias: ['histopatológico', 'histopatologia'] },
      ],
    },
  ],
};

/* ─── Definiciones de resultados estructurados (sub-valores + rangos) ─── */

const VALORES_HEMATOLOGIA = [
  { id: 'hemoglobina', label: 'Hemoglobina', unidad: 'g/dL', refMin: 12, refMax: 17.5, normalM: [13.5, 17.5], normalF: [12, 16] },
  { id: 'hematocrito', label: 'Hematocrito', unidad: '%', refMin: 36, refMax: 52, normalM: [41, 53], normalF: [36, 46] },
  { id: 'eritrocitos', label: 'Eritrocitos', unidad: 'x10⁶/μL', refMin: 4, refMax: 6, normalM: [4.5, 5.9], normalF: [4.1, 5.1] },
  { id: 'leucocitos', label: 'Leucocitos', unidad: 'x10³/μL', refMin: 4, refMax: 11, normalM: [4.5, 11], normalF: [4.5, 11] },
  { id: 'plaquetas', label: 'Plaquetas', unidad: 'x10³/μL', refMin: 150, refMax: 450, normalM: [150, 400], normalF: [150, 400] },
  { id: 'vcm', label: 'VCM', unidad: 'fL', refMin: 80, refMax: 100, normalM: [80, 100], normalF: [80, 100] },
  { id: 'hcm', label: 'HCM', unidad: 'pg', refMin: 27, refMax: 33, normalM: [27, 33], normalF: [27, 33] },
  { id: 'chcm', label: 'CHCM', unidad: 'g/dL', refMin: 31, refMax: 37, normalM: [31, 37], normalF: [31, 37] },
  { id: 'neutrofilos', label: 'Neutrófilos', unidad: '%', refMin: 40, refMax: 75, normalM: [40, 75], normalF: [40, 75] },
  { id: 'linfocitos', label: 'Linfocitos', unidad: '%', refMin: 20, refMax: 45, normalM: [20, 45], normalF: [20, 45] },
  { id: 'monocitos', label: 'Monocitos', unidad: '%', refMin: 2, refMax: 10, normalM: [2, 10], normalF: [2, 10] },
  { id: 'eosinofilos', label: 'Eosinófilos', unidad: '%', refMin: 1, refMax: 6, normalM: [1, 6], normalF: [1, 6] },
  { id: 'basofilos', label: 'Basófilos', unidad: '%', refMin: 0, refMax: 2, normalM: [0, 2], normalF: [0, 2] },
];

const VALORES_QUIMICA = [
  { id: 'glucosa', label: 'Glucosa', unidad: 'mg/dL', refMin: 70, refMax: 110, normalM: [70, 110], normalF: [70, 110] },
  { id: 'colesterol_total', label: 'Colesterol total', unidad: 'mg/dL', refMin: 0, refMax: 200, normalM: [0, 200], normalF: [0, 200] },
  { id: 'trigliceridos', label: 'Triglicéridos', unidad: 'mg/dL', refMin: 0, refMax: 150, normalM: [0, 150], normalF: [0, 150] },
  { id: 'bun', label: 'BUN (Nitrógeno ureico)', unidad: 'mg/dL', refMin: 7, refMax: 20, normalM: [7, 20], normalF: [7, 20] },
  { id: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', refMin: 0.6, refMax: 1.2, normalM: [0.7, 1.3], normalF: [0.6, 1.1] },
  { id: 'acido_urico', label: 'Ácido úrico', unidad: 'mg/dL', refMin: 3.5, refMax: 7.2, normalM: [3.5, 7.2], normalF: [2.5, 6] },
  { id: 'tgp', label: 'TGP (ALT)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
  { id: 'tgo', label: 'TGO (AST)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
  { id: 'bilirrubina_total', label: 'Bilirrubina total', unidad: 'mg/dL', refMin: 0, refMax: 1.2, normalM: [0, 1.2], normalF: [0, 1.1] },
  { id: 'proteinas_totales', label: 'Proteínas totales', unidad: 'g/dL', refMin: 6, refMax: 8.3, normalM: [6.4, 8.3], normalF: [6.4, 8.3] },
  { id: 'albumina', label: 'Albúmina', unidad: 'g/dL', refMin: 3.5, refMax: 5.5, normalM: [3.5, 5.5], normalF: [3.5, 5.5] },
];

const VALORES_LIPIDICO = [
  { id: 'colesterol_total', label: 'Colesterol total', unidad: 'mg/dL', refMin: 0, refMax: 200, normalM: [0, 200], normalF: [0, 200] },
  { id: 'ldl', label: 'Colesterol LDL', unidad: 'mg/dL', refMin: 0, refMax: 100, normalM: [0, 100], normalF: [0, 100] },
  { id: 'hdl', label: 'Colesterol HDL', unidad: 'mg/dL', refMin: 40, refMax: 999, normalM: [40, 999], normalF: [50, 999] },
  { id: 'trigliceridos', label: 'Triglicéridos', unidad: 'mg/dL', refMin: 0, refMax: 150, normalM: [0, 150], normalF: [0, 150] },
  { id: 'vldl', label: 'Colesterol VLDL', unidad: 'mg/dL', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 40] },
];

const VALORES_GASOMETRIA = [
  { id: 'ph', label: 'pH', unidad: '', refMin: 7.35, refMax: 7.45, normalM: [7.35, 7.45], normalF: [7.35, 7.45] },
  { id: 'pco2', label: 'pCO₂', unidad: 'mmHg', refMin: 35, refMax: 45, normalM: [35, 45], normalF: [35, 45] },
  { id: 'po2', label: 'pO₂', unidad: 'mmHg', refMin: 80, refMax: 100, normalM: [80, 100], normalF: [80, 100] },
  { id: 'hco3', label: 'HCO₃', unidad: 'mEq/L', refMin: 22, refMax: 26, normalM: [22, 26], normalF: [22, 26] },
  { id: 'saturacion_o2', label: 'Saturación O₂', unidad: '%', refMin: 95, refMax: 100, normalM: [95, 100], normalF: [95, 100] },
  { id: 'exceso_base', label: 'Exceso de base', unidad: 'mEq/L', refMin: -2, refMax: 2, normalM: [-2, 2], normalF: [-2, 2] },
];

const VALORES_ORINA = [
  { id: 'color', label: 'Color', unidad: '', refMin: 0, refMax: 0, normal: 'Amarillo paja' },
  { id: 'aspecto', label: 'Aspecto', unidad: '', refMin: 0, refMax: 0, normal: 'Claro' },
  { id: 'densidad', label: 'Densidad', unidad: '', refMin: 1.005, refMax: 1.030, normalM: [1.005, 1.030], normalF: [1.005, 1.030] },
  { id: 'ph_orina', label: 'pH', unidad: '', refMin: 4.5, refMax: 8, normalM: [4.5, 8], normalF: [4.5, 8] },
  { id: 'proteinas_orina', label: 'Proteínas', unidad: 'mg/dL', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
  { id: 'glucosa_orina', label: 'Glucosa', unidad: 'mg/dL', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
  { id: 'hemoglobina_orina', label: 'Hemoglobina', unidad: '', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
  { id: 'leucocitos_orina', label: 'Leucocitos', unidad: '/campo', refMin: 0, refMax: 5, normalM: [0, 5], normalF: [0, 5] },
  { id: 'hematies_orina', label: 'Hematíes', unidad: '/campo', refMin: 0, refMax: 2, normalM: [0, 2], normalF: [0, 2] },
  { id: 'cilindros', label: 'Cilindros', unidad: '/campo', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
  { id: 'cristales', label: 'Cristales', unidad: '', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
  { id: 'nitritos', label: 'Nitritos', unidad: '', refMin: 0, refMax: 0, normalM: [0, 0], normalF: [0, 0] },
];

const VALORES_ECG = [
  { id: 'frecuencia_cardiaca_ecg', label: 'Frecuencia cardíaca', unidad: 'lpm', refMin: 60, refMax: 100, normalM: [60, 100], normalF: [60, 100] },
  { id: 'ritmo', label: 'Ritmo', unidad: '', refMin: 0, refMax: 0, normal: 'Rítmico sinusal' },
  { id: 'eje_electrico', label: 'Eje eléctrico', unidad: '°', refMin: -30, refMax: 90, normalM: [-30, 90], normalF: [-30, 90] },
  { id: 'intervalo_pr', label: 'Intervalo PR', unidad: 'ms', refMin: 120, refMax: 200, normalM: [120, 200], normalF: [120, 200] },
  { id: 'qrs', label: 'QRS', unidad: 'ms', refMin: 80, refMax: 120, normalM: [80, 120], normalF: [80, 120] },
  { id: 'qt_corregido', label: 'QTc', unidad: 'ms', refMin: 350, refMax: 450, normalM: [350, 440], normalF: [350, 460] },
  { id: 'hallazgos_ecg', label: 'Hallazgos', unidad: '', refMin: 0, refMax: 0, normal: 'Sin alteraciones del segmento ST ni de la onda T' },
];

const VALORES_ECO = [
  { id: 'fevi', label: 'Fracción de eyección (FEVI)', unidad: '%', refMin: 55, refMax: 70, normalM: [55, 70], normalF: [55, 70] },
  { id: 'diametro_diastolico_vi', label: 'DDVI', unidad: 'mm', refMin: 35, refMax: 56, normalM: [35, 56], normalF: [35, 56] },
  { id: 'diametro_sistolico_vi', label: 'DSVI', unidad: 'mm', refMin: 20, refMax: 40, normalM: [20, 40], normalF: [20, 40] },
  { id: 'auricula_izquierda', label: 'Aurícula izquierda', unidad: 'mm', refMin: 19, refMax: 40, normalM: [19, 40], normalF: [19, 40] },
  { id: 'hallazgos_eco', label: 'Hallazgos', unidad: '', refMin: 0, refMax: 0, normal: 'Función sistólica y diastólica preservadas' },
];

const VALORES_ESPIROMETRIA = [
  { id: 'fvc', label: 'CVF', unidad: 'L', refMin: 2.5, refMax: 6, normalM: [3.5, 6], normalF: [2.5, 4.5] },
  { id: 'fev1', label: 'VEF1', unidad: 'L', refMin: 2, refMax: 5, normalM: [2.8, 5], normalF: [2.2, 3.8] },
  { id: 'fev1_fvc', label: 'VEF1/CVF', unidad: '%', refMin: 70, refMax: 100, normalM: [70, 100], normalF: [70, 100] },
];

const VALORES_TAAM = [
  { id: 'pas_media', label: 'PAS media 24h', unidad: 'mmHg', refMin: 0, refMax: 130, normalM: [0, 130], normalF: [0, 130] },
  { id: 'pad_media', label: 'PAD media 24h', unidad: 'mmHg', refMin: 0, refMax: 80, normalM: [0, 80], normalF: [0, 80] },
  { id: 'pas_diurna', label: 'PAS diurna', unidad: 'mmHg', refMin: 0, refMax: 135, normalM: [0, 135], normalF: [0, 135] },
  { id: 'pad_diurna', label: 'PAD diurna', unidad: 'mmHg', refMin: 0, refMax: 85, normalM: [0, 85], normalF: [0, 85] },
  { id: 'pas_nocturna', label: 'PAS nocturna', unidad: 'mmHg', refMin: 0, refMax: 120, normalM: [0, 120], normalF: [0, 120] },
  { id: 'pad_nocturna', label: 'PAD nocturna', unidad: 'mmHg', refMin: 0, refMax: 70, normalM: [0, 70], normalF: [0, 70] },
];

/**
 * Mapa de definiciones de resultados estructurados.
 * Clave = nombre exacto del estudio en CATALOGO_EXAMENES (o alias principal).
 * Los resultados se ingresan como sub-valores con rangos de referencia.
 */
export const RESULT_DEFINITIONS = {
  'Hemograma completo': { valores: VALORES_HEMATOLOGIA },
  'Glucosa en ayunas': { valores: [
    { id: 'glucosa', label: 'Glucosa', unidad: 'mg/dL', refMin: 70, refMax: 100, normalM: [70, 100], normalF: [70, 100] },
  ]},
  'Glucosa postprandial': { valores: [
    { id: 'glucosa_2h', label: 'Glucosa 2h', unidad: 'mg/dL', refMin: 0, refMax: 140, normalM: [0, 140], normalF: [0, 140] },
  ]},
  'Hemoglobina glicosilada (HbA1c)': { valores: [
    { id: 'hba1c', label: 'HbA1c', unidad: '%', refMin: 4, refMax: 5.6, normalM: [4, 5.6], normalF: [4, 5.6] },
  ]},
  'Creatinina': { valores: [
    { id: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', refMin: 0.6, refMax: 1.2, normalM: [0.7, 1.3], normalF: [0.6, 1.1] },
  ]},
  'Urea / BUN': { valores: [
    { id: 'bun', label: 'BUN', unidad: 'mg/dL', refMin: 7, refMax: 20, normalM: [7, 20], normalF: [7, 20] },
  ]},
  'Ácido úrico': { valores: [
    { id: 'acido_urico', label: 'Ácido úrico', unidad: 'mg/dL', refMin: 3.5, refMax: 7.2, normalM: [3.5, 7.2], normalF: [2.5, 6] },
  ]},
  'Electrolitos (Na, K, Cl, Ca, Mg, P)': { valores: [
    { id: 'sodio', label: 'Sodio (Na⁺)', unidad: 'mEq/L', refMin: 136, refMax: 145, normalM: [136, 145], normalF: [136, 145] },
    { id: 'potasio', label: 'Potasio (K⁺)', unidad: 'mEq/L', refMin: 3.5, refMax: 5.1, normalM: [3.5, 5.1], normalF: [3.5, 5.1] },
    { id: 'cloro', label: 'Cloro (Cl⁻)', unidad: 'mEq/L', refMin: 98, refMax: 107, normalM: [98, 107], normalF: [98, 107] },
    { id: 'calcio', label: 'Calcio total', unidad: 'mg/dL', refMin: 8.5, refMax: 10.5, normalM: [8.5, 10.5], normalF: [8.5, 10.5] },
    { id: 'magnesio', label: 'Magnesio', unidad: 'mg/dL', refMin: 1.7, refMax: 2.2, normalM: [1.7, 2.2], normalF: [1.7, 2.2] },
    { id: 'fosforo', label: 'Fósforo', unidad: 'mg/dL', refMin: 2.5, refMax: 4.5, normalM: [2.5, 4.5], normalF: [2.5, 4.5] },
  ]},
  'Perfil hepático (TGO, TGP, GGT, Bilirrubina total y fraccionada, Fosfatasa alcalina)': { valores: [
    { id: 'tgo', label: 'TGO (AST)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
    { id: 'tgp', label: 'TGP (ALT)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
    { id: 'ggt', label: 'GGT', unidad: 'U/L', refMin: 0, refMax: 45, normalM: [8, 61], normalF: [5, 36] },
    { id: 'bilirrubina_total', label: 'Bilirrubina total', unidad: 'mg/dL', refMin: 0, refMax: 1.2, normalM: [0, 1.2], normalF: [0, 1.1] },
    { id: 'bilirrubina_directa', label: 'Bilirrubina directa', unidad: 'mg/dL', refMin: 0, refMax: 0.3, normalM: [0, 0.3], normalF: [0, 0.3] },
    { id: 'fosfatasa_alcalina', label: 'Fosfatasa alcalina', unidad: 'U/L', refMin: 44, refMax: 147, normalM: [44, 147], normalF: [44, 147] },
  ]},
  'Proteínas totales y fraccionadas (Albúmina/Globulina)': { valores: [
    { id: 'proteinas_totales', label: 'Proteínas totales', unidad: 'g/dL', refMin: 6, refMax: 8.3, normalM: [6.4, 8.3], normalF: [6.4, 8.3] },
    { id: 'albumina', label: 'Albúmina', unidad: 'g/dL', refMin: 3.5, refMax: 5.5, normalM: [3.5, 5.5], normalF: [3.5, 5.5] },
    { id: 'globulinas', label: 'Globulinas', unidad: 'g/dL', refMin: 2, refMax: 3.5, normalM: [2, 3.5], normalF: [2, 3.5] },
  ]},
  'Perfil lipídico (Colesterol total, Triglicéridos, HDL, LDL, VLDL)': { valores: VALORES_LIPIDICO },
  'Perfil lipídico completo (Colesterol total, LDL, HDL, Triglicéridos, VLDL)': { valores: VALORES_LIPIDICO },
  'Perfil pancreático (Amilasa, Lipasa)': { valores: [
    { id: 'amilasa', label: 'Amilasa', unidad: 'U/L', refMin: 28, refMax: 100, normalM: [28, 100], normalF: [28, 100] },
    { id: 'lipasa', label: 'Lipasa', unidad: 'U/L', refMin: 13, refMax: 60, normalM: [13, 60], normalF: [13, 60] },
  ]},
  'Perfil cardíaco (Troponina, CPK, CPK-MB)': { valores: [
    { id: 'troponina', label: 'Troponina I', unidad: 'ng/mL', refMin: 0, refMax: 0.04, normalM: [0, 0.04], normalF: [0, 0.04] },
    { id: 'cpk', label: 'CPK total', unidad: 'U/L', refMin: 22, refMax: 198, normalM: [22, 198], normalF: [22, 198] },
    { id: 'cpk_mb', label: 'CPK-MB', unidad: 'ng/mL', refMin: 0, refMax: 5, normalM: [0, 5], normalF: [0, 5] },
  ]},
  'Proteína C reactiva (PCR cuantitativa)': { valores: [
    { id: 'pcr', label: 'PCR', unidad: 'mg/L', refMin: 0, refMax: 5, normalM: [0, 5], normalF: [0, 5] },
  ]},
  'Perfil tiroideo (TSH, T3 libre, T4 libre, Anti-TPO)': { valores: [
    { id: 'tsh', label: 'TSH', unidad: 'μIU/mL', refMin: 0.27, refMax: 4.2, normalM: [0.27, 4.2], normalF: [0.27, 4.2] },
    { id: 't4_libre', label: 'T4 libre', unidad: 'ng/dL', refMin: 0.93, refMax: 1.7, normalM: [0.93, 1.7], normalF: [0.93, 1.7] },
    { id: 't3_libre', label: 'T3 libre', unidad: 'pg/mL', refMin: 2, refMax: 4.4, normalM: [2, 4.4], normalF: [2, 4.4] },
    { id: 'anti_tpo', label: 'Anti-TPO', unidad: 'UI/mL', refMin: 0, refMax: 34, normalM: [0, 34], normalF: [0, 34] },
  ]},
  'PSA Total y Libre (Antígeno Prostático Específico)': { valores: [
    { id: 'psa_total', label: 'PSA total', unidad: 'ng/mL', refMin: 0, refMax: 4, normalM: [0, 4], normalF: [0, 4] },
    { id: 'psa_libre', label: 'PSA libre', unidad: 'ng/mL', refMin: 0, refMax: 0.89, normalM: [0, 0.89], normalF: [0, 0.89] },
  ]},
  'CEA (Antígeno Carcinoembrionario)': { valores: [
    { id: 'cea', label: 'CEA', unidad: 'ng/mL', refMin: 0, refMax: 5, normalM: [0, 5], normalF: [0, 5] },
  ]},
  'AFP (Alfa-fetoproteína)': { valores: [
    { id: 'afp', label: 'AFP', unidad: 'ng/mL', refMin: 0, refMax: 10, normalM: [0, 10], normalF: [0, 10] },
  ]},
  'CA 125 / CA 19-9 / CA 15-3': { valores: [
    { id: 'ca_125', label: 'CA-125', unidad: 'U/mL', refMin: 0, refMax: 35, normalM: [0, 35], normalF: [0, 35] },
    { id: 'ca_19_9', label: 'CA 19-9', unidad: 'U/mL', refMin: 0, refMax: 37, normalM: [0, 37], normalF: [0, 37] },
    { id: 'ca_15_3', label: 'CA 15-3', unidad: 'U/mL', refMin: 0, refMax: 25, normalM: [0, 25], normalF: [0, 25] },
  ]},
  'Vitamina D (25-OH)': { valores: [
    { id: 'vitamina_d', label: '25-OH Vitamina D', unidad: 'ng/mL', refMin: 30, refMax: 100, normalM: [30, 100], normalF: [30, 100] },
  ]},
  'Ferritina': { valores: [
    { id: 'ferritina', label: 'Ferritina', unidad: 'ng/mL', refMin: 12, refMax: 300, normalM: [12, 300], normalF: [12, 150] },
  ]},
  'Hierro sérico / TIBC / Transferrina': { valores: [
    { id: 'hierro', label: 'Hierro sérico', unidad: 'μg/dL', refMin: 60, refMax: 170, normalM: [65, 175], normalF: [50, 170] },
    { id: 'tibc', label: 'TIBC', unidad: 'μg/dL', refMin: 250, refMax: 450, normalM: [250, 450], normalF: [250, 450] },
    { id: 'transferrina', label: 'Transferrina', unidad: 'mg/dL', refMin: 200, refMax: 360, normalM: [200, 360], normalF: [200, 360] },
  ]},
  'Parcial de orina (uroanálisis completo)': { valores: VALORES_ORINA },
  'Urocultivo con antibiograma': { valores: [
    { id: 'uropatogeno', label: 'Uropatógeno', unidad: '', refMin: 0, refMax: 0, normal: 'Negativo' },
    { id: 'sensibilidad', label: 'Sensibilidad', unidad: '', refMin: 0, refMax: 0, normal: 'Ver antibiograma' },
  ]},
  'Electrocardiograma (ECG) de 12 derivaciones': { valores: VALORES_ECG },
  'Ecocardiograma Doppler transtorácico': { valores: VALORES_ECO },
  'Espirometría simple y con broncodilatador': { valores: VALORES_ESPIROMETRIA },
  'Gasometría arterial': { valores: VALORES_GASOMETRIA },
  'MAPA (Monitoreo Ambulatorio de Presión Arterial 24h)': { valores: VALORES_TAAM },
  'Perfil renal (Creatinina, BUN, Ácido úrico, FGe, Cistatina C)': { valores: [
    { id: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', refMin: 0.6, refMax: 1.2, normalM: [0.7, 1.3], normalF: [0.6, 1.1] },
    { id: 'bun', label: 'BUN', unidad: 'mg/dL', refMin: 7, refMax: 20, normalM: [7, 20], normalF: [7, 20] },
    { id: 'acido_urico', label: 'Ácido úrico', unidad: 'mg/dL', refMin: 3.5, refMax: 7.2, normalM: [3.5, 7.2], normalF: [2.5, 6] },
    { id: 'fge', label: 'FGe', unidad: 'mL/min/1.73m²', refMin: 90, refMax: 999, normalM: [90, 999], normalF: [90, 999] },
  ]},
  'Electrolitos séricos (Na⁺, K⁺, Cl⁻, Ca²⁺, Mg²⁺, Fósforo)': { valores: [
    { id: 'sodio', label: 'Sodio (Na⁺)', unidad: 'mEq/L', refMin: 136, refMax: 145, normalM: [136, 145], normalF: [136, 145] },
    { id: 'potasio', label: 'Potasio (K⁺)', unidad: 'mEq/L', refMin: 3.5, refMax: 5.1, normalM: [3.5, 5.1], normalF: [3.5, 5.1] },
    { id: 'cloro', label: 'Cloro (Cl⁻)', unidad: 'mEq/L', refMin: 98, refMax: 107, normalM: [98, 107], normalF: [98, 107] },
    { id: 'calcio', label: 'Calcio total', unidad: 'mg/dL', refMin: 8.5, refMax: 10.5, normalM: [8.5, 10.5], normalF: [8.5, 10.5] },
    { id: 'magnesio', label: 'Magnesio', unidad: 'mg/dL', refMin: 1.7, refMax: 2.2, normalM: [1.7, 2.2], normalF: [1.7, 2.2] },
    { id: 'fosforo', label: 'Fósforo', unidad: 'mg/dL', refMin: 2.5, refMax: 4.5, normalM: [2.5, 4.5], normalF: [2.5, 4.5] },
  ]},
  'Perfil hepático completo (TGO, TGP, GGT, Bilirrubina total/directa/indirecta, Fosfatasa alcalina, Albúmina)': { valores: [
    { id: 'tgo', label: 'TGO (AST)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
    { id: 'tgp', label: 'TGP (ALT)', unidad: 'U/L', refMin: 0, refMax: 40, normalM: [0, 40], normalF: [0, 32] },
    { id: 'ggt', label: 'GGT', unidad: 'U/L', refMin: 0, refMax: 45, normalM: [8, 61], normalF: [5, 36] },
    { id: 'bilirrubina_total', label: 'Bilirrubina total', unidad: 'mg/dL', refMin: 0, refMax: 1.2, normalM: [0, 1.2], normalF: [0, 1.1] },
    { id: 'bilirrubina_directa', label: 'Bilirrubina directa', unidad: 'mg/dL', refMin: 0, refMax: 0.3, normalM: [0, 0.3], normalF: [0, 0.3] },
    { id: 'bilirrubina_indirecta', label: 'Bilirrubina indirecta', unidad: 'mg/dL', refMin: 0, refMax: 1, normalM: [0, 1], normalF: [0, 1] },
    { id: 'fosfatasa_alcalina', label: 'Fosfatasa alcalina', unidad: 'U/L', refMin: 44, refMax: 147, normalM: [44, 147], normalF: [44, 147] },
    { id: 'albumina', label: 'Albúmina', unidad: 'g/dL', refMin: 3.5, refMax: 5.5, normalM: [3.5, 5.5], normalF: [3.5, 5.5] },
  ]},
  'Monitoreo Holter de ritmo (24 horas)': { valores: [
    { id: 'fc_media', label: 'FC media', unidad: 'lpm', refMin: 60, refMax: 100, normalM: [60, 100], normalF: [60, 100] },
    { id: 'fc_max', label: 'FC máxima', unidad: 'lpm', refMin: 0, refMax: 200, normalM: [0, 200], normalF: [0, 200] },
    { id: 'fc_min', label: 'FC mínima', unidad: 'lpm', refMin: 40, refMax: 999, normalM: [40, 999], normalF: [40, 999] },
    { id: 'arritmias', label: 'Arritmias', unidad: '', refMin: 0, refMax: 0, normal: 'No se registran arritmias significativas' },
  ]},
  'Ecografía abdominal superior / completa': { valores: [
    { id: 'higado', label: 'Hígado', unidad: '', refMin: 0, refMax: 0, normal: 'Homogéneo, sin lesiones focales' },
    { id: 'vesicula', label: 'Vesícula biliar', unidad: '', refMin: 0, refMax: 0, normal: 'De normal tamaño y contenido' },
    { id: 'rinones', label: 'Riñones', unidad: '', refMin: 0, refMax: 0, normal: 'De tamaño y ecogenicidad normal' },
    { id: 'pcreas', label: 'Páncreas', unidad: '', refMin: 0, refMax: 0, normal: 'De ecogenicidad homogénea' },
    { id: 'bazo', label: 'Bazo', unidad: '', refMin: 0, refMax: 0, normal: 'De tamaño normal' },
  ]},
  'Ecografía obstétrica / Perfil biofísico': { valores: [
    { id: 'edad_gestacional', label: 'Edad gestacional', unidad: 'sem', refMin: 0, refMax: 42, normalM: [0, 42], normalF: [0, 42] },
    { id: 'peso_fetal_estimado', label: 'Peso fetal estimado', unidad: 'g', refMin: 0, refMax: 9999, normalM: [0, 9999], normalF: [0, 9999] },
    { id: 'liquido_amniotico', label: 'Líquido amniótico (ILA)', unidad: 'cm', refMin: 2, refMax: 8, normalM: [2, 8], normalF: [2, 8] },
    { id: 'frecuencia_cardiaca_fetal', label: 'FCF', unidad: 'lpm', refMin: 110, refMax: 160, normalM: [110, 160], normalF: [110, 160] },
    { id: 'perfil_biofisico', label: 'Perfil biofísico', unidad: '/10', refMin: 6, refMax: 10, normalM: [6, 10], normalF: [6, 10] },
  ]},
};

/* ─── Helpers ─── */

/** Normaliza string para comparación: minúsculas, sin tildes, sin espacios extra. */
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Construye un índice plano de nombre → { grupo, categoria, estudio } para búsqueda rápida. */
function buildFlatIndex() {
  const idx = {};
  for (const [catId, grupos] of Object.entries(CATALOGO_EXAMENES)) {
    for (const grupo of grupos) {
      for (const est of grupo.estudios) {
        const names = [est.nombre, ...(est.alias || [])];
        for (const n of names) {
          idx[normal(n)] = {
            nombre: est.nombre,
            grupo: grupo.grupo,
            categoria: catId,
          };
        }
      }
    }
  }
  return idx;
}

let _flatIndex = null;
function getFlatIndex() {
  if (!_flatIndex) _flatIndex = buildFlatIndex();
  return _flatIndex;
}

/** Busca un examen por nombre fuzzy. Devuelve { nombre, grupo, categoria } o null. */
export function buscarExamen(nombreBuscado) {
  if (!nombreBuscado) return null;
  const n = norm(nombreBuscado);
  const idx = getFlatIndex();
  // Exact match
  if (idx[n]) return idx[n];
  // Partial match
  for (const [key, val] of Object.entries(idx)) {
    if (key.includes(n) || n.includes(key)) return val;
  }
  return null;
}

/** Busca la definición de resultados para un nombre de examen. */
export function buscarResultDef(nombreExamen) {
  if (!nombreExamen) return null;
  // Exact match
  if (RESULT_DEFINITIONS[nombreExamen]) return RESULT_DEFINITIONS[nombreExamen];
  // Fuzzy: search by normalized name
  const n = norm(nombreExamen);
  for (const [key, def] of Object.entries(RESULT_DEFINITIONS)) {
    if (norm(key) === n) return def;
  }
  // Partial match
  for (const [key, def] of Object.entries(RESULT_DEFINITIONS)) {
    if (norm(key).includes(n) || n.includes(norm(key))) return def;
  }
  return null;
}

/** Obtiene el rango de referencia para un valor del catálogo. */
export function obtenerRango(valorCatalogo) {
  if (valorCatalogo.normal && !valorCatalogo.normalM) {
    return { min: null, max: null, texto: valorCatalogo.normal };
  }
  const r = valorCatalogo.normalM || valorCatalogo.normalF;
  if (!r) return { min: valorCatalogo.refMin, max: valorCatalogo.refMax, texto: '' };
  return { min: r[0], max: r[1], texto: `${r[0]} – ${r[1]} ${valorCatalogo.unidad}` };
}

/** Verifica si un valor numérico está fuera del rango normal. */
export function estaFueraDeRango(valor, valorCatalogo) {
  const num = parseFloat(valor);
  if (isNaN(num)) return null;
  const r = valorCatalogo.normalM || valorCatalogo.normalF;
  if (!r) return null;
  if (num < r[0]) return 'bajo';
  if (num > r[1]) return 'alto';
  return 'normal';
}

/** Obtiene el estilo visual de una categoría. */
export function categoriaEstilo(id) {
  return CATEGORIAS_ORDEN.find((c) => c.id === id) || CATEGORIAS_ORDEN[0];
}

/** Obtiene el estilo visual de un grupo. */
export function grupoEstilo(nombre) {
  return GRUPOS_ORDEN[nombre] || {};
}

/** Lista todos los estudios como array plano para búsqueda. */
export function todosLosExamenes() {
  const result = [];
  for (const [catId, grupos] of Object.entries(CATALOGO_EXAMENES)) {
    for (const grupo of grupos) {
      for (const est of grupo.estudios) {
        result.push({
          nombre: est.nombre,
          alias: est.alias || [],
          grupo: grupo.grupo,
          categoria: catId,
          tieneResultDef: !!buscarResultDef(est.nombre),
        });
      }
    }
  }
  return result;
}
