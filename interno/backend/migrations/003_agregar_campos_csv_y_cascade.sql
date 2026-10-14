-- Migración 003: Agregar campos fecha_nacimiento y genero a empleados y beneficiarios
-- + Crear trigger de cascade para inactivar beneficiarios al inactivar empleado
-- Fecha: 2026-09-18

BEGIN;

-- ============================================================
-- 1. Agregar columnas a empleados
-- ============================================================
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS genero TEXT;

-- ============================================================
-- 2. Agregar columnas a beneficiarios
-- ============================================================
ALTER TABLE public.beneficiarios
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS genero TEXT;

-- ============================================================
-- 3. Función de cascade: al inactivar empleado → inactivar beneficiarios
-- ============================================================
CREATE OR REPLACE FUNCTION public.inactivar_beneficiarios()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.activo = false AND OLD.activo = true THEN
    UPDATE public.beneficiarios
      SET activo = false
      WHERE empleado_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Trigger en empleados
-- ============================================================
DROP TRIGGER IF EXISTS trg_inactivar_beneficiarios ON public.empleados;
CREATE TRIGGER trg_inactivar_beneficiarios
  AFTER UPDATE ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.inactivar_beneficiarios();

COMMIT;
