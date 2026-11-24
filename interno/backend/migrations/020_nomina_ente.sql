-- 020_nomina_ente.sql
--
-- La nómina llega por ente (Sede Alcaldía de Bolívar, otros organismos).
-- Sin esta columna todas las cargas masivas quedan mezcladas y no se puede
-- distinguir a qué dependencia pertenece cada trabajador.
--
-- El valor se toma de la columna ENTE del Excel importado o del parámetro
-- `ente` del endpoint /admin/empleados/importar.

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS ente TEXT;

CREATE INDEX IF NOT EXISTS idx_empleados_ente ON empleados (ente);
