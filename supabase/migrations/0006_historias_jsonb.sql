-- ============================================================
-- BnaSalud · Migración 0006
-- Convierte antecedentes_medicos y alergias de historias_clinicas
-- a JSONB (antes TEXT con contenido JSON en string).
-- Los serializadores de la API ya toleran ambos formatos.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.historias_clinicas
  ALTER COLUMN antecedentes_medicos TYPE JSONB
  USING CASE
    WHEN antecedentes_medicos IS NULL OR antecedentes_medicos = '' THEN '[]'::jsonb
    WHEN left(antecedentes_medicos, 1) = '[' THEN antecedentes_medicos::jsonb
    ELSE to_jsonb(antecedentes_medicos)
  END;

ALTER TABLE public.historias_clinicas
  ALTER COLUMN alergias TYPE JSONB
  USING CASE
    WHEN alergias IS NULL OR alergias = '' THEN '[]'::jsonb
    WHEN left(alergias, 1) = '[' THEN alergias::jsonb
    ELSE to_jsonb(alergias)
  END;
