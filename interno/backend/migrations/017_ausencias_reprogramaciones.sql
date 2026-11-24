-- 017_ausencias_reprogramaciones.sql
-- Registro de ausencias de medicos y propuestas de reprogramacion de citas.
-- No mueve citas: la cita solo cambia cuando recepcion confirma la propuesta.
-- Sin sobrecupo: cada propuesta usa una franja libre real.

CREATE TABLE IF NOT EXISTS ausencias_medicos (
    id serial PRIMARY KEY,
    medico_id integer NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    fecha_desde date NOT NULL,
    fecha_hasta date NOT NULL,
    motivo text,
    estado text NOT NULL DEFAULT 'activa',
    creada_por integer REFERENCES personal(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    resuelta_en timestamp with time zone,
    CONSTRAINT ausencias_medicos_rango_check CHECK (fecha_hasta >= fecha_desde),
    CONSTRAINT ausencias_medicos_estado_check CHECK (estado IN ('activa', 'resuelta', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_ausencias_medicos_medico_fechas
    ON ausencias_medicos (medico_id, fecha_desde, fecha_hasta);

CREATE INDEX IF NOT EXISTS idx_ausencias_medicos_estado
    ON ausencias_medicos (estado);

CREATE TABLE IF NOT EXISTS reprogramaciones_citas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id uuid NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
    ausencia_id integer REFERENCES ausencias_medicos(id) ON DELETE SET NULL,
    fecha_anterior date NOT NULL,
    hora_anterior time without time zone NOT NULL,
    fecha_nueva date,
    hora_nueva time without time zone,
    estado text NOT NULL DEFAULT 'propuesta',
    contacto text NOT NULL DEFAULT 'pendiente',
    notas text,
    confirmada_por integer REFERENCES personal(id) ON DELETE SET NULL,
    confirmada_en timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT reprogramaciones_citas_estado_check
        CHECK (estado IN ('propuesta', 'confirmada', 'rechazada', 'sin_cupo', 'cancelada')),
    CONSTRAINT reprogramaciones_citas_contacto_check
        CHECK (contacto IN ('pendiente', 'contactado', 'no_contesta', 'confirmado', 'rechazado'))
);

CREATE INDEX IF NOT EXISTS idx_reprogramaciones_citas_ausencia
    ON reprogramaciones_citas (ausencia_id, estado);

CREATE INDEX IF NOT EXISTS idx_reprogramaciones_citas_cita
    ON reprogramaciones_citas (cita_id);

CREATE INDEX IF NOT EXISTS idx_reprogramaciones_citas_fecha_nueva
    ON reprogramaciones_citas (fecha_nueva, hora_nueva);
