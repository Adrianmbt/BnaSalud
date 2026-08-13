-- ============================================================
-- BnaSalud · Acceso seguro del paciente (migración 0013)
-- Validación "cédula + PIN" para el portal del paciente:
--
--   • historias_clinicas.pin_hash → PIN de 4-8 dígitos (bcrypt),
--     creado o restablecido en el primer acceso / registro.
--   • recuperacion_pacientes     → códigos de 6 dígitos para
--     restablecer el PIN (verificados por correo, expiran en 15 min).
--
-- Idempotente: puede re-ejecutarse sin errores.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. PIN del paciente (hash bcrypt; nunca en texto plano)
ALTER TABLE public.historias_clinicas
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- 2. Códigos de recuperación de PIN
CREATE TABLE IF NOT EXISTS public.recuperacion_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.historias_clinicas (id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recuperacion_paciente
  ON public.recuperacion_pacientes (paciente_id, usado);