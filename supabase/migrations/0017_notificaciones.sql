-- Notificaciones al paciente (Fase 5): auditoría de correos enviados
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id UUID REFERENCES public.historias_clinicas(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  canal VARCHAR(20) NOT NULL DEFAULT 'correo',
  asunto VARCHAR(200) NOT NULL,
  destinatario VARCHAR(200),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  detalle TEXT,
  referencia VARCHAR(80),
  enviado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notificaciones_paciente_idx ON public.notificaciones (paciente_id, creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_referencia_unico
  ON public.notificaciones (tipo, referencia)
  WHERE referencia IS NOT NULL;
