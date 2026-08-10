// ============================================================
// Datos de demostración para los módulos internos.
// Se usan como respaldo cuando el backend no está disponible,
// para poder visualizar y probar la interfaz sin servidor.
// ============================================================

const CEDULA_ACTIVA = '0912345678';

const RECETAS_DEMO = [
  {
    id: 1,
    codigo_receta: 'RX-2026-0892',
    paciente_cedula: CEDULA_ACTIVA,
    paciente_nombre: 'María González Pérez',
    medico: 'Dr. Carlos Ruiz',
    estado: 'PENDIENTE',
    fecha_emision: '06 Ago 2026 · 09:30',
    detalles: [
      {
        medicamento_id: 101,
        nombre_medicamento: 'Amoxicilina 500mg',
        cantidad_prescrita: 21,
        cantidad_despachada: 0,
        posologia: '1 cápsula cada 8 horas por 7 días.',
        categoria: 'Antibiótico',
        stock: 450,
      },
      {
        medicamento_id: 102,
        nombre_medicamento: 'Ibuprofeno 400mg',
        cantidad_prescrita: 10,
        cantidad_despachada: 0,
        posologia: '1 tableta cada 8 horas en caso de dolor.',
        categoria: 'Analgésico',
        stock: 120,
      },
    ],
  },
  {
    id: 2,
    codigo_receta: 'RX-2026-0901',
    paciente_cedula: '14302771',
    paciente_nombre: 'Francisco García Martos',
    medico: 'Dra. Laura Fernández',
    estado: 'PENDIENTE',
    fecha_emision: '06 Ago 2026 · 08:15',
    detalles: [
      {
        medicamento_id: 104,
        nombre_medicamento: 'Losartán 50mg',
        cantidad_prescrita: 30,
        cantidad_despachada: 0,
        posologia: '1 tableta cada 12 horas.',
        categoria: 'Antihipertensivo',
        stock: 340,
      },
    ],
  },
];

export const INVENTARIO_DEMO = [
  { nombre: 'Paracetamol 500mg', stock: 1200, stock_minimo: 150, vencimiento: 'Dic 2026', estado: 'OK' },
  { nombre: 'Amoxicilina 500mg', stock: 450, stock_minimo: 100, vencimiento: 'Ago 2027', estado: 'OK' },
  { nombre: 'Losartán 50mg', stock: 340, stock_minimo: 80, vencimiento: 'Mar 2027', estado: 'OK' },
  { nombre: 'Insulina NPH 100UI', stock: 12, stock_minimo: 40, vencimiento: 'Ene 2026', estado: 'CRITICO' },
  { nombre: 'Salbutamol 100mcg', stock: 26, stock_minimo: 30, vencimiento: 'Nov 2026', estado: 'BAJO' },
  { nombre: 'Ibuprofeno 400mg', stock: 18, stock_minimo: 40, vencimiento: 'Feb 2027', estado: 'BAJO' },
  { nombre: 'Enalapril 10mg', stock: 510, stock_minimo: 100, vencimiento: 'Jun 2027', estado: 'OK' },
];

// Catálogo de centros de salud (respaldo cuando el backend no responde).
export const CENTROS_DEMO = [
  {
    id: 1, nombre: 'Clínica del Niño', codigo: 'CLN-NINO', parroquia: 'El Carmen',
    direccion: 'Barcelona, Anzoátegui', subtitulo: 'Pediatría y crecimiento infantil',
    tipo: 'Especializada', horario: 'Lun - Sáb 7:00 AM - 6:00 PM',
    servicios: ['Pediatría', 'Vacunación', 'Nutrición Infantil'],
    logo: '/identidad visual/CliNiño.jpeg', fondoColor: '#00b4d8', activo: true,
  },
  {
    id: 2, nombre: 'Clínica de los Trabajadores (CITAB)', codigo: 'CLN-CITAB', parroquia: 'El Carmen',
    direccion: 'Barcelona, Anzoátegui', subtitulo: 'Clínica de los Trabajadores',
    tipo: 'Aliado', horario: 'Lun - Vie 7:00 AM - 6:00 PM',
    servicios: ['Medicina Laboral', 'Medicina General', 'Farmacia'],
    logo: '/identidad visual/Citab.jpeg', fondoColor: '#1d52d8', activo: true,
  },
  {
    id: 3, nombre: 'Clínica de la Mujer', codigo: 'CLN-MUJER', parroquia: 'San Cristóbal',
    direccion: 'Barcelona, Anzoátegui', subtitulo: 'Atención integral de la mujer',
    tipo: 'Especializada', horario: 'Lun - Sáb 7:00 AM - 5:00 PM',
    servicios: ['Ginecología', 'Obstetricia', 'Ecografía', 'Planificación'],
    logo: '/identidad visual/CliMujer.jpeg', fondoColor: '#541e8c', activo: true,
  },
  {
    id: 4, nombre: 'Centro Oncológico Municipal', codigo: 'CLN-ONCO', parroquia: 'El Carmen',
    direccion: 'Barcelona, Anzoátegui', subtitulo: 'Oncología y cuidados paliativos',
    tipo: 'Especializado', horario: 'Lun - Vie 7:00 AM - 5:00 PM',
    servicios: ['Oncología', 'Quimioterapia', 'Cuidados Paliativos'],
    logo: '/identidad visual/Oncologico.jpeg', fondoColor: '#6f42c1', activo: true,
  },
  {
    id: 5, nombre: 'Jornadas de Salud Móviles', codigo: 'CLN-JORNADAS', parroquia: 'General',
    direccion: 'Atención Itinerante - Municipio Simón Bolívar', subtitulo: 'Atención comunitaria itinerante',
    tipo: 'Comunitario', horario: 'Fines de semana · Calendario público',
    servicios: ['Atención Primaria', 'Vacunación', 'Despistaje'],
    logo: '/identidad visual/JornadasSaludBna.jpeg', fondoColor: '#0d9488', activo: true,
  },
];

export const COLA_DEMO = {
  espera: [
    {
      id: 'P-29384',
      nombre: 'Jordi Puigventós',
      prioridad: 'ALTA',
      espera: 45,
      perfil: {
        cedula: '24398451',
        edad: '62 años',
        alergia: 'Penicilina',
        antecedente: 'Hipertensión',
        motivo: 'Dolor torácico intermitente de 3 días',
      },
    },
    {
      id: 'P-28417',
      nombre: 'Marta Soler',
      prioridad: 'NORMAL',
      espera: 12,
      perfil: {
        cedula: '17234589',
        edad: '38 años',
        alergia: 'Sulfas',
        antecedente: 'Diabetes tipo 2',
        motivo: 'Control mensual de glicemia',
      },
    },
    {
      id: 'P-27692',
      nombre: 'Carme Vidal',
      prioridad: 'NORMAL',
      espera: 5,
      perfil: {
        cedula: '10456223',
        edad: '52 años',
        alergia: null,
        antecedente: 'Asma bronquial',
        motivo: 'Sibilancia y tos matinal',
      },
    },
  ],
  consulta: [],
  finalizado: 12,
};

// ============================================================
// Catálogo de exámenes y estudios para la orden médica.
// Cada estudio pertenece a una categoría (laboratorio/imagen/
// funcional) y a un grupo clínico para búsqueda y clasificación.
// ============================================================

export const CATALOGO_EXAMENES = {
  laboratorio: [
    {
      grupo: 'Hematología',
      icono: 'bloodtype',
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
      icono: 'science',
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
      icono: 'shield',
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
      icono: 'coronavirus',
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
      icono: 'water_drop',
      estudios: ['Parcial de orina (uroanálisis)', 'Microalbuminuria', 'Aclaramiento de creatinina'],
    },
    {
      grupo: 'Heces',
      icono: 'egg_alt',
      estudios: ['Coprológico (parasitológico)', 'Sangre oculta en heces', 'Coprocutivo'],
    },
  ],
  imagen: [
    {
      grupo: 'Radiología (Rayos X)',
      icono: 'image',
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
      icono: 'view_in_ar',
      estudios: ['TAC de cráneo', 'TAC de tórax', 'TAC de abdomen y pelvis', 'TAC de columna'],
    },
    {
      grupo: 'Resonancia magnética (RM)',
      icono: 'magnetic_field',
      estudios: ['RM de encéfalo', 'RM de columna', 'RM de rodilla / articulación'],
    },
    {
      grupo: 'Ecografía',
      icono: 'sensors',
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
      icono: 'monitor_heart',
      estudios: ['Electrocardiograma (ECG) de reposo', 'Ecocardiograma', 'Prueba de esfuerzo', 'Holter 24 horas'],
    },
    {
      grupo: 'Respiratorio',
      icono: 'air',
      estudios: ['Espirometría', 'Oximetría / gasometría arterial'],
    },
    {
      grupo: 'Neurológico',
      icono: 'psychiatry',
      estudios: ['Electroencefalograma (EEG)', 'Electromiografía (EMG)'],
    },
  ],
};

export const CIE10_DEMO = [
  { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)' },
  { codigo: 'I11', descripcion: 'Enfermedad cardíaca hipertensiva' },
  { codigo: 'I15', descripcion: 'Hipertensión secundaria' },
  { codigo: 'E11', descripcion: 'Diabetes mellitus tipo 2' },
  { codigo: 'J45', descripcion: 'Asma' },
  { codigo: 'J06', descripcion: 'Infección aguda de vías respiratorias superiores' },
  { codigo: 'A09', descripcion: 'Gastroenteritis y colitis de origen infeccioso' },
  { codigo: 'N39', descripcion: 'Infección de vías urinarias' },
  { codigo: 'K29', descripcion: 'Gastritis' },
  { codigo: 'M54', descripcion: 'Dorsalgia' },
];

const HISTORIAL_DEMO = {
  paciente: {
    nombre_completo: 'María González Pérez',
    cedula: CEDULA_ACTIVA,
    numero_historia: 'HIS-V0912345678',
    tipo_sangre: 'O+',
    alergias: ['Penicilina'],
    antecedentes_medicos: ['Hipertensión'],
    telefono: '0414-1234567',
  },
  total_consultas: 3,
  historial: [
    {
      consulta_id: 'c-001',
      fecha: '2026-05-14T10:00:00',
      especialidad: 'Medicina General',
      medico_nombre: 'Dr. Carlos Ruiz',
      cie10_codigo: 'J06',
      cie10_descripcion: 'Infección aguda de vías respiratorias',
      motivo_consulta: 'Odínofagia y fiebre de 38°C.',
      tratamiento: 'Paracetamol 500mg cada 8 horas por 5 días.',
      recetas: [{ nombre: 'Paracetamol 500mg', posologia: '1 tableta cada 8 horas por 5 días.' }],
    },
    {
      consulta_id: 'c-002',
      fecha: '2026-03-02T15:30:00',
      especialidad: 'Medicina General',
      medico_nombre: 'Dra. Laura Fernández',
      cie10_codigo: 'I10',
      cie10_descripcion: 'Hipertensión esencial',
      motivo_consulta: 'Control de tensión arterial.',
      tratamiento: 'Losartán 50mg cada 12 horas.',
      recetas: [{ nombre: 'Losartán 50mg', posologia: '1 tableta cada 12 horas.' }],
    },
  ],
};

// Recetas que "envían" los médicos del módulo de Doctores y que
// el módulo de Farmacia recibe como pendientes de despacho.
let pendientesStore = RECETAS_DEMO.map((r) => ({
  ...r,
  detalles: r.detalles.map((d) => ({ ...d })),
}));

// Órdenes de estudios emitidas por el módulo de Doctores.
// Persisten en memoria durante la sesión (respaldo sin backend).
let ordenesStore = [
  {
    id: 'ord-demo-1',
    comprobante_orden: 'ORD-2026-1001',
    paciente_cedula: CEDULA_ACTIVA,
    origen: 'consulta',
    estado: 'solicitada',
    prioridad: 'normal',
    medico_nombre: 'Dra. Laura Fernández',
    especialidad: 'Medicina General',
    estudios: [
      { tipo: 'laboratorio', nombre: 'Hemograma completo', parametros: [], estado: 'solicitado' },
      { tipo: 'laboratorio', nombre: 'Glucosa en ayunas', parametros: [], estado: 'solicitado' },
    ],
    created_at: new Date().toISOString(),
  },
];
let ordenSeq = 1002;

export const DEMO = {
  getCentros: async () => CENTROS_DEMO.map((c) => ({ ...c, servicios: [...c.servicios] })),
  buscarPaciente: async (cedula) => {
    if (cedula.replace(/\D/g, '') !== CEDULA_ACTIVA) throw new Error('Paciente no encontrado');
    return { id: 'hc-maria-gonzalez', ...HISTORIAL_DEMO.paciente };
  },
  buscarReceta: async (texto) => {
    const v = texto.trim().toLowerCase();
    if (!v) throw new Error('Ingrese un código o cédula.');
    const hit = RECETAS_DEMO.find(
      (r) =>
        r.codigo_receta.toLowerCase().includes(v.replace('#', '')) ||
        r.paciente_cedula.includes(v.replace(/[^\d]/g, ''))
    );
    if (!hit) throw new Error(`Sin resultados para "${texto}" en el registro de demostración.`);
    return { ...hit, detalles: hit.detalles.map((d) => ({ ...d })) };
  },
  despacharReceta: async (payload) => {
    pendientesStore = pendientesStore.filter((r) => r.id !== payload.receta_id);
    return {
      status: 'success',
      message: 'Despacho procesado e inventario actualizado con éxito',
      receta_id: payload.receta_id,
      medicamentos_despachados: payload.items.reduce((a, i) => a + i.cantidad_despachada, 0),
    };
  },
  recetasPendientes: async () =>
    pendientesStore.map((r) => ({ ...r, detalles: r.detalles.map((d) => ({ ...d })) })),
  getInventario: async () =>
    INVENTARIO_DEMO.map((m, i) => ({
      id: 200 + i,
      nombre: m.nombre,
      stock_actual: m.stock,
      stock_minimo: m.stock_minimo,
      unidad: 'caja',
      vencimiento: m.vencimiento,
      presentacion: m.estado,
    })),
  historialPaciente: async (cedula) => {
    if (cedula.replace(/\D/g, '') !== CEDULA_ACTIVA) throw new Error('Paciente no encontrado');
    return JSON.parse(JSON.stringify(HISTORIAL_DEMO));
  },
  crearConsulta: async (payload) => {
    if (payload.recetas && payload.recetas.length > 0) {
      const nueva = {
        id: Date.now(),
        codigo_receta: `RX-2026-${(902 + pendientesStore.length).toString().padStart(4, '0')}`,
        paciente_cedula: payload.paciente_cedula || CEDULA_ACTIVA,
        paciente_nombre: payload.paciente_nombre || 'Paciente registrado',
        medico: payload.medico_nombre || 'No asignado',
        estado: 'PENDIENTE',
        fecha_emision: new Date().toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        detalles: payload.recetas.map((r, i) => ({
          medicamento_id: 300 + i,
          nombre_medicamento: r.nombre,
          cantidad_prescrita: 10,
          cantidad_despachada: 0,
          posologia: r.posologia,
          categoria: 'Recetado',
        })),
      };
      pendientesStore = [nueva, ...pendientesStore];
    }
    return {
      id: `consulta-${Date.now()}`,
      comprobante_ref: `ABH-${10000 + Math.floor(Math.random() * 89999)}`,
    };
  },
  procesarEstudio: async (payload) => {
    const tipo = payload.tipo_estudio || 'laboratorio';
    if (tipo === 'imagen') {
      return {
        tipo_estudio: 'imagen',
        nombre: 'Radiografía de tórax',
        parametros: [],
        descripcion: 'Campos pulmonares sin infiltrados ni condensaciones. Silueta cardíaca de tamaño normal.',
        conclusion: 'Estudio dentro de parámetros normales.',
      };
    }
    if (tipo === 'funcional') {
      return {
        tipo_estudio: 'funcional',
        nombre: 'Electrocardiograma de reposo',
        parametros: [
          { parametro: 'Frecuencia cardíaca', valor: '72', unidad: 'lpm', rango: '60 - 100' },
          { parametro: 'Intervalo PR', valor: '0.16', unidad: 's', rango: '0.12 - 0.20' },
        ],
        conclusion: 'Ritmo sinusal normal, sin alteraciones de la repolarización.',
      };
    }
    return {
      tipo_estudio: 'laboratorio',
      nombre: 'Hemograma completo',
      parametros: [
        { parametro: 'Hemoglobina', valor: '14.2', unidad: 'g/dL', rango: '12.0 - 16.0' },
        { parametro: 'Hematocrito', valor: '42', unidad: '%', rango: '37 - 47' },
        { parametro: 'Leucocitos', valor: '7800', unidad: '/mm³', rango: '4500 - 11000' },
      ],
      conclusion: null,
    };
  },
  crearOrdenEstudios: async (payload) => {
    const cedula = payload.paciente_cedula || CEDULA_ACTIVA;
    const orden = {
      id: `ord-demo-${Date.now()}`,
      comprobante_orden: `ORD-2026-${ordenSeq++}`,
      paciente_id: payload.paciente_id || 'hc-demo',
      paciente_cedula: cedula,
      origen: payload.origen || 'consulta',
      estado: 'solicitada',
      prioridad: payload.prioridad || 'normal',
      medico_nombre: payload.medico_nombre || '',
      especialidad: payload.especialidad || 'Medicina General',
      estudios: (payload.estudios || []).map((e) => ({ ...e, estado: 'solicitado' })),
      created_at: new Date().toISOString(),
    };
    ordenesStore = [orden, ...ordenesStore];
    return { ...orden };
  },
  ordenesPaciente: async (pacienteId) => {
    const cedula = pacienteId === 'hc-maria-gonzalez' ? CEDULA_ACTIVA : (pacienteId || '');
    return ordenesStore
      .filter((o) => o.paciente_id === pacienteId || o.paciente_cedula === cedula)
      .map((o) => ({ ...o, estudios: o.estudios.map((e) => ({ ...e })) }));
  },
  registrarResultadosOrden: async (ordenId, payload) => {
    const estudios = (payload.estudios || []).map((e) => ({ ...e, estado: 'completado' }));
    ordenesStore = ordenesStore.map((o) =>
      o.id === ordenId
        ? { ...o, estudios, estado: 'con_resultados', resultados_at: new Date().toISOString() }
        : o
    );
    const actual = ordenesStore.find((o) => o.id === ordenId);
    if (!actual) throw new Error('Orden no encontrada');
    return { ...actual };
  },
};
