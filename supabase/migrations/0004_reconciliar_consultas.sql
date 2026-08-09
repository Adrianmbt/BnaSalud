-- ============================================================
-- BnaSalud · Reconciliación (migración 0004)
-- Amplía la tabla preexistente `consultas` con los campos del
-- historial clínico definidos en 0001 (que no se aplicaron por
-- existir la tabla). Completa el modelo de consulta médica.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS medico_nombre TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS motivo_consulta TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS examen_fisico TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS cie10_codigo TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS cie10_descripcion TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS recomendaciones TEXT;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS laboratorios JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS comprobante_ref TEXT;
