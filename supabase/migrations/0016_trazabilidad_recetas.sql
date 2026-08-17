-- Trazabilidad (Fase 4): vincula cada receta con la consulta que la originó
ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS consulta_id UUID REFERENCES public.consultas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS recetas_consulta_id_idx ON public.recetas (consulta_id);
