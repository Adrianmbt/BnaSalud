-- ============================================================
-- BnaSalud · Migración 0007
-- fecha_nacimiento es opcional en el contrato de la API
-- (los formularios web no la solicitan siempre), se relaja el
-- NOT NULL para que el registro de pacientes no falle.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.historias_clinicas
  ALTER COLUMN fecha_nacimiento DROP NOT NULL;
