-- ============================================================
-- Migración 0020: Agregar Clínica Municipal José Pérez Fernández
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

INSERT INTO public.clinicas (id, nombre, codigo, parroquia, direccion, activo) VALUES
  (6, 'Clínica Municipal José Pérez Fernández', 'CLN-MUNICIPAL', 'El Carmen', 'Barcelona, Anzoátegui', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  parroquia = EXCLUDED.parroquia,
  direccion = EXCLUDED.direccion,
  activo = EXCLUDED.activo;
