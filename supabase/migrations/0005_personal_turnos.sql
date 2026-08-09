-- ============================================================
-- BnaSalud · Migración 0005
-- Crea la tabla de asignación de turnos del personal (RRHH),
-- consumida por POST /api/v1/rrhh/asignar-turno.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.personal_turnos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personal_id INTEGER NOT NULL REFERENCES public.personal(id),
  clinica_id INTEGER NOT NULL REFERENCES public.clinicas(id),
  turno_id INTEGER NOT NULL REFERENCES public.turnos(id),
  fecha_asignacion DATE NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_turnos_personal
  ON public.personal_turnos (personal_id);
CREATE INDEX IF NOT EXISTS idx_personal_turnos_clinica
  ON public.personal_turnos (clinica_id);
