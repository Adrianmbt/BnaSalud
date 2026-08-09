-- ============================================================
-- BnaSalud · Reconciliación (migración 0002)
-- Unifica la tabla de pacientes en historias_clinicas (existente),
-- elimina la tabla paralela 'pacientes' creada en 0001.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Ampliar historias_clinicas para cubrir el modelo completo
ALTER TABLE public.historias_clinicas ADD COLUMN IF NOT EXISTS tipo_cedula TEXT DEFAULT 'V';
ALTER TABLE public.historias_clinicas ADD COLUMN IF NOT EXISTS tipo_sangre TEXT;
ALTER TABLE public.historias_clinicas ADD COLUMN IF NOT EXISTS numero_historia TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS historias_clinicas_cedula_uq ON public.historias_clinicas (cedula);

-- 2. Consultas: apuntar a historias_clinicas y eliminar la tabla paralela
ALTER TABLE public.consultas DROP CONSTRAINT IF EXISTS consultas_paciente_id_fkey;
ALTER TABLE public.consultas ADD CONSTRAINT consultas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.historias_clinicas (id);
DROP TABLE IF EXISTS public.pacientes;
