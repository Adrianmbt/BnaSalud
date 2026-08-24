-- Bitácora de acciones administrativas (Fase 7): trazabilidad de auditoría
CREATE TABLE IF NOT EXISTS public.bitacora_acciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER REFERENCES public.personal(id) ON DELETE SET NULL,
  username VARCHAR(80),
  rol VARCHAR(30),
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(40),
  entidad_id VARCHAR(80),
  detalle TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bitacora_creado_idx ON public.bitacora_acciones (creado_en DESC);
CREATE INDEX IF NOT EXISTS bitacora_accion_idx ON public.bitacora_acciones (accion);
CREATE INDEX IF NOT EXISTS bitacora_username_idx ON public.bitacora_acciones (username);
