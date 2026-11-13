-- 019_historias_medicas.sql
-- Rol de Historia Clínica Integral (formato CITAB), fichas versionadas y
-- reposos médicos con folio único. Migración manual e idempotente.

-- 1) Habilitar el rol en usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (
    rol = ANY (ARRAY[
        'recepcionista', 'medico_emergencia', 'medico', 'jefe_farmacia',
        'farmaceutico', 'admin_sistemas', 'director', 'superusuario',
        'enfermero', 'paciente', 'historias_medicas', 'recursos_humanos'
    ]::text[])
);

-- 2) Ficha integral: una por paciente, datos del formato CITAB en JSONB
CREATE TABLE IF NOT EXISTS historias_integrales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    historia_clinica_id uuid NOT NULL UNIQUE
        REFERENCES historias_clinicas(id) ON DELETE CASCADE,
    clinica_id integer REFERENCES clinicas(id) ON DELETE SET NULL,
    numero_carpeta text,
    datos jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    creado_por text,
    actualizado_por text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3) Reposos médicos: folio diario consecutivo y vínculo con nómina
CREATE SEQUENCE IF NOT EXISTS reposos_medicos_folio_seq;

CREATE TABLE IF NOT EXISTS reposos_medicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    folio text NOT NULL UNIQUE DEFAULT (
        'RM-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' ||
        lpad(nextval('reposos_medicos_folio_seq')::text, 5, '0')
    ),
    historia_clinica_id uuid NOT NULL
        REFERENCES historias_clinicas(id) ON DELETE CASCADE,
    consulta_id uuid REFERENCES consultas(id) ON DELETE SET NULL,
    medico_id integer REFERENCES personal(id) ON DELETE SET NULL,
    medico_nombre text,
    empleado_id uuid REFERENCES empleados(id) ON DELETE SET NULL,
    beneficiario_id uuid REFERENCES beneficiarios(id) ON DELETE SET NULL,
    fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    dias integer NOT NULL,
    diagnostico text,
    descripcion text,
    estado text NOT NULL DEFAULT 'vigente',
    anulado_por text,
    anulado_en timestamp with time zone,
    motivo_anulacion text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT reposos_medicos_dias_check CHECK (dias IN (1, 3, 5, 7)),
    CONSTRAINT reposos_medicos_estado_check CHECK (estado IN ('vigente', 'anulado')),
    CONSTRAINT reposos_medicos_fechas_check CHECK (fecha_fin >= fecha_inicio)
);

-- 4) Origen de la consulta para separar la atención integral del flujo de cola
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'consulta';
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS historia_integral_id uuid;
ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_historia_integral_id_fkey;
ALTER TABLE consultas ADD CONSTRAINT consultas_historia_integral_id_fkey
    FOREIGN KEY (historia_integral_id) REFERENCES historias_integrales(id)
    ON DELETE SET NULL;

-- 5) Índices de operación
CREATE INDEX IF NOT EXISTS idx_reposos_medicos_historia
    ON reposos_medicos (historia_clinica_id, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reposos_medicos_estado
    ON reposos_medicos (estado, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reposos_medicos_empleado
    ON reposos_medicos (empleado_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_reposos_medicos_medico
    ON reposos_medicos (medico_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_origen
    ON consultas (origen, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_historia_integral
    ON consultas (historia_integral_id);
