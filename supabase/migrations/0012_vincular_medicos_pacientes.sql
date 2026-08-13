-- ============================================================
-- BnaSalud · Vínculo Médico ↔ Paciente (migración 0012)
-- Prepara el camino para vincular doctores y pacientes:
--
--   • medico_pacientes  → relación N:M entre `personal`
--     (rol Médico) y `historias_clinicas`, con un único médico
--     principal por paciente (vista rápida del médico de cabecera).
--   • citas.medico_id   → asignar un médico concreto a cada cita.
--   • consultas.medico_id → FK formal + índice (consultas del médico).
--
-- Idempotente: puede re-ejecutarse sin errores.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. RELACIÓN MÉDICO-PACIENTE (nueva)
CREATE TABLE IF NOT EXISTS public.medico_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id INTEGER NOT NULL REFERENCES public.personal (id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.historias_clinicas (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'principal'
    CHECK (tipo IN ('principal', 'seguimiento', 'temporal')),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'inactivo')),
  origen TEXT DEFAULT 'manual',            -- manual | cita | consulta | importacion
  notas TEXT,
  asignado_por INTEGER REFERENCES public.personal (id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (medico_id, paciente_id)
);

-- Un único médico principal por paciente (los demás quedan como seguimiento).
CREATE UNIQUE INDEX IF NOT EXISTS medico_pacientes_principal_uq
  ON public.medico_pacientes (paciente_id)
  WHERE tipo = 'principal' AND estado = 'activo';

CREATE INDEX IF NOT EXISTS idx_medico_pacientes_medico
  ON public.medico_pacientes (medico_id);
CREATE INDEX IF NOT EXISTS idx_medico_pacientes_paciente
  ON public.medico_pacientes (paciente_id);

-- Actualiza updated_at automáticamente al editar la relación.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medico_pacientes_updated_at ON public.medico_pacientes;
CREATE TRIGGER trg_medico_pacientes_updated_at
  BEFORE UPDATE ON public.medico_pacientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. CITAS: asignación de médico (columna + FK + índice)
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS medico_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_medico_id_fkey') THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_medico_id_fkey FOREIGN KEY (medico_id)
      REFERENCES public.personal (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_citas_medico ON public.citas (medico_id);

-- 3. CONSULTAS: FK e índice sobre el médico tratante
-- (primero se limpian médico_id huérfanos para que la FK pueda validarse)
UPDATE public.consultas c
SET medico_id = NULL
WHERE c.medico_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.personal p WHERE p.id = c.medico_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultas_medico_id_fkey') THEN
    ALTER TABLE public.consultas
      ADD CONSTRAINT consultas_medico_id_fkey FOREIGN KEY (medico_id)
      REFERENCES public.personal (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_consultas_medico ON public.consultas (medico_id);

-- 4. SEMILLA: vincular pacientes existentes a un médico principal
-- (distribución round-robin estable entre los médicos registrados)
WITH medicos AS (
  SELECT p.id, row_number() OVER (ORDER BY p.id) AS rn
  FROM public.personal p
  WHERE lower(coalesce(p.cargo, '')) IN ('médico', 'medico')
     OR lower(coalesce(p.cargo, '')) LIKE '%médico%'
),
pacientes AS (
  SELECT h.id, row_number() OVER (ORDER BY h.cedula) AS rn
  FROM public.historias_clinicas h
),
total_medicos AS (
  SELECT count(*) AS n FROM medicos
)
INSERT INTO public.medico_pacientes (medico_id, paciente_id, tipo, estado, origen)
SELECT m.id, p.id, 'principal', 'activo', 'importacion'
FROM pacientes p
JOIN medicos m ON m.rn = ((p.rn - 1) % (SELECT n FROM total_medicos)) + 1
ON CONFLICT (medico_id, paciente_id) DO NOTHING;
