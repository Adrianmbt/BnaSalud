-- Migración 021: certificación de horarios por semana concreta.
--
-- Antes la certificación de RRHH se guardaba con el booleano
-- agenda_medicos.certificado, que vive en la plantilla semanal: certificar una
-- vez abría todas las semanas. Aquí se registra una fila por médico y semana
-- (siempre normalizada al lunes) y es esa fila la que decide si recepción ve
-- la semana como "abierta" para asignar días.
--
-- Sin Alembic: se aplica a mano sobre la base externa, por ejemplo
--   psql -d <db> -v ON_ERROR_STOP=1 -f backend/migrations/021_agenda_certificaciones_semana.sql
-- El backend también crea la tabla de forma perezosa (CREATE TABLE IF NOT
-- EXISTS) para no romper la agenda si el script aún no se ejecutó.

-- Las columnas del mecanismo anterior se aseguran aquí porque sin Alembic
-- solo se creaban al certificar desde la aplicación.
ALTER TABLE public.agenda_medicos
    ADD COLUMN IF NOT EXISTS certificado BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS certificado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS certificado_por TEXT;

CREATE TABLE IF NOT EXISTS public.agenda_certificaciones_semana (
    id                BIGSERIAL   PRIMARY KEY,
    medico_id         INTEGER     NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
    semana_desde      DATE        NOT NULL,
    semana_hasta      DATE        NOT NULL,
    dias_certificados SMALLINT    NOT NULL DEFAULT 0,
    certificado_por   TEXT,
    certificado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agenda_certificaciones_semana_unica UNIQUE (medico_id, semana_desde),
    CONSTRAINT agenda_certificaciones_semana_lunes CHECK (EXTRACT(ISODOW FROM semana_desde) = 1),
    CONSTRAINT agenda_certificaciones_semana_rango CHECK (semana_hasta >= semana_desde)
);

CREATE INDEX IF NOT EXISTS ix_agenda_cert_semana_semana
    ON public.agenda_certificaciones_semana (semana_desde);

-- Continuidad: si un médico ya tenía la plantilla marcada como certificada con
-- el mecanismo anterior, se conserva abierta la semana en curso. Las semanas
-- siguientes se certifican desde la app («Certificar horarios»).
INSERT INTO public.agenda_certificaciones_semana
    (medico_id, semana_desde, semana_hasta, dias_certificados, certificado_por, certificado_en)
SELECT
    a.medico_id,
    date_trunc('week', CURRENT_DATE)::date                      AS semana_desde,
    (date_trunc('week', CURRENT_DATE)::date + 4)                AS semana_hasta,
    COUNT(DISTINCT a.dia_semana)                                AS dias_certificados,
    'migracion_021'                                             AS certificado_por,
    NOW()                                                       AS certificado_en
FROM public.agenda_medicos a
WHERE a.activo
  AND a.dia_semana BETWEEN 0 AND 4
  AND COALESCE(a.certificado, FALSE)
GROUP BY a.medico_id
ON CONFLICT (medico_id, semana_desde) DO NOTHING;
