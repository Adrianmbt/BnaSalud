-- ============================================================
-- BnaSalud · Esquema BASE (tablas previas a migraciones 0001+)
-- ============================================================
-- Para reconstrucción de emergencia: estas 12 tablas se creaban
-- fuera de `supabase/migrations/` (por lo que las migraciones solo
-- las ALTERan/insertan). Recrea el esquema original pre-migración.
-- Ejecutar ANTES de las migraciones 0001 → 0020, después seed.sql.
-- Idempotente: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- 1. CARGOS (RRHH)
CREATE TABLE IF NOT EXISTS public.cargos (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  departamento TEXT,
  descripcion TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS cargos_nombre_uq ON public.cargos (nombre);

-- 2. TURNOS (RRHH)
CREATE TABLE IF NOT EXISTS public.turnos (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  hora_inicio TIME,
  hora_fin    TIME
);
CREATE UNIQUE INDEX IF NOT EXISTS turnos_nombre_uq ON public.turnos (nombre);

-- 3. CLINICAS / CENTROS DE SALUD
CREATE TABLE IF NOT EXISTS public.clinicas (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  codigo      TEXT NOT NULL,
  parroquia   TEXT,
  direccion   TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clinicas_codigo_uq ON public.clinicas (codigo);

-- 4. PERSONAL / RRHH
CREATE TABLE IF NOT EXISTS public.personal (
  id           SERIAL PRIMARY KEY,
  cedula       TEXT,
  nombre       TEXT NOT NULL,
  apellido     TEXT,
  especialidad TEXT,
  telefono     TEXT,
  email        TEXT,
  cargo        TEXT,
  cargo_id     INTEGER REFERENCES public.cargos (id),
  clinica_id   INTEGER REFERENCES public.clinicas (id),
  status       TEXT DEFAULT 'DISPONIBLE',
  estado       TEXT DEFAULT 'ACTIVO'
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_cedula_uq ON public.personal (cedula) WHERE cedula IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS personal_cedula_uq_full ON public.personal (cedula);

-- 5. HISTORIAS CLINICAS (tabla de PACIENTES)
CREATE TABLE IF NOT EXISTS public.historias_clinicas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cedula         TEXT DEFAULT 'V',
  cedula              TEXT NOT NULL,
  nombre_completo     TEXT NOT NULL,
  fecha_nacimiento    DATE,
  telefono            TEXT,
  email               TEXT,
  tipo_sangre         TEXT,
  antecedentes_medicos TEXT DEFAULT '[]',
  alergias            TEXT DEFAULT '[]',
  numero_historia     TEXT,
  pin_hash            TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS historias_clinicas_cedula_uq ON public.historias_clinicas (cedula);

-- 6. INVENTARIO DE MEDICAMENTOS
CREATE TABLE IF NOT EXISTS public.inventario_medicamentos (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  presentacion  TEXT,
  concentracion TEXT,
  categoria     TEXT,
  stock_actual  INTEGER DEFAULT 0,
  stock_minimo  INTEGER DEFAULT 0,
  unidad        TEXT DEFAULT 'unidad',
  unidad_medida TEXT,
  vencimiento   DATE,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventario_medicamentos_nombre_uq ON public.inventario_medicamentos (nombre);

-- 7. STOCK POR CLÍNICA
CREATE TABLE IF NOT EXISTS public.stock_clinica (
  id             BIGSERIAL PRIMARY KEY,
  clinica_id     INTEGER NOT NULL REFERENCES public.clinicas (id),
  medicamento_id INTEGER NOT NULL REFERENCES public.inventario_medicamentos (id),
  cantidad_actual INTEGER,
  lote           TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_clinica_clinica_medicamento_uq
  ON public.stock_clinica (clinica_id, medicamento_id);
CREATE INDEX IF NOT EXISTS idx_stock_clinica_medicamento ON public.stock_clinica (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_stock_clinica_clinica ON public.stock_clinica (clinica_id);

-- 8. CITAS
CREATE TABLE IF NOT EXISTS public.citas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id         UUID REFERENCES public.historias_clinicas (id),
  centro_id           INTEGER REFERENCES public.clinicas (id),
  centro_salud        TEXT,
  especialidad_id     INTEGER,
  especialidad        TEXT,
  fecha_cita          DATE NOT NULL,
  hora_inicio         TIME NOT NULL,
  motivo              TEXT,
  origen              TEXT DEFAULT 'cita_web',
  estado              TEXT DEFAULT 'pendiente',
  codigo_confirmacion TEXT NOT NULL,
  observaciones_medico TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS citas_codigo_confirmacion_uq ON public.citas (codigo_confirmacion);
CREATE INDEX IF NOT EXISTS idx_citas_centro ON public.citas (centro_id);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON public.citas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON public.citas (fecha_cita);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON public.citas (estado);

-- 9. RECETAS
CREATE TABLE IF NOT EXISTS public.recetas (
  id                  SERIAL PRIMARY KEY,
  codigo_receta       TEXT NOT NULL,
  paciente_cedula     TEXT,
  paciente_nombre     TEXT,
  medico              TEXT,
  medico_id           INTEGER REFERENCES public.personal (id),
  clinica_id          INTEGER REFERENCES public.clinicas (id),
  estado              TEXT,
  fecha_emision       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS recetas_codigo_uq ON public.recetas (codigo_receta);
CREATE INDEX IF NOT EXISTS idx_recetas_estado ON public.recetas (estado);
CREATE INDEX IF NOT EXISTS idx_recetas_medico ON public.recetas (medico_id);
CREATE INDEX IF NOT EXISTS idx_recetas_clinica ON public.recetas (clinica_id);

-- 10. RECETA DETALLES
CREATE TABLE IF NOT EXISTS public.receta_detalles (
  id                  SERIAL PRIMARY KEY,
  receta_id           INTEGER NOT NULL REFERENCES public.recetas (id),
  medicamento_id      INTEGER NOT NULL REFERENCES public.inventario_medicamentos (id),
  cantidad_prescrita  INTEGER,
  cantidad_despachada INTEGER,
  posologia           TEXT
);
CREATE INDEX IF NOT EXISTS idx_receta_detalles_receta ON public.receta_detalles (receta_id);
CREATE INDEX IF NOT EXISTS idx_receta_detalles_medicamento ON public.receta_detalles (medicamento_id);

-- 11. DESPACHO REGISTRADO (Farmacia)
CREATE TABLE IF NOT EXISTS public.despacho_registros (
  id              SERIAL PRIMARY KEY,
  receta_id       INTEGER NOT NULL REFERENCES public.recetas (id),
  despachado_por  INTEGER REFERENCES public.personal (id),
  observaciones   TEXT,
  fecha_despacho  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_despacho_receta ON public.despacho_registros (receta_id);

-- 12. EMERGENCIAS
CREATE TABLE IF NOT EXISTS public.emergencias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID REFERENCES public.historias_clinicas (id),
  centro_salud TEXT NOT NULL,
  nivel_triaje INTEGER,
  descripcion  TEXT NOT NULL,
  estado       TEXT DEFAULT 'en_atencion',
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emergencias_triaje ON public.emergencias (nivel_triaje, created_at);