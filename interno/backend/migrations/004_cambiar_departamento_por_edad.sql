-- Migracion 004: Renombrar departamento -> edad (INTEGER) en empleados
-- Fecha: 2026-09-18

BEGIN;

-- Cambiar tipo y nombre de columna
ALTER TABLE public.empleados DROP COLUMN IF EXISTS departamento;
ALTER TABLE public.empleados ADD COLUMN edad INTEGER;

COMMIT;
