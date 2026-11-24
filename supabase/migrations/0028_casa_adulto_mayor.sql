-- ============================================================
-- Migración 0028: Agregar Casa del Adulto Mayor a la red
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

INSERT INTO public.clinicas (nombre, codigo, parroquia, direccion, activo) VALUES
  ('Casa del Adulto Mayor', 'CLN-ABUELO', '', 'Barcelona, Anzoátegui', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  direccion = EXCLUDED.direccion,
  activo = EXCLUDED.activo;
