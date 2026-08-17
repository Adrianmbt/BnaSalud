-- ============================================================
-- BnaSalud · Doble confirmación de entrega de medicamentos (migración 0014)
--
-- Ciclo de la receta en farmacia:
--   PENDIENTE → DESPACHADA (farmacia valida y descuenta inventario)
--            → ENTREGADA  (el farmacéutico entrega y registra la cédula de quien recibe)
--            → RECIBIDA   (el paciente confirma en su portal que recibió los medicamentos)
--
-- La receta solo se cierra cuando existen los dos registros:
-- la entrega del farmacéutico (entregada_at/por) y la confirmación
-- del paciente (recibida_at/por).
--
-- Idempotente: puede re-ejecutarse sin errores.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS entregada_por_id INTEGER REFERENCES public.personal (id),
  ADD COLUMN IF NOT EXISTS entregada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recibida_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recibida_paciente_id UUID REFERENCES public.historias_clinicas (id);

COMMENT ON COLUMN public.recetas.entregada_por_id IS 'Personal de farmacia que entregó los medicamentos';
COMMENT ON COLUMN public.recetas.entregada_at IS 'Marca de entrega del farmacéutico';
COMMENT ON COLUMN public.recetas.recibida_at IS 'Confirmación del paciente en su portal (cierra el ciclo)';
COMMENT ON COLUMN public.recetas.recibida_paciente_id IS 'Historia clínica del paciente que confirmó la recepción';
