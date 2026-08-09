-- ============================================================
-- BnaSalud · Órdenes de estudios (migración 0009)
-- La orden médica es una entidad propia: se emite (solicitada) y
-- luego el médico registra los resultados (con_resultados) en una
-- consulta posterior. Se referencia desde las consultas.
-- ============================================================

-- 1. ÓRDENES DE ESTUDIOS (nueva)
CREATE TABLE IF NOT EXISTS public.ordenes_estudios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES public.historias_clinicas (id),
  consulta_id UUID,
  cita_id TEXT,
  origen TEXT DEFAULT 'consulta',              -- consulta | emergencia | jornada
  estado TEXT DEFAULT 'solicitada',            -- solicitada | con_resultados
  medico_id INTEGER,
  medico_nombre TEXT,
  especialidad TEXT,
  prioridad TEXT DEFAULT 'normal',             -- normal | urgente
  estudios JSONB DEFAULT '[]'::jsonb,          -- [{tipo, nombre, parametros, descripcion, conclusion, estado}]
  comprobante_orden TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resultados_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ordenes_paciente ON public.ordenes_estudios (paciente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON public.ordenes_estudios (estado);

-- 2. CONSULTAS: referencia a las órdenes emitidas en esa consulta
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS ordenes_ids UUID[] DEFAULT '{}';
