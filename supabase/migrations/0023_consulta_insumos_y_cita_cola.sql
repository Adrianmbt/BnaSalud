-- ============================================================
-- BnaSalud · Cola con cita asociada + insumos de consulta (0023)
-- 1) La cola guarda la cita de la que proviene el turno (vínculo a
--    citas.id). Así el turno expone el código de confirmación y el
--    backend puede marcar la cita como completada al cerrar la consulta.
-- 2) Las consultas registran las medicinas e insumos aplicados durante
--    la atención (inyectables, suturas, gasas, medicamentos administrados).
-- Idempotente: puede re-ejecutarse sin errores (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.cola_pacientes
  ADD COLUMN IF NOT EXISTS cita_uuid UUID REFERENCES public.citas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cola_pacientes_cita_uuid_idx
  ON public.cola_pacientes (cita_uuid);

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS insumos JSONB DEFAULT '[]'::jsonb;