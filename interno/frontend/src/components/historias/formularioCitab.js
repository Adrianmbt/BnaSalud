// Estructura del formato CITAB (Historia Clínica Integral).
// Se usa para renderizar el formulario y para el reporte en PDF.

export const SECCIONES_CITAB = [
  {
    id: 'identificacion',
    titulo: 'Identificación',
    descripcion: 'Datos personales y de residencia del paciente.',
    campos: [
      { key: 'numero_carpeta', label: 'N° de carpeta', tipo: 'text' },
      { key: 'apellidos_familia', label: 'Apellidos de la familia', tipo: 'text' },
      { key: 'cargo', label: 'Cargo', tipo: 'text' },
      { key: 'apellidos', label: 'Apellidos', tipo: 'text', requerido: true },
      { key: 'nombres', label: 'Nombres', tipo: 'text', requerido: true },
      { key: 'edad', label: 'Edad', tipo: 'number' },
      {
        key: 'sexo',
        label: 'Sexo',
        tipo: 'select',
        opciones: [
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Femenino' },
        ],
      },
      {
        key: 'estado_civil',
        label: 'Estado civil',
        tipo: 'select',
        opciones: [
          { value: 'S', label: 'Soltero/a' },
          { value: 'C', label: 'Casado/a' },
          { value: 'V', label: 'Viudo/a' },
          { value: 'D', label: 'Divorciado/a' },
          { value: 'O', label: 'Otro' },
        ],
      },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', tipo: 'date' },
      { key: 'lugar_nacimiento', label: 'Lugar de nacimiento', tipo: 'text' },
      { key: 'estado', label: 'Estado', tipo: 'text' },
      { key: 'pais', label: 'País', tipo: 'text' },
      { key: 'ocupacion', label: 'Ocupación', tipo: 'text' },
      {
        key: 'estudios',
        label: 'Estudios',
        tipo: 'select',
        opciones: [
          { value: 'P', label: 'Primaria' },
          { value: 'S', label: 'Secundaria' },
          { value: 'U', label: 'Universitaria' },
          { value: 'O', label: 'Otro' },
        ],
      },
      { key: 'anos_aprobados', label: 'Años aprobados', tipo: 'number' },
      { key: 'iletrado', label: 'Iletrado', tipo: 'bool' },
      { key: 'municipio', label: 'Municipio', tipo: 'text' },
      { key: 'parroquia', label: 'Parroquia', tipo: 'text' },
      { key: 'telefono', label: 'Teléfono', tipo: 'text' },
      { key: 'religion', label: 'Religión', tipo: 'text' },
      { key: 'direccion', label: 'Dirección', tipo: 'textarea', ancho: 'full' },
      { key: 'comuna', label: 'Comuna', tipo: 'text' },
      { key: 'comunidad', label: 'Comunidad', tipo: 'text' },
      { key: 'etnia', label: 'Etnia', tipo: 'text' },
    ],
  },
  {
    id: 'antecedentes_personales',
    titulo: 'Antecedentes personales',
    descripcion: 'Antecedentes personales a cualquier edad (1.1 – 1.17).',
    campos: [
      { key: 'carnet_prenatal', label: '1.1 Carnet prenatal', tipo: 'bool' },
      { key: 'horas_fuera_casa', label: 'Horas fuera de casa', tipo: 'number' },
      { key: 'patologia_embarazo', label: '1.2 Patología del embarazo', tipo: 'bool' },
      { key: 'patologia_parto', label: '1.3 Patología del parto', tipo: 'bool' },
      { key: 'patologia_puerperio', label: '1.4 Patología del puerperio', tipo: 'bool' },
      { key: 'n_consultas_prenatales', label: '1.5 N° consultas prenatales', tipo: 'number' },
      { key: 'edad_gestacional_semanas', label: '1.6 Edad gestacional (semanas)', tipo: 'number' },
      { key: 'forceps', label: '1.7 Forceps', tipo: 'bool' },
      { key: 'cesarea', label: '1.8 Cesárea', tipo: 'bool' },
      { key: 'parto', label: '1.9 Parto', tipo: 'bool' },
      { key: 'peso_nacer_gr', label: '1.10 Peso al nacer (gr)', tipo: 'number' },
      { key: 'talla_cm', label: '1.11 Talla (cm)', tipo: 'number' },
      { key: 'circunferencia_cefalica_cm', label: '1.12 Circunferencia cefálica (cm)', tipo: 'number' },
      { key: 'apgar_min_1', label: '1.13 APGAR 1 min', tipo: 'number' },
      { key: 'apgar_min_5', label: '1.13 APGAR 5 min', tipo: 'number' },
      { key: 'asfixia', label: '1.14 Asfixia', tipo: 'bool' },
      { key: 'reanimacion', label: '1.15 Reanimación', tipo: 'bool' },
      { key: 'patologia_rn', label: '1.16 Patología del R.N.', tipo: 'bool' },
      {
        key: 'egreso_rn',
        label: '1.17 Egreso del R.N.',
        tipo: 'select',
        opciones: [
          { value: 'sano', label: 'Sano' },
          { value: 'patologico', label: 'Patológico' },
        ],
      },
      { key: 'lactancia_exclusiva_m', label: 'Lactancia exclusiva (meses)', tipo: 'number' },
      { key: 'lactancia_mixta_m', label: 'Lactancia mixta (meses)', tipo: 'number' },
      { key: 'ablactacion_m', label: 'Ablactación (meses)', tipo: 'number' },
    ],
  },
  {
    id: 'antecedentes_familiares',
    titulo: 'Antecedentes familiares',
    descripcion: 'Antecedentes familiares y otros contactos (2.1 – 2.19).',
    campos: [
      { key: 'alergias', label: '2.1 Alergias', tipo: 'bool' },
      { key: 'asma', label: '2.2 Asma', tipo: 'bool' },
      { key: 'tuberculosis', label: '2.3 T.B.C.', tipo: 'bool' },
      { key: 'cardiopatia', label: '2.4 Cardiopatía', tipo: 'bool' },
      { key: 'hipertension', label: '2.5 Hipertensión', tipo: 'bool' },
      { key: 'varices', label: '2.6 Varices', tipo: 'bool' },
      { key: 'desnutricion', label: '2.7 Desnutrición', tipo: 'bool' },
      { key: 'diabetes', label: '2.8 Diabetes', tipo: 'bool' },
      { key: 'obesidad', label: '2.9 Obesidad', tipo: 'bool' },
      { key: 'gastropatia', label: '2.10 Gastropatía', tipo: 'bool' },
      { key: 'neurologica', label: '2.11 Neurológica', tipo: 'bool' },
      { key: 'enfermedad_renal', label: '2.12 Enfermedad renal', tipo: 'bool' },
      { key: 'cancer', label: '2.13 Cáncer', tipo: 'bool' },
      { key: 'alcohol', label: '2.14 Alcohol', tipo: 'bool' },
      { key: 'drogas', label: '2.15 Drogas', tipo: 'bool' },
      { key: 'sifilis', label: '2.16 Sífilis', tipo: 'bool' },
      { key: 'sida', label: '2.17 SIDA', tipo: 'bool' },
      { key: 'artritis', label: '2.18 Artritis', tipo: 'bool' },
      { key: 'otros_padre', label: '2.19 Otros – Padre', tipo: 'text' },
      { key: 'otros_madre', label: '2.19 Otros – Madre', tipo: 'text' },
      { key: 'otros_hermanos', label: '2.19 Otros – Hermanos', tipo: 'text' },
      { key: 'otros_familiares', label: '2.19 Otros – Otros familiares', tipo: 'text', ancho: 'full' },
    ],
  },
  {
    id: 'sexualidad',
    titulo: 'Sexualidad y obstetricia',
    descripcion: 'Antecedentes sexuales, anticoncepción y obstetricia (3.1 – 3.18).',
    campos: [
      { key: 'menarquia', label: '3.1 Menarquia', tipo: 'text' },
      { key: 'ciclo_menstrual', label: '3.2 Ciclo menstrual', tipo: 'text' },
      { key: 'primera_relacion_sexual', label: '3.3 P.R. sexual', tipo: 'text' },
      { key: 'frecuencia_relacion_sexual', label: '3.4 Frec. R. sexual', tipo: 'text' },
      { key: 'n_parejas', label: '3.5 N° parejas', tipo: 'number' },
      { key: 'dispareunia', label: '3.6 Dispareunia', tipo: 'bool' },
      { key: 'anticoncepcion', label: '3.7 Anticoncepción', tipo: 'text' },
      {
        key: 'metodo_anticonceptivo',
        label: 'Método anticonceptivo',
        tipo: 'select',
        opciones: [
          { value: 'ACO', label: 'ACO' },
          { value: 'DIU', label: 'DIU' },
          { value: 'OTRO', label: 'Otro' },
        ],
      },
      { key: 'menopausia_andropausia', label: '3.8 Menopausia / andropausia', tipo: 'bool' },
      { key: 'gestas', label: '3.9 Gestas', tipo: 'number' },
      { key: 'partos', label: '3.10 Partos', tipo: 'number' },
      { key: 'cesareas', label: '3.11 Cesáreas', tipo: 'number' },
      { key: 'abortos', label: '3.12 Abortos', tipo: 'number' },
      { key: 'primer_parto', label: '3.13 1er parto', tipo: 'text' },
      { key: 'fu_parto', label: '3.14 F.U. parto', tipo: 'text' },
      { key: 'fu_aborto', label: '3.15 F.U. aborto', tipo: 'text' },
      { key: 'curetaje', label: '3.16 Curetaje', tipo: 'bool' },
      { key: 'n_hijos', label: '3.17 N° hijos', tipo: 'number' },
      { key: 'hijos_vivos', label: '3.17.1 Vivos', tipo: 'number' },
      { key: 'hijos_muertos', label: '3.17.2 Muertos', tipo: 'number' },
      { key: 'peso_ultimo_hijo', label: '3.18 Peso último hijo', tipo: 'text' },
    ],
  },
  {
    id: 'patologia_personal',
    titulo: 'Patología personal',
    descripcion: 'Antecedentes patológicos personales (3.19 – 3.52).',
    campos: [
      { key: 'alergias_personales', label: '3.19 Alergias', tipo: 'bool' },
      { key: 'asma_personal', label: '3.20 Asma', tipo: 'bool' },
      { key: 'neumonia', label: '3.21 Neumonía', tipo: 'bool' },
      { key: 'tuberculosis_personal', label: '3.22 T.B.C.', tipo: 'bool' },
      { key: 'cardiopatia_personal', label: '3.23 Cardiopatía', tipo: 'bool' },
      { key: 'hipertension_personal', label: '3.24 Hipertensión', tipo: 'bool' },
      { key: 'dislipidemias', label: '3.25 Dislipidemias', tipo: 'bool' },
      { key: 'varices_personal', label: '3.26 Varices', tipo: 'bool' },
      { key: 'cardiopatia_chagas', label: '3.27 Cardiopatía de Chagas', tipo: 'bool' },
      { key: 'hepatopatia', label: '3.28 Hepatopatía', tipo: 'bool' },
      { key: 'desnutricion_personal', label: '3.29 Desnutrición', tipo: 'bool' },
      { key: 'diabetes_personal', label: '3.30 Diabetes', tipo: 'bool' },
      { key: 'obesidad_personal', label: '3.31 Obesidad', tipo: 'bool' },
      { key: 'gastroenteritis', label: '3.32 Gastroenteritis', tipo: 'bool' },
      { key: 'ecoprexis', label: '3.33 Ecoprexis', tipo: 'bool' },
      { key: 'enfermedad_renal_personal', label: '3.34 Enfermedad renal', tipo: 'bool' },
      { key: 'enorexis', label: '3.35 Enorexis', tipo: 'bool' },
      { key: 'cancer_personal', label: '3.36 Cáncer', tipo: 'bool' },
      { key: 'tromboembolismo', label: '3.37 Tromboembolismo', tipo: 'bool' },
      { key: 'tumor_mamario', label: '3.38 Tumor mamario', tipo: 'bool' },
      { key: 'meningitis', label: '3.39 Meningitis', tipo: 'bool' },
      { key: 'trauma_craneoencefalico', label: '3.40 T. craneoencefálico', tipo: 'bool' },
      { key: 'enfermedades_eruptivas', label: '3.41 Enfermedades eruptivas', tipo: 'bool' },
      { key: 'dengue', label: '3.42 Dengue', tipo: 'bool' },
      { key: 'hospitalizacion', label: '3.43 Hospitalización', tipo: 'bool' },
      { key: 'intervencion_quirurgica', label: '3.44 Interv. quirúrgica', tipo: 'bool' },
      { key: 'accidentes', label: '3.45 Accidentes', tipo: 'bool' },
      { key: 'artritis_personal', label: '3.46 Artritis', tipo: 'bool' },
      { key: 'infeccion_transmision_sexual', label: '3.47 Inf. T.S.', tipo: 'bool' },
      { key: 'enfermedades_infecciosas', label: '3.48 Enf. inf. y trans.', tipo: 'bool' },
      { key: 'enfermedad_laboral', label: '3.49 Enf. laboral', tipo: 'bool' },
      { key: 'malaria', label: '3.50 Malaria', tipo: 'bool' },
      { key: 'hansen_leishmaniasis', label: '3.51 Hansen y leishmaniasis', tipo: 'bool' },
      { key: 'otros_patologia', label: '3.52 Otros', tipo: 'text', ancho: 'full' },
    ],
  },
  {
    id: 'factores_riesgo',
    titulo: 'Factores de riesgo',
    descripcion: 'Hábitos psicobiológicos y factores de riesgo (3.53 – 3.66).',
    campos: [
      { key: 'alcohol_riesgo', label: '3.53 Alcohol', tipo: 'bool' },
      { key: 'drogas_riesgo', label: '3.54 Drogas', tipo: 'bool' },
      { key: 'insecticidas', label: '3.55 Insecticidas', tipo: 'bool' },
      { key: 'deportes', label: '3.56 Deportes', tipo: 'bool' },
      { key: 'sedentarismo', label: '3.57 Sedentarismo', tipo: 'bool' },
      { key: 'sueno', label: '3.58 Sueño', tipo: 'text' },
      { key: 'chupa_dedo', label: '3.59 Chupa dedo', tipo: 'bool' },
      { key: 'onicofagia', label: '3.60 Onicofagia', tipo: 'bool' },
      { key: 'micciones', label: '3.61 Micciones', tipo: 'text' },
      { key: 'evacuaciones', label: '3.62 Evacuaciones', tipo: 'text' },
      { key: 'estres', label: '3.63 Estrés', tipo: 'text' },
      { key: 'metales_pesados', label: '3.64 Metales pesados', tipo: 'bool' },
      { key: 'alimentacion', label: '3.65 Alimentación', tipo: 'text' },
      { key: 'fuma', label: '3.66 Fuma', tipo: 'bool' },
      { key: 'n_cigarrillos_diarios', label: 'N° cigarrillos diarios', tipo: 'number' },
    ],
  },
  {
    id: 'observaciones',
    titulo: 'Observaciones',
    descripcion: 'Notas adicionales del profesional.',
    campos: [
      {
        key: 'observaciones',
        label: 'Observaciones',
        tipo: 'textarea',
        ancho: 'full',
        filas: 6,
      },
    ],
  },
];

const esObjeto = (valor) => valor && typeof valor === 'object' && !Array.isArray(valor);

/** Construye la ficha vacía respetando la estructura de secciones. */
export function crearDatosVacios() {
  const datos = {};
  SECCIONES_CITAB.forEach((seccion) => {
    datos[seccion.id] = {};
    seccion.campos.forEach((campo) => {
      datos[seccion.id][campo.key] = campo.tipo === 'bool' ? null : '';
    });
  });
  return datos;
}

/** Mezcla los datos guardados con la estructura actual (tolera claves nuevas). */
export function normalizarDatos(datosGuardados) {
  const base = crearDatosVacios();
  if (!esObjeto(datosGuardados)) return base;

  Object.keys(base).forEach((seccionId) => {
    const guardada = datosGuardados[seccionId];
    if (esObjeto(guardada)) {
      Object.keys(guardada).forEach((key) => {
        base[seccionId][key] = guardada[key];
      });
    }
  });

  // Claves antiguas o libres que no estén en la estructura se conservan.
  Object.keys(datosGuardados).forEach((seccionId) => {
    if (!base[seccionId] && datosGuardados[seccionId] !== undefined) {
      base[seccionId] = datosGuardados[seccionId];
    }
  });
  return base;
}

/** Devuelve la etiqueta legible de un campo. */
export function etiquetaCampo(seccionId, key) {
  const seccion = SECCIONES_CITAB.find((s) => s.id === seccionId);
  const campo = seccion?.campos.find((c) => c.key === key);
  return campo?.label || key;
}

/** Valor legible para mostrar en tablas o PDF. */
export function valorLegible(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (campo?.tipo === 'bool') return valor ? 'SÍ' : 'NO';
  if (campo?.tipo === 'select') {
    const opcion = (campo.opciones || []).find((o) => o.value === valor);
    return opcion?.label || String(valor);
  }
  return String(valor);
}

/** Cuenta cuántos campos tienen algún valor (para el indicador de avance). */
export function contarCamposCompletos(datos) {
  let total = 0;
  let completos = 0;
  SECCIONES_CITAB.forEach((seccion) => {
    seccion.campos.forEach((campo) => {
      total += 1;
      const valor = datos?.[seccion.id]?.[campo.key];
      if (valor !== null && valor !== undefined && String(valor).trim() !== '') completos += 1;
    });
  });
  return { total, completos, porcentaje: total ? Math.round((completos / total) * 100) : 0 };
}
