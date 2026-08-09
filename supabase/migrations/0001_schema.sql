-- ============================================================
-- BnaSalud · Esquema inicial (migración 0001)
-- Cómo ejecutar: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotente: puede re-ejecutarse sin errores (IF NOT EXISTS).
-- Nota GC: para producción se recomienda activar RLS + Supabase Auth.
-- ============================================================

-- 1. ESPECIALIDADES (nueva)
CREATE TABLE IF NOT EXISTS public.especialidades (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  icono TEXT DEFAULT 'stethoscope',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PACIENTES (nueva)
CREATE TABLE IF NOT EXISTS public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cedula TEXT DEFAULT 'V',
  cedula TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  fecha_nacimiento DATE,
  telefono TEXT,
  email TEXT,
  tipo_sangre TEXT,
  antecedentes_medicos JSONB DEFAULT '[]'::jsonb,
  alergias JSONB DEFAULT '[]'::jsonb,
  numero_historia TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tipo_cedula, cedula)
);

-- 3. CITAS (ampliar tabla existente)
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS centro_id INTEGER;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS especialidad_id INTEGER;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'cita_web';
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS codigo_confirmacion TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS citas_codigo_confirmacion_uq ON public.citas (codigo_confirmacion);

-- 4. PERSONAL / RRHH (ampliar tabla existente)
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DISPONIBLE';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS clinica_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS personal_cedula_uq ON public.personal (cedula) WHERE cedula IS NOT NULL;

-- 5. MEDICAMENTOS (nueva)
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  presentacion TEXT,
  concentracion TEXT,
  categoria TEXT,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 0,
  unidad TEXT DEFAULT 'unidad',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RECETAS (ampliar tabla existente)
ALTER TABLE public.recetas ADD COLUMN IF NOT EXISTS medico TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS recetas_codigo_uq ON public.recetas (codigo_receta);

-- 7. CONSULTAS / HISTORIAL CLÍNICO (nueva)
CREATE TABLE IF NOT EXISTS public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES public.pacientes(id),
  cita_id TEXT,
  medico_id INTEGER,
  medico_nombre TEXT,
  especialidad TEXT,
  motivo_consulta TEXT,
  examen_fisico TEXT,
  cie10_codigo TEXT,
  cie10_descripcion TEXT,
  tratamiento TEXT,
  recomendaciones TEXT,
  recetas JSONB DEFAULT '[]'::jsonb,
  laboratorios JSONB DEFAULT '[]'::jsonb,
  comprobante_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de uso frecuente
CREATE INDEX IF NOT EXISTS idx_citas_centro ON public.citas (centro_id);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON public.citas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON public.citas (fecha_cita);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente ON public.consultas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_receta_detalles_receta ON public.receta_detalles (receta_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_nombre ON public.medicamentos (nombre);
