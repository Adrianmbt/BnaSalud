-- ============================================================
-- BnaSalud — Migración 0027
-- Un cupo por centro, fecha y hora. Antes la comprobación se hacía
-- en Python (leer y luego insertar): dos peticiones simultáneas
-- podían pasar la comprobación y reservar el mismo horario.
--
-- El índice es parcial: ignora las citas canceladas (liberan el
-- cupo) y las solicitudes del portal, que aún no tienen fecha ni
-- hora (fecha_cita/hora_inicio NULL, migración 0025).
--
-- El cupo es POR CENTRO, no por médico: es el criterio que ya usan
-- `crear_cita`, `asignar_cita`, `posponer_cita` y `_generar_slots`.
-- Si algún día el cupo debe ser por médico, hay que añadir
-- `medico_id` al índice y revisar esas cuatro funciones.
--
-- Antes de crearlo, compruebe que no haya dobles reservas:
--   SELECT centro_id, fecha_cita, hora_inicio, COUNT(*)
--     FROM public.citas
--    WHERE estado <> 'cancelada'
--      AND fecha_cita IS NOT NULL AND hora_inicio IS NOT NULL
--    GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;
-- Si devuelve filas, cancele o mueva las sobrantes antes de aplicar.
--
-- Idempotente: puede re-ejecutarse.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS citas_cupo_centro_uq
  ON public.citas (centro_id, fecha_cita, hora_inicio)
  WHERE estado <> 'cancelada'
    AND fecha_cita IS NOT NULL
    AND hora_inicio IS NOT NULL;

COMMENT ON INDEX public.citas_cupo_centro_uq IS
  'Un solo turno por centro, fecha y hora; las canceladas liberan el cupo.';
