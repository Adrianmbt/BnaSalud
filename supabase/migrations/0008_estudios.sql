-- 8. ESTUDIOS MÉDICOS EN CONSULTAS
-- Resultados clasificados: laboratorio, imagen o funcional (texto extraído, sin almacenar la imagen).
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS estudios JSONB DEFAULT '[]'::jsonb;
