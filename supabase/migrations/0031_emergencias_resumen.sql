-- Migración 0031: tabla de resumen de emergencias/morbilidad por clínica.
--
-- El script scripts/sincronizar_interno.py lee cola_atencion del Postgres
-- interno (bnasalud) y sube aquí los conteos agregados por clínica.
-- El endpoint app/api/v1/endpoints/panel.py los lee de esta tabla.
--
-- Aplicar desde el SQL Editor de Supabase (una sola vez, en orden numérico).

CREATE TABLE IF NOT EXISTS public.interno_emergencias_resumen (
  clinica_id          INTEGER      NOT NULL,
  instalacion         TEXT         NOT NULL DEFAULT 'citab',
  clinica_nombre      TEXT,
  total_emergencias   INTEGER      NOT NULL DEFAULT 0,   -- excluye CANCELADO/NO_ASISTIO
  finalizadas         INTEGER      NOT NULL DEFAULT 0,
  en_atencion         INTEGER      NOT NULL DEFAULT 0,   -- RECEPCION+TRIAJE+ESPERA+CONSULTA
  canceladas          INTEGER      NOT NULL DEFAULT 0,
  prio_verde          INTEGER      NOT NULL DEFAULT 0,
  prio_amarillo       INTEGER      NOT NULL DEFAULT 0,
  prio_rojo           INTEGER      NOT NULL DEFAULT 0,
  pacientes_distintos INTEGER      NOT NULL DEFAULT 0,   -- COUNT DISTINCT paciente_cedula/id
  actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (clinica_id, instalacion)
);

-- Solo admin_sistemas y service_role pueden leer/escribir.
ALTER TABLE public.interno_emergencias_resumen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_sistemas puede leer emergencias_resumen"
  ON public.interno_emergencias_resumen
  FOR SELECT
  USING (
    (auth.jwt() ->> 'rol') = 'admin_sistemas'
    OR (auth.jwt() ->> 'rol') = 'director'
  );

-- El script de sincronización usa service_role (omite RLS), así que
-- no necesita una policy de escritura explícita para INSERT/UPDATE.

COMMENT ON TABLE public.interno_emergencias_resumen IS
  'Resumen agregado de emergencias/morbilidad por clínica, sincronizado desde
   el Postgres interno (bnasalud → cola_atencion) mediante sincronizar_interno.py.';

-- Top diagnósticos CIE-10 de emergencia (opcional, sincronizado desde el interno).
ALTER TABLE public.interno_emergencias_resumen
  ADD COLUMN IF NOT EXISTS top_cie10 JSONB NOT NULL DEFAULT '[]'::jsonb;
