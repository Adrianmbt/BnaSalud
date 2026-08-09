-- ============================================================
-- BnaSalud · Reconciliación (migración 0003)
-- Unifica el inventario de medicamentos en inventario_medicamentos
-- (tabla preexistente referenciada por receta_detalles),
-- elimina la tabla paralela 'medicamentos' creada en 0001.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Ampliar inventario_medicamentos para cubrir el modelo completo
ALTER TABLE public.inventario_medicamentos ADD COLUMN IF NOT EXISTS presentacion TEXT;
ALTER TABLE public.inventario_medicamentos ADD COLUMN IF NOT EXISTS concentracion TEXT;
ALTER TABLE public.inventario_medicamentos ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0;
ALTER TABLE public.inventario_medicamentos ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'unidad';
ALTER TABLE public.inventario_medicamentos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS inventario_medicamentos_nombre_uq ON public.inventario_medicamentos (nombre);

-- 2. Eliminar tabla paralela
DROP TABLE IF EXISTS public.medicamentos;
