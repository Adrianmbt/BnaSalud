-- 023_citas_recepcion_sync.sql
-- Citas presenciales o telefónicas creadas desde Recepción y su cola de
-- sincronización hacia el portal web (Supabase).
--
-- La cita se guarda primero en la base local con origen 'recepcion_interna' y
-- estado 'confirmada'. La cola `citas_sync_outbox` guarda el registro que se
-- empuja al portal en segundo plano, de modo que la clínica puede seguir
-- agendando aunque no haya internet.
--
-- Migración manual e idempotente (sin BEGIN/COMMIT para aplicar_sql.py).

-- 1) Número de turno correlativo por centro y día (se muestra al paciente).
ALTER TABLE citas ADD COLUMN IF NOT EXISTS numero_turno integer;

CREATE INDEX IF NOT EXISTS idx_citas_centro_fecha_turno
    ON citas (centro_id, fecha_cita, numero_turno);

-- 2) Cola de sincronización de citas creadas en recepción
CREATE TABLE IF NOT EXISTS citas_sync_outbox (
    id bigserial PRIMARY KEY,
    entidad text NOT NULL DEFAULT 'cita',
    operacion text NOT NULL DEFAULT 'upsert',
    referencia text,
    payload jsonb NOT NULL,
    intentos integer NOT NULL DEFAULT 0,
    ultimo_error text,
    enviado_en timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citas_outbox_pendiente
    ON citas_sync_outbox (enviado_en) WHERE enviado_en IS NULL;
