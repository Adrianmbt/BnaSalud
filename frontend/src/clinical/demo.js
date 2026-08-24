// ============================================================
// Datos de demostración para los módulos internos de BnaSalud.
// Se usan como respaldo cuando el backend no está disponible,
// para poder visualizar y probar la interfaz sin servidor.
//
// SEMILLA DEMO:
//   • PACIENTES_DEMO → 4 pacientes con su historia clínica,
//     citas, órdenes y médico tratante. PIN por defecto: 1234.
//   • DOCTORES_DEMO  → 4 doctores con credenciales de acceso
//     (usuario + clave 1234) y su cola de pacientes.
//   • FARMACIA_DEMO  → personal de farmacia con credenciales
//     (clave 1234): jefe_farmacia gestiona el stock; el
//     farmaceutico solo despacha y entrega recetas.
//   • La "persona activa" se alterna con el panel Modo Demo
//     (componente DemoSwitcher) y se persiste en localStorage.
// ============================================================

export const PIN_POR_DEFECTO = '1234';
const PERSONA_CLAVE = 'bna_persona_demo';
const CEDULA_ACTIVA = '0912345678';

export function getPersonaDemo() {
  try {
    const crudo = localStorage.getItem(PERSONA_CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function setPersonaDemo(persona) {
  try {
    if (persona) localStorage.setItem(PERSONA_CLAVE, JSON.stringify(persona));
    else localStorage.removeItem(PERSONA_CLAVE);
  } catch {
    /* sin almacenamiento */
  }
}

// ============================================================
// Pacientes de la semilla (perfil + historia clínica completa)
// ============================================================

export const PACIENTES_DEMO = [
  {
    perfil: {
      id: 'hc-maria-gonzalez',
      numero_historia: 'HIS-V0912345678',
      tipo_cedula: 'V',
      cedula: '0912345678',
      nombre_completo: 'María González Pérez',
      fecha_nacimiento: '1990-04-12',
      telefono: '0414-1234567',
      email: 'maria.gonzalez@correo.com',
      tipo_sangre: 'O+',
      alergias: ['Penicilina'],
      antecedentes_medicos: ['Hipertensión'],
    },
    pin: PIN_POR_DEFECTO,
    historial: [
      {
        consulta_id: 'c-001',
        fecha: '2026-05-14T10:00:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dr. Carlos Ruiz',
        cie10_codigo: 'J06',
        cie10_descripcion: 'Infección aguda de vías respiratorias superiores',
        motivo_consulta: 'Odínofagia y fiebre de 38°C.',
        tratamiento: 'Paracetamol 500mg cada 8 horas por 5 días.',
        recetas: [{ nombre: 'Paracetamol 500mg', posologia: '1 tableta cada 8 horas por 5 días.' }],
        recomendaciones: 'Hidratación abundante y reposo relativo.',
      },
      {
        consulta_id: 'c-002',
        fecha: '2026-03-02T15:30:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dra. Laura Fernández',
        cie10_codigo: 'I10',
        cie10_descripcion: 'Hipertensión esencial (primaria)',
        motivo_consulta: 'Control de tensión arterial.',
        tratamiento: 'Losartán 50mg cada 12 horas.',
        recetas: [{ nombre: 'Losartán 50mg', posologia: '1 tableta cada 12 horas.' }],
      },
      {
        consulta_id: 'c-003',
        fecha: '2026-08-12T09:10:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dra. Laura Fernández',
        cie10_codigo: 'I10',
        cie10_descripcion: 'Hipertensión esencial (primaria)',
        motivo_consulta: 'Seguimiento de presión arterial y solicitud de exámenes de rutina.',
        examen_fisico: 'PA 128/82 mmHg, FC 74 lpm. Consciente, orientada, sin déficit.',
        tratamiento: 'Losartán 50mg cada 12 horas · se ordena hemograma y glucosa.',
        recetas: [{ nombre: 'Losartán 50mg', posologia: '1 tableta cada 12 horas.' }],
        estudios: [
          { tipo: 'laboratorio', nombre: 'Hemograma completo', parametros: [], estado: 'solicitado' },
          { tipo: 'laboratorio', nombre: 'Glucosa en ayunas', parametros: [], estado: 'solicitado' },
        ],
        recomendaciones: 'Dieta baja en sodio y control de peso.',
      },
    ],
    citas: [
      {
        id: 'cita-demo-1',
        codigo_confirmacion: 'CITAB-2026-8F1A',
        centro_id: 2,
        centro_salud: 'Clínica de los Trabajadores (CITAB)',
        especialidad_id: 101,
        especialidad: 'Medicina General',
        fecha_cita: '2026-08-20',
        hora_inicio: '09:30:00',
        motivo: 'Control de rutina',
        estado: 'confirmada',
        origen: 'cita_web',
        paciente_id: 'hc-maria-gonzalez',
        paciente_nombre: 'María González Pérez',
      },
      {
        id: 'cita-demo-2',
        codigo_confirmacion: 'CITAB-2026-4C92',
        centro_id: 2,
        centro_salud: 'Clínica de los Trabajadores (CITAB)',
        especialidad_id: 101,
        especialidad: 'Medicina General',
        fecha_cita: '2026-08-12',
        hora_inicio: '08:00:00',
        motivo: 'Seguimiento de presión arterial',
        estado: 'completada',
        origen: 'cita_web',
        paciente_id: 'hc-maria-gonzalez',
        paciente_nombre: 'María González Pérez',
      },
    ],
    ordenes: [
      {
        id: 'ord-demo-1',
        comprobante_orden: 'ORD-2026-1001',
        paciente_cedula: '0912345678',
        origen: 'consulta',
        estado: 'solicitada',
        prioridad: 'normal',
        medico_nombre: 'Dra. Laura Fernández',
        especialidad: 'Medicina General',
        estudios: [
          { tipo: 'laboratorio', nombre: 'Hemograma completo', parametros: [], estado: 'solicitado' },
          { tipo: 'laboratorio', nombre: 'Glucosa en ayunas', parametros: [], estado: 'solicitado' },
        ],
      },
    ],
    medicoTratante: {
      medico_id: 1043,
      nombre: 'Dra. Laura Fernández',
      especialidad: 'Medicina General',
      tipo: 'principal',
      estado: 'activo',
    },
  },
  {
    perfil: {
      id: 'hc-francisco-garcia',
      numero_historia: 'HIS-V14302771',
      tipo_cedula: 'V',
      cedula: '14302771',
      nombre_completo: 'Francisco García Martos',
      fecha_nacimiento: '1964-07-03',
      telefono: '0424-5566778',
      email: 'francisco.garcia@correo.com',
      tipo_sangre: 'B+',
      alergias: ['Penicilina'],
      antecedentes_medicos: ['Hipertensión', 'Dislipidemia'],
    },
    pin: PIN_POR_DEFECTO,
    historial: [
      {
        consulta_id: 'f-001',
        fecha: '2026-07-20T11:00:00',
        especialidad: 'Cardiología',
        medico_nombre: 'Dr. Antonio Valera',
        cie10_codigo: 'I10',
        cie10_descripcion: 'Hipertensión esencial (primaria)',
        motivo_consulta: 'Control cardiovascular trimestral.',
        examen_fisico: 'PA 142/90 mmHg, FC 78 lpm. Soplo sistólico leve en foco aórtico.',
        tratamiento: 'Losartán 50mg cada 12 horas.',
        recetas: [{ nombre: 'Losartán 50mg', posologia: '1 tableta cada 12 horas.' }],
        recomendaciones: 'Evitar el consumo de sal y mantener actividad física moderada.',
      },
      {
        consulta_id: 'f-002',
        fecha: '2026-04-11T09:30:00',
        especialidad: 'Cardiología',
        medico_nombre: 'Dr. Antonio Valera',
        cie10_codigo: 'E78.5',
        cie10_descripcion: 'Hiperlipidemia no especificada',
        motivo_consulta: 'Resultados de perfil lipídico elevados.',
        tratamiento: 'Atorvastatina 20mg en la noche.',
        recetas: [{ nombre: 'Atorvastatina 20mg', posologia: '1 tableta en la noche.' }],
        estudios: [
          { tipo: 'laboratorio', nombre: 'Perfil lipídico', parametros: [], estado: 'solicitado' },
        ],
      },
    ],
    citas: [
      {
        id: 'cita-demo-3',
        codigo_confirmacion: 'CITAB-2026-3B7C',
        centro_id: 2,
        centro_salud: 'Clínica de los Trabajadores (CITAB)',
        especialidad_id: 104,
        especialidad: 'Cardiología',
        fecha_cita: '2026-08-19',
        hora_inicio: '10:00:00',
        motivo: 'Control cardiovascular',
        estado: 'confirmada',
        origen: 'cita_web',
        paciente_id: 'hc-francisco-garcia',
        paciente_nombre: 'Francisco García Martos',
      },
    ],
    ordenes: [
      {
        id: 'ord-demo-2',
        comprobante_orden: 'ORD-2026-1002',
        paciente_cedula: '14302771',
        origen: 'consulta',
        estado: 'solicitada',
        prioridad: 'normal',
        medico_nombre: 'Dr. Antonio Valera',
        especialidad: 'Cardiología',
        estudios: [
          { tipo: 'laboratorio', nombre: 'Perfil lipídico', parametros: [], estado: 'solicitado' },
          { tipo: 'funcional', nombre: 'Electrocardiograma (ECG) de reposo', parametros: [], estado: 'solicitado' },
        ],
      },
    ],
    medicoTratante: {
      medico_id: 11111111,
      nombre: 'Dr. Antonio Valera',
      especialidad: 'Cardiología',
      tipo: 'principal',
      estado: 'activo',
    },
  },
  {
    perfil: {
      id: 'hc-ana-torres',
      numero_historia: 'HIS-V24567890',
      tipo_cedula: 'V',
      cedula: '24567890',
      nombre_completo: 'Ana Torres Díaz',
      fecha_nacimiento: '1998-01-25',
      telefono: '0416-8899001',
      email: 'ana.torres@correo.com',
      tipo_sangre: 'A-',
      alergias: [],
      antecedentes_medicos: ['Asma', 'Diabetes gestacional'],
    },
    pin: PIN_POR_DEFECTO,
    historial: [
      {
        consulta_id: 'a-001',
        fecha: '2026-06-30T08:30:00',
        especialidad: 'Ginecología',
        medico_nombre: 'Dra. Luisa Pérez',
        cie10_codigo: 'O24',
        cie10_descripcion: 'Diabetes mellitus en el embarazo',
        motivo_consulta: 'Control prenatal y despistaje de diabetes gestacional.',
        examen_fisico: 'AU 28 cm, FCF 142 lpm, TA 110/70 mmHg.',
        tratamiento: 'Control de glicemia en ayunas y posprandial.',
        recetas: [],
        recomendaciones: 'Dieta balanceada y consulta de nutrición.',
      },
      {
        consulta_id: 'a-002',
        fecha: '2026-02-10T14:00:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dr. Pedro Sánchez',
        cie10_codigo: 'J45',
        cie10_descripcion: 'Asma',
        motivo_consulta: 'Crisis de sibilancia leve tras ejercicio.',
        tratamiento: 'Salbutamol inhalador a demanda.',
        recetas: [{ nombre: 'Salbutamol 100mcg', posologia: '2 inhalaciones a demanda.' }],
      },
    ],
    citas: [
      {
        id: 'cita-demo-4',
        codigo_confirmacion: 'MUJER-2026-9D2E',
        centro_id: 3,
        centro_salud: 'Clínica de la Mujer',
        especialidad_id: 103,
        especialidad: 'Ginecología',
        fecha_cita: '2026-08-22',
        hora_inicio: '09:00:00',
        motivo: 'Control prenatal',
        estado: 'confirmada',
        origen: 'cita_web',
        paciente_id: 'hc-ana-torres',
        paciente_nombre: 'Ana Torres Díaz',
      },
    ],
    ordenes: [
      {
        id: 'ord-demo-3',
        comprobante_orden: 'ORD-2026-1003',
        paciente_cedula: '24567890',
        origen: 'consulta',
        estado: 'con_resultados',
        prioridad: 'normal',
        medico_nombre: 'Dra. Luisa Pérez',
        especialidad: 'Ginecología',
        estudios: [
          {
            tipo: 'imagen',
            nombre: 'Ecografía obstétrica',
            parametros: [],
            descripcion: 'Feto único en presentación cefálica, latidos presentes, placenta anterior.',
            conclusion: 'Estudio dentro de parámetros normales para la edad gestacional.',
            estado: 'completado',
          },
        ],
      },
    ],
    medicoTratante: {
      medico_id: 33333333,
      nombre: 'Dra. Luisa Pérez',
      especialidad: 'Ginecología',
      tipo: 'principal',
      estado: 'activo',
    },
  },
  {
    perfil: {
      id: 'hc-rosa-martinez',
      numero_historia: 'HIS-V16892345',
      tipo_cedula: 'V',
      cedula: '16892345',
      nombre_completo: 'Rosa Martínez Soto',
      fecha_nacimiento: '1981-09-17',
      telefono: '0412-3344556',
      email: 'rosa.martinez@correo.com',
      tipo_sangre: 'O-',
      alergias: ['Sulfamidas'],
      antecedentes_medicos: ['Diabetes tipo 2'],
    },
    pin: PIN_POR_DEFECTO,
    historial: [
      {
        consulta_id: 'r-001',
        fecha: '2026-07-02T10:30:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dr. Pedro Sánchez',
        cie10_codigo: 'E11',
        cie10_descripcion: 'Diabetes mellitus tipo 2',
        motivo_consulta: 'Control de glicemia y revisión de tratamiento.',
        examen_fisico: 'Glicemia capilar 148 mg/dL. IMC 27.5.',
        tratamiento: 'Metformina 850mg cada 12 horas.',
        recetas: [{ nombre: 'Metformina 850mg', posologia: '1 tableta cada 12 horas con alimentos.' }],
        recomendaciones: 'Chequeo de hemoglobina glicosilada en 3 meses.',
      },
      {
        consulta_id: 'r-002',
        fecha: '2026-02-18T09:00:00',
        especialidad: 'Medicina General',
        medico_nombre: 'Dr. Ramón Díaz',
        cie10_codigo: 'M54',
        cie10_descripcion: 'Dorsalgia',
        motivo_consulta: 'Dolor lumbar de esfuerzo.',
        tratamiento: 'Ibuprofeno 400mg cada 8 horas por 5 días.',
        recetas: [{ nombre: 'Ibuprofeno 400mg', posologia: '1 tableta cada 8 horas en caso de dolor.' }],
      },
    ],
    citas: [
      {
        id: 'cita-demo-5',
        codigo_confirmacion: 'CITAB-2026-2A5B',
        centro_id: 2,
        centro_salud: 'Clínica de los Trabajadores (CITAB)',
        especialidad_id: 101,
        especialidad: 'Medicina General',
        fecha_cita: '2026-08-25',
        hora_inicio: '08:30:00',
        motivo: 'Control de diabetes',
        estado: 'pendiente',
        origen: 'cita_web',
        paciente_id: 'hc-rosa-martinez',
        paciente_nombre: 'Rosa Martínez Soto',
      },
    ],
    ordenes: [],
    medicoTratante: {
      medico_id: 55555555,
      nombre: 'Dr. Pedro Sánchez',
      especialidad: 'Medicina General',
      tipo: 'principal',
      estado: 'activo',
    },
  },
];

function pacientePorCedula(cedula) {
  return PACIENTES_DEMO.find((p) => p.perfil.cedula === String(cedula || '').replace(/\D/g, ''));
}

function pacientePorId(id) {
  return PACIENTES_DEMO.find((p) => p.perfil.id === id || p.perfil.cedula === id);
}

// ============================================================
// Doctores de la semilla (credenciales + cola de pacientes)
// Clave de acceso por defecto: 1234
// ============================================================

export const DOCTORES_DEMO = [
  {
    username: 'lfernandez',
    password: PIN_POR_DEFECTO,
    rol: 'medico',
    nombre: 'Dra. Laura Fernández',
    especialidad: 'Medicina General',
    clinica_id: 2,
    personal_id: 1043,
    cola: {
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
      finalizado: [
        { id: 'P-31001', nombre: 'María González Pérez', prioridad: 'NORMAL', cedula: '0912345678', hora: '08:12' },
        { id: 'P-31002', nombre: 'Francisco García Martos', prioridad: 'ALTA', cedula: '14302771', hora: '08:47' },
      ],
    },
  },
  {
    username: 'avalera',
    password: PIN_POR_DEFECTO,
    rol: 'medico',
    nombre: 'Dr. Antonio Valera',
    especialidad: 'Cardiología',
    clinica_id: 2,
    personal_id: 11111111,
    cola: {
      espera: [
        {
          id: 'P-31010',
          nombre: 'José Ramos Luna',
          prioridad: 'ALTA',
          espera: 30,
          perfil: {
            cedula: '18765432',
            edad: '68 años',
            alergia: null,
            antecedente: 'Cardiopatía isquémica',
            motivo: 'Palpitaciones y disnea de esfuerzo',
          },
        },
        {
          id: 'P-31011',
          nombre: 'Isabel Medina Ortiz',
          prioridad: 'NORMAL',
          espera: 8,
          perfil: {
            cedula: '20345678',
            edad: '54 años',
            alergia: 'Sulfas',
            antecedente: 'Hipertensión',
            motivo: 'Control de tensión arterial',
          },
        },
      ],
      consulta: [],
      finalizado: [
        { id: 'P-31002', nombre: 'Francisco García Martos', prioridad: 'ALTA', cedula: '14302771', hora: '08:47' },
      ],
    },
  },
  {
    username: 'mgonzalez',
    password: PIN_POR_DEFECTO,
    rol: 'medico',
    nombre: 'Dra. María González',
    especialidad: 'Pediatría',
    clinica_id: 1,
    personal_id: 22222222,
    cola: {
      espera: [
        {
          id: 'P-31020',
          nombre: 'Sofía Acosta Rivas',
          prioridad: 'NORMAL',
          espera: 15,
          perfil: {
            cedula: '25874100',
            edad: '6 años',
            alergia: null,
            antecedente: 'Control de crecimiento',
            motivo: 'Control pediátrico de rutina',
          },
        },
      ],
      consulta: [],
      finalizado: [],
    },
  },
  {
    username: 'psanchez',
    password: PIN_POR_DEFECTO,
    rol: 'medico',
    nombre: 'Dr. Pedro Sánchez',
    especialidad: 'Medicina General',
    clinica_id: 4,
    personal_id: 55555555,
    cola: {
      espera: [
        {
          id: 'P-31030',
          nombre: 'Rosa Martínez Soto',
          prioridad: 'NORMAL',
          espera: 20,
          perfil: {
            cedula: '16892345',
            edad: '45 años',
            alergia: 'Sulfamidas',
            antecedente: 'Diabetes tipo 2',
            motivo: 'Control de glicemia',
          },
        },
      ],
      consulta: [],
      finalizado: [
        { id: 'P-31031', nombre: 'Pedro García Cedeño', prioridad: 'NORMAL', cedula: '76543210', hora: '07:55' },
      ],
    },
  },
];

export const COLA_DEMO = DOCTORES_DEMO[0].cola;

// ============================================================
// Personal de farmacia de la semilla (credenciales demo)
// jefe_farmacia → administra inventario, alertas y reposiciones
// farmaceutico  → solo despacho y entrega según receta
// ============================================================

export const FARMACIA_DEMO = [
  {
    username: 'ycontreras',
    password: PIN_POR_DEFECTO,
    rol: 'jefe_farmacia',
    nombre: 'Lic. Yolanda Contreras',
    clinica_id: 2,
    personal_id: 2071,
  },
  {
    username: 'cpereira',
    password: PIN_POR_DEFECTO,
    rol: 'farmaceutico',
    nombre: 'QF. Carlos Pereira',
    clinica_id: 2,
    personal_id: 2072,
  },
];

// ============================================================
// Otros catálogos demo (centros, inventario, exámenes, CIE-10)
// ============================================================

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
        stock: 18,
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
  {
    id: 3,
    codigo_receta: 'RX-2026-0886',
    paciente_cedula: CEDULA_ACTIVA,
    paciente_nombre: 'María González Pérez',
    medico: 'Dra. Laura Fernández',
    estado: 'ENTREGADA',
    fecha_emision: '05 Ago 2026 · 10:20',
    entregada_por: 'QF. Carmen Uribe',
    entregada_at: '06 Ago 2026 · 09:45',
    detalles: [
      {
        medicamento_id: 101,
        nombre_medicamento: 'Losartán 50mg',
        cantidad_prescrita: 30,
        cantidad_despachada: 30,
        posologia: '1 tableta cada 12 horas.',
        categoria: 'Antihipertensivo',
        stock: 340,
      },
    ],
  },
  {
    id: 4,
    codigo_receta: 'RX-2026-0851',
    paciente_cedula: CEDULA_ACTIVA,
    paciente_nombre: 'María González Pérez',
    medico: 'Dr. Carlos Ruiz',
    estado: 'RECIBIDA',
    fecha_emision: '02 Ago 2026 · 11:05',
    entregada_por: 'QF. Carmen Uribe',
    entregada_at: '03 Ago 2026 · 08:30',
    recibida_at: '04 Ago 2026 · 09:12',
    detalles: [
      {
        medicamento_id: 103,
        nombre_medicamento: 'Paracetamol 500mg',
        cantidad_prescrita: 20,
        cantidad_despachada: 20,
        posologia: '1 tableta cada 8 horas por 5 días.',
        categoria: 'Analgésico',
        stock: 1200,
      },
    ],
  },
];

export const INVENTARIO_DEMO = [
  { nombre: 'Paracetamol 500mg', presentacion: 'Tableta', concentracion: '500 mg', categoria: 'Analgésico', stock: 1200, stock_minimo: 150, unidad: 'unidad', vencimiento: 'Dic 2026' },
  { nombre: 'Amoxicilina 500mg', presentacion: 'Cápsula', concentracion: '500 mg', categoria: 'Antibiótico', stock: 450, stock_minimo: 100, unidad: 'unidad', vencimiento: 'Ago 2027' },
  { nombre: 'Amoxicilina + Ác. Clavulánico', presentacion: 'Tableta', concentracion: '875/125 mg', categoria: 'Antibiótico', stock: 0, stock_minimo: 40, unidad: 'unidad', vencimiento: 'Sep 2026' },
  { nombre: 'Losartán 50mg', presentacion: 'Tableta', concentracion: '50 mg', categoria: 'Antihipertensivo', stock: 340, stock_minimo: 80, unidad: 'unidad', vencimiento: 'Mar 2027' },
  { nombre: 'Enalapril 10mg', presentacion: 'Tableta', concentracion: '10 mg', categoria: 'Antihipertensivo', stock: 510, stock_minimo: 100, unidad: 'unidad', vencimiento: 'Jun 2027' },
  { nombre: 'Metformina 850mg', presentacion: 'Tableta', concentracion: '850 mg', categoria: 'Antidiabético', stock: 230, stock_minimo: 60, unidad: 'unidad', vencimiento: 'Sep 2026' },
  { nombre: 'Insulina NPH 100UI', presentacion: 'Frasco', concentracion: '100 UI/ml', categoria: 'Antidiabético', stock: 12, stock_minimo: 40, unidad: 'frasco', vencimiento: 'Ene 2026' },
  { nombre: 'Salbutamol 100mcg', presentacion: 'Inhalador', concentracion: '100 mcg', categoria: 'Broncodilatador', stock: 26, stock_minimo: 30, unidad: 'inhalador', vencimiento: 'Nov 2026' },
  { nombre: 'Ibuprofeno 400mg', presentacion: 'Tableta', concentracion: '400 mg', categoria: 'Antiinflamatorio', stock: 18, stock_minimo: 40, unidad: 'unidad', vencimiento: 'Feb 2027' },
  { nombre: 'Dipirona 1g', presentacion: 'Ampolleta', concentracion: '1 g', categoria: 'Analgésico', stock: 14, stock_minimo: 25, unidad: 'ampolleta', vencimiento: 'Mar 2027' },
  { nombre: 'Omeprazol 20mg', presentacion: 'Cápsula', concentracion: '20 mg', categoria: 'Gastroprotector', stock: 95, stock_minimo: 30, unidad: 'unidad', vencimiento: 'Dic 2027' },
  { nombre: 'Loratadina 10mg', presentacion: 'Tableta', concentracion: '10 mg', categoria: 'Antihistamínico', stock: 88, stock_minimo: 25, unidad: 'unidad', vencimiento: 'Ene 2028' },
  { nombre: 'Vitamina C 500mg', presentacion: 'Tableta', concentracion: '500 mg', categoria: 'Suplemento', stock: 620, stock_minimo: 80, unidad: 'unidad', vencimiento: 'May 2027' },
  { nombre: 'Cloruro de Sodio 0.9%', presentacion: 'Solución', concentracion: '500 ml', categoria: 'Suero', stock: 4, stock_minimo: 20, unidad: 'frasco', vencimiento: 'Oct 2026' },
];

/* Nivel de existencias calculado a partir de las cifras del inventario.
   Es la fuente única de verdad para todos los módulos (farmacia y doctores). */
export function nivelStock(stock, stockMinimo) {
  const actual = Number(stock) || 0;
  const minimo = stockMinimo == null ? 0 : Number(stockMinimo);
  if (actual <= 0) return 'SIN_STOCK';
  if (minimo > 0 && actual <= minimo) return 'BAJO';
  return 'OK';
}

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

// ============================================================
// Catálogo de exámenes y estudios para la orden médica.
// ============================================================

// ============================================================
// Identidad visual de las categorías y grupos de estudios.
// ============================================================

export const CATEGORIA_ESTILO = {
  laboratorio: { etiqueta: 'Laboratorio', icono: 'science', color: '#0d5c47', soft: '#d9e9e0' },
  imagen: { etiqueta: 'Imagen', icono: 'image_search', color: '#00677d', soft: '#d8ecf1' },
  funcional: { etiqueta: 'Funcional', icono: 'monitor_heart', color: '#a8631b', soft: '#f4e3c3' },
};

export const GRUPOS_ESTILO = {
  'Radiología (Rayos X)': {
    sigla: 'RX',
    icono: 'radiology',
    color: '#a8631b',
    soft: '#f4e3c3',
    rayas: true,
  },
  'Tomografía computarizada (TAC)': {
    sigla: 'TAC',
    icono: 'view_in_ar',
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  'Resonancia magnética (RM)': {
    sigla: 'RM',
    icono: 'magnetic_field',
    color: '#0e7490',
    soft: '#cffafe',
  },
  Ecografía: {
    sigla: 'ECO',
    icono: 'sensors',
    color: '#0d5c47',
    soft: '#d9e9e0',
  },
  Cardiovascular: {
    sigla: 'CV',
    icono: 'monitor_heart',
    color: '#a52b1f',
    soft: '#f6dcd5',
  },
  Respiratorio: {
    sigla: 'RESP',
    icono: 'air',
    color: '#0e7490',
    soft: '#cffafe',
  },
  Neurológico: {
    sigla: 'NEU',
    icono: 'psychiatry',
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  Hematología: {
    sigla: 'HEM',
    icono: 'bloodtype',
    color: '#a52b1f',
    soft: '#f6dcd5',
  },
  'Química sanguínea': {
    sigla: 'QUIM',
    icono: 'science',
    color: '#0d5c47',
    soft: '#d9e9e0',
  },
  'Serología e inmunología': {
    sigla: 'SER',
    icono: 'shield',
    color: '#6d28d9',
    soft: '#ede9fe',
  },
  Microbiología: {
    sigla: 'MICRO',
    icono: 'coronavirus',
    color: '#a8631b',
    soft: '#f4e3c3',
  },
  Orina: {
    sigla: 'URO',
    icono: 'water_drop',
    color: '#1d4ed8',
    soft: '#dbeafe',
  },
  Heces: {
    sigla: 'COPRO',
    icono: 'egg_alt',
    color: '#7c4a03',
    soft: '#f7ecd0',
  },
};

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

// ============================================================
// Estado en memoria (sesión demo sin backend)
// ============================================================

// Recetas que "envían" los médicos y que Farmacia recibe como pendientes.
let pendientesStore = RECETAS_DEMO.map((r) => ({
  ...r,
  detalles: r.detalles.map((d) => ({ ...d })),
}));

// Órdenes de estudios emitidas (se sincronizan con PACIENTES_DEMO al consultar).
let ordenesStore = [
  ...PACIENTES_DEMO.flatMap((p) =>
    (p.ordenes || []).map((o) => ({ ...o, paciente_id: p.perfil.id }))
  ),
];
let ordenSeq = 1004;

// ============================================================
// DEMO: API de respaldo (misma forma que la API real)
// ============================================================

function _perfil(paciente) {
  return {
    id: paciente.perfil.id,
    ...paciente.perfil,
    created_at: '2026-01-15T10:00:00',
  };
}

function _clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const DEMO = {
  /* === Autenticación (modo demo) === */
  login: async (credenciales) => {
    const u = String(credenciales.username || '').trim().toLowerCase();
    const p = String(credenciales.password || '');
    const doctor = DOCTORES_DEMO.find((d) => d.username === u && d.password === p);
    const farmacia = FARMACIA_DEMO.find((f) => f.username === u && f.password === p);
    const persona = doctor || farmacia;
    if (!persona) throw new Error('Usuario o contraseña incorrectos.');
    return {
      token: `demo-staff-${persona.username}`,
      usuario: {
        username: persona.username,
        rol: persona.rol,
        nombre: persona.nombre,
        especialidad: persona.especialidad,
        clinica_id: persona.clinica_id,
        personal_id: persona.personal_id,
      },
    };
  },
  loginPaciente: async ({ cedula, pin }) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado. Verifique la cédula.');
    if (String(pin || '') !== paciente.pin) throw new Error('PIN incorrecto. Verifique su cédula y su PIN.');
    return { token: `demo-paciente-${paciente.perfil.cedula}`, paciente: _perfil(paciente) };
  },
  recuperarPin: async ({ cedula, email }) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado. Verifique la cédula.');
    if (String(paciente.perfil.email || '').toLowerCase() !== String(email || '').trim().toLowerCase()) {
      throw new Error('El correo no coincide con el registrado para esta cédula.');
    }
    return {
      mensaje: 'Si el correo coincide con el registrado, recibirá un código de 6 dígitos válido por 15 minutos.',
      expira_minutos: 15,
      codigo_demo: '123456',
    };
  },
  resetPin: async ({ cedula, codigo, pin_nuevo }) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado. Verifique la cédula.');
    if (String(codigo || '') !== '123456') throw new Error('Código inválido o expirado. Solicite uno nuevo.');
    if (!pin_nuevo || String(pin_nuevo).length < 4) throw new Error('El PIN nuevo debe tener al menos 4 dígitos.');
    paciente.pin = String(pin_nuevo);
    return _perfil(paciente);
  },
  colaDoctor: async (username) => {
    const doctor = DOCTORES_DEMO.find((d) => d.username === username) || DOCTORES_DEMO[0];
    return _clonar(doctor.cola);
  },

  /* === Datos generales === */
  getCentros: async () => CENTROS_DEMO.map((c) => ({ ...c, servicios: [...c.servicios] })),

  /* === Pacientes === */
  buscarPaciente: async (cedula) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado');
    return _perfil(paciente);
  },
  actualizarPaciente: async (cedula, payload) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado');
    Object.keys(payload).forEach((k) => {
      if (payload[k] !== undefined) paciente.perfil[k] = payload[k];
    });
    return _perfil(paciente);
  },
  historialPaciente: async (cedula) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado');
    return {
      paciente: _perfil(paciente),
      total_consultas: paciente.historial.length,
      historial: _clonar(paciente.historial),
    };
  },
  medicoTratante: async (cedula) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado');
    return { ...paciente.medicoTratante };
  },
  citasPaciente: async (cedula) => {
    const paciente = pacientePorCedula(cedula);
    if (!paciente) throw new Error('Paciente no encontrado');
    return _clonar(paciente.citas);
  },
  crearCita: async (payload) => {
    const cedulaLimpia = String(payload.paciente?.cedula || '').replace(/\D/g, '');
    let paciente = pacientePorCedula(cedulaLimpia);
    const pinSecreto = String(Math.floor(Math.random() * 900000) + 100000);
    const codigoConfirmacion = `CITAB-2026-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    if (!paciente && payload.paciente) {
      paciente = {
        perfil: {
          id: `hc-paciente-${cedulaLimpia}`,
          numero_historia: `HIS-${payload.paciente.tipo_cedula || 'V'}${cedulaLimpia}`,
          tipo_cedula: payload.paciente.tipo_cedula || 'V',
          cedula: cedulaLimpia,
          nombre_completo: payload.paciente.nombre_completo || 'Paciente Registrado',
          fecha_nacimiento: '1990-01-01',
          telefono: '04141234567',
          email: payload.paciente.email || 'paciente@bna.gob.ve',
          tipo_sangre: 'O+',
          antecedentes_medicos: [],
          alergias: [],
        },
        pin: pinSecreto,
        historial: [],
        citas: [],
        ordenes: [],
        medicoTratante: {
          nombre: 'Dra. Laura Fernández',
          especialidad: 'Medicina General',
          tipo: 'principal',
          estado: 'activo',
        },
      };
      PACIENTES_DEMO.push(paciente);
    }

    const nuevaCita = {
      id: `cita-demo-${Date.now()}`,
      codigo_confirmacion: codigoConfirmacion,
      centro_id: payload.centro_id || 2,
      centro_salud: 'Clínica de los Trabajadores (CITAB)',
      especialidad_id: payload.especialidad_id || 101,
      especialidad: 'Medicina General',
      fecha_cita: payload.fecha_cita || new Date().toISOString().slice(0, 10),
      hora_inicio: payload.hora_inicio || '08:00:00',
      motivo: payload.motivo || 'Solicitud web portal municipal',
      estado: 'confirmada',
      origen: 'cita_web',
      paciente_id: paciente?.perfil?.id || `hc-${cedulaLimpia}`,
      paciente_nombre: payload.paciente?.nombre_completo || paciente?.perfil?.nombre_completo,
    };

    if (paciente) {
      paciente.citas.unshift(nuevaCita);
    }

    return {
      id: nuevaCita.id,
      codigo_confirmacion: codigoConfirmacion,
      paciente_id: nuevaCita.paciente_id,
      centro_id: nuevaCita.centro_id,
      especialidad_id: nuevaCita.especialidad_id,
      fecha_cita: nuevaCita.fecha_cita,
      hora_inicio: nuevaCita.hora_inicio,
      motivo: nuevaCita.motivo,
      origen: nuevaCita.origen,
      estado: nuevaCita.estado,
      pin_inicial: paciente?.pin || pinSecreto,
      pin_enviado_correo: !!payload.paciente?.email,
    };
  },
  ordenesPaciente: async (pacienteId) => {
    const paciente = pacientePorId(pacienteId);
    if (!paciente) return [];
    const deRegistro = _clonar(paciente.ordenes || []);
    return ordenesStore
      .filter((o) => o.paciente_id === paciente.perfil.id)
      .map((o) => ({ ...o, estudios: o.estudios.map((e) => ({ ...e })) }))
      .concat(deRegistro.filter((d) => !ordenesStore.some((o) => o.id === d.id)));
  },

  /* === Farmacia === */
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
    pendientesStore = pendientesStore.map((r) =>
      r.id === payload.receta_id ? { ...r, estado: 'DESPACHADA' } : r
    );
    return {
      status: 'success',
      message: 'Despacho procesado e inventario actualizado con éxito',
      receta_id: payload.receta_id,
      medicamentos_despachados: payload.items.reduce((a, i) => a + i.cantidad_despachada, 0),
    };
  },
  entregarReceta: async (recetaId, payload = {}, usuario = {}) => {
    const receta = pendientesStore.find((r) => r.id === recetaId);
    if (!receta) throw new Error('Receta no encontrada en el registro de demostración.');
    if (receta.estado !== 'PENDIENTE' && receta.estado !== 'DESPACHADA') {
      throw new Error(`La receta está en estado ${receta.estado} y ya no puede entregarse.`);
    }
    pendientesStore = pendientesStore.map((r) =>
      r.id === recetaId
        ? {
            ...r,
            estado: 'ENTREGADA',
            entregada_por: usuario.nombre || 'QF. Farmacia',
            entregada_at: new Date().toLocaleString('es-VE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
        : r
    );
    return {
      status: 'success',
      message: 'Entrega registrada. El paciente debe confirmar la recepción en su portal.',
      receta_id: recetaId,
    };
  },
  recibirReceta: async (recetaId, cedula = '') => {
    const receta = pendientesStore.find((r) => r.id === recetaId);
    if (!receta) throw new Error('Receta no encontrada en el registro de demostración.');
    if (String(receta.paciente_cedula).replace(/\D/g, '') !== String(cedula).replace(/\D/g, '')) {
      throw new Error('Solo puede confirmar sus propias recetas.');
    }
    if (receta.estado !== 'ENTREGADA') {
      throw new Error(
        `La receta está en estado ${receta.estado}. Espere a que la farmacia la entregue.`
      );
    }
    pendientesStore = pendientesStore.map((r) =>
      r.id === recetaId
        ? {
            ...r,
            estado: 'RECIBIDA',
            recibida_at: new Date().toLocaleString('es-VE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
        : r
    );
    return {
      status: 'success',
      message: 'Recepcion confirmada. Su receta queda cerrada en la farmacia.',
      receta_id: recetaId,
    };
  },
  recetasPaciente: async (cedula) =>
    pendientesStore
      .filter(
        (r) =>
          String(r.paciente_cedula).replace(/\D/g, '') === String(cedula || '').replace(/\D/g, '')
      )
      .map((r) => ({ ...r, detalles: r.detalles.map((d) => ({ ...d })) })),
  recetasPendientes: async () =>
    pendientesStore
      .filter((r) => r.estado === 'PENDIENTE')
      .map((r) => ({ ...r, detalles: r.detalles.map((d) => ({ ...d })) })),
  getInventario: async (params = {}) => {
    const q = String((params && params.q) || '').trim().toLowerCase();
    const todos = INVENTARIO_DEMO.map((m, i) => ({
      id: 200 + i,
      nombre: m.nombre,
      presentacion: m.presentacion || null,
      concentracion: m.concentracion || null,
      categoria: m.categoria || null,
      stock_actual: m.stock,
      stock_minimo: m.stock_minimo,
      unidad: m.unidad || 'unidad',
      vencimiento: m.vencimiento,
    }));
    let items = todos.filter((m) => !q || m.nombre.toLowerCase().includes(q));
    if (params && params.solo_alertas) {
      items = items.filter((m) => nivelStock(m.stock_actual, m.stock_minimo) !== 'OK');
    }
    return items;
  },

  /* === Notificaciones (Fase 5) === */
  notificacionesPaciente: async (cedula) => {
    const digitos = String(cedula || '').replace(/\D/g, '');
    const mias = pendientesStore.filter(
      (r) => String(r.paciente_cedula).replace(/\D/g, '') === digitos
    );
    const ahora = new Date().toISOString().slice(0, 16);
    const base = [
      {
        id: 1,
        tipo: 'bienvenida',
        canal: 'correo',
        asunto: '¡Bienvenido a BNA Salud! Tu PIN de acceso al portal',
        destinatario: 'paciente@demo.local',
        estado: 'demo',
        detalle: 'SMTP no configurado (modo demo)',
        referencia: null,
        enviado_en: ahora,
        creado_en: ahora,
      },
    ];
    return base.concat(
      mias
        .filter((r) => r.estado === 'ENTREGADA' || r.estado === 'RECIBIDA')
        .map((r, i) => ({
          id: 10 + i,
          tipo: 'receta_entregada',
          canal: 'correo',
          asunto: `Receta ${r.codigo_receta} entregada — confirma en tu portal`,
          destinatario: 'paciente@demo.local',
          estado: 'demo',
          detalle: 'SMTP no configurado (modo demo)',
          referencia: `receta:${r.id}`,
          enviado_en: r.entregada_at ? String(r.entregada_at) : ahora,
          creado_en: r.entregada_at ? String(r.entregada_at) : ahora,
        }))
    );
  },

  /* === Consultas / órdenes === */
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
